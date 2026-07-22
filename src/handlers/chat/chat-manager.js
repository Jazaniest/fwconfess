import { Markup } from 'telegraf';
import { db } from '../../services/db.js';
import * as UserRepo from '../../repositories/user.repo.js';

// Fungsi helper untuk query database
async function getActiveChatByUserId(userId) {
    const [rows] = await db.query(
        "SELECT * FROM `anonymous_chats` WHERE (`confessor_id` = ? OR `hitter_id` = ?) AND `status` = 'active' LIMIT 1",
        [userId, userId]
    );
    return rows[0] || null;
}

/**
 * Chat Manager - Handles anonymous chat sessions and messaging using the database as the source of truth.
 */
export class ChatManager {
    constructor(bot) {
        this.bot = bot;
    }

    /**
     * Send anonymous message between users
     */
    async sendAnonymousMessage(ctx, userId, text) {
        try {
            const session = await getActiveChatByUserId(userId);
            if (!session) {
                await ctx.reply('❌ Kamu tidak sedang dalam chat anonymous.');
                return false;
            }

            const partnerId = session.confessor_id === userId ? session.hitter_id : session.confessor_id;
            const senderRole = session.confessor_id === userId ? 'confessor' : 'hitter';

            // Di masa depan, pesan bisa disimpan di sini jika diperlukan.
            // await db.query('INSERT INTO anonymous_messages ...');

            const senderLabel = senderRole === 'confessor' ? '👤 Confessor' : '💝 Hitter';

            await ctx.telegram.sendMessage(partnerId, `*${senderLabel}*: ${text}`, { parse_mode: 'Markdown' });

            // Update last message timestamp
            await db.query("UPDATE `anonymous_chats` SET `last_message_at` = NOW() WHERE `id` = ?", [session.id]);

            return true;
        } catch (error) {
            console.error('Error sending anonymous message:', error);
            await ctx.reply('❌ Gagal mengirim pesan. Lawan chat mungkin telah memblokir bot.');
            return false;
        }
    }

    /**
     * Create new chat session in the database
     */
    async createChatSession(confessionId, confessorId, hitterId) {
        try {
            const [result] = await db.query(
                'INSERT INTO `anonymous_chats` (`confession_id`, `confessor_id`, `hitter_id`, `status`, `last_message_at`) VALUES (?, ?, ?, ?, NOW())',
                [confessionId, confessorId, hitterId, 'active']
            );
            const sessionId = result.insertId;

            await this.notifySessionStart(confessorId, hitterId, sessionId);

            return { id: sessionId };
        } catch (error) {
            console.error('Error creating chat session:', error);
            throw error;
        }
    }

    /**
     * End a chat session
     */
    async endChatSession(ctx, userId) {
        try {
            const session = await getActiveChatByUserId(userId);
            if (!session) {
                return ctx.reply('❌ Kamu tidak sedang dalam chat anonymous.');
            }

            await db.query("UPDATE `anonymous_chats` SET `status` = 'ended', `ended_at` = NOW() WHERE `id` = ?", [session.id]);

            const endMessage = '❌ *Chat Anonymous Berakhir*\n\n👋 Chat session telah diakhiri.';

            // Notify both users
            await ctx.reply(endMessage, { parse_mode: 'Markdown' });
            const partnerId = session.confessor_id === userId ? session.hitter_id : session.confessor_id;
            try {
                await this.bot.telegram.sendMessage(partnerId, endMessage, { parse_mode: 'Markdown' });
            } catch (e) {
                console.error(`Could not notify partner ${partnerId} of chat end:`, e.message);
            }
            return true;
        } catch (error) {
            console.error('Error ending chat session:', error);
            await ctx.reply('❌ Terjadi kesalahan saat mengakhiri chat.');
            return false;
        }
    }

    /**
     * Notify both users about session start
     */
    async notifySessionStart(confessorId, hitterId, sessionId) {
        try {
            const commonKeyboard = Markup.inlineKeyboard([
                // [Markup.button.callback('🎭 Reveal', `reveal_request_${sessionId}`)], // Reveal logic to be refactored
                [Markup.button.callback('❌ End Chat', `end_chat_${sessionId}`)]
            ]);

            const startMessage = (role) => `✅ *Permintaan Diterima!*\n\n` +
                `🔐 Chat anonymous telah dimulai! Kamu adalah *${role}*.\n` +
                `📝 Ketik pesan untuk memulai percakapan.\n` +
                `💡 Gunakan /endchat untuk mengakhiri.`;

            await this.bot.telegram.sendMessage(confessorId, startMessage('Confessor'), { parse_mode: 'Markdown', reply_markup: commonKeyboard.reply_markup });
            await this.bot.telegram.sendMessage(hitterId, startMessage('Hitter'), { parse_mode: 'Markdown', reply_markup: commonKeyboard.reply_markup });
        } catch (error) {
            console.error('Error notifying session start:', error);
        }
    }

    /**
     * Check if a user is currently in an active chat.
     * @param {number} userId - The user's Telegram ID.
     * @returns {Promise<boolean>}
     */
    async isUserInChat(userId) {
        const session = await getActiveChatByUserId(userId);
        return !!session;
    }

    /**
     * Force end a session by admin.
     * @param {number} userId The ID of one of the users in the chat.
     */
    async forceEndSession(userId) {
        const session = await getActiveChatByUserId(userId);
        if (!session) return false;

        await db.query("UPDATE `anonymous_chats` SET `status` = 'ended', `ended_at` = NOW() WHERE `id` = ?", [session.id]);

        const endMessage = 'ℹ️ Sesi chat ini telah diakhiri oleh administrator.';
        try {
            await this.bot.telegram.sendMessage(session.confessor_id, endMessage);
            await this.bot.telegram.sendMessage(session.hitter_id, endMessage);
        } catch(e) {
            console.error("Failed to notify users on force end:", e.message);
        }
        return true;
    }

    /**
     * Gets the active chat session for a user.
     * @param {number} userId
     * @returns {Promise<object|null>}
     */
    async getUserChatInfo(userId) {
        const session = await getActiveChatByUserId(userId);
        if (!session) return null;

        const partnerId = session.confessor_id === userId ? session.hitter_id : session.confessor_id;
        const role = session.confessor_id === userId ? 'confessor' : 'hitter';

        return {
            sessionId: session.id,
            partnerId,
            role,
            startTime: session.created_at
        };
    }

    /**
     * A job to clean up sessions that have been inactive for too long.
     */
    static async cleanupInactiveSessions() {
        try {
            const [result] = await db.query(
                "UPDATE `anonymous_chats` SET `status` = 'expired' WHERE `status` = 'active' AND `last_message_at` < NOW() - INTERVAL 1 HOUR"
            );
            if (result.affectedRows > 0) {
                console.log(`Cleaned up ${result.affectedRows} inactive chat sessions.`);
            }
        } catch (error) {
            console.error('Error in cleanupInactiveSessions job:', error);
        }
    }
}
