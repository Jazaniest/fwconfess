import { Markup } from 'telegraf';
import { db } from '../../services/db.js';
import * as UserRepo from '../../repositories/user.repo.js';
import * as ConfessionRepo from '../../repositories/confession.repo.js';

// Helper to get the next pending request for a user, prioritizing super hits.
async function getNextPendingRequest(ownerId) {
    const [rows] = await db.query(
        "SELECT * FROM `hitme_requests` WHERE `confession_author_id` = ? AND `status` = 'pending' ORDER BY `is_super_hit` DESC, `created_at` ASC LIMIT 1",
        [ownerId]
    );
    return rows[0] || null;
}


/**
 * Request Manager - Handles Hit Me requests and approvals using the database.
 */
export class RequestManager {
    constructor(bot, chatManager) {
        this.bot = bot;
        this.chatManager = chatManager;
    }

    /**
     * Setup request handlers
     */
    setupHandlers() {
        this.bot.action(/^approve_hitme_(\d+)$/, async (ctx) => {
            await ctx.answerCbQuery();
            await this.approveHitMeRequest(ctx, parseInt(ctx.match[1]));
        });

        this.bot.action(/^decline_hitme_(\d+)$/, async (ctx) => {
            await ctx.answerCbQuery();
            await this.declineHitMeRequest(ctx, parseInt(ctx.match[1]));
        });
    }

    /**
     * Create hit me request
     */
    async createHitMeRequest(ctx, confessionAuthorId, hitterId, confession, isSuperHit = false) {
        try {
            // Rate limit check (not for Super Hit)
            if (!isSuperHit) {
                const rankId = await ConfessionRepo.getEffectiveRankId(hitterId);
                const limit = await ConfessionRepo.getActionLimitByRankId(rankId, 'hitme');
                const recentCount = await ConfessionRepo.countRecentActions(hitterId, 'hitme'); // Assuming default window
                if (recentCount >= limit) {
                    await ctx.reply(`⏰ Kamu sudah mencapai batas maksimal Hit Me untuk rank kamu. Coba lagi nanti.`);
                    return false;
                }
            }

            // Check for existing pending request
            const [existing] = await db.query(
                "SELECT id FROM `hitme_requests` WHERE `hitter_id` = ? AND `confession_author_id` = ? AND `status` = 'pending' LIMIT 1",
                [hitterId, confessionAuthorId]
            );
            if (existing.length > 0) {
                await ctx.reply('⏳ Kamu sudah mengirim permintaan Hit Me ke orang ini. Harap tunggu respon mereka.');
                return false;
            }

            // Check if there are other pending requests for the confessor
            const isFirstRequest = !(await getNextPendingRequest(confessionAuthorId));

            // Insert new request
            const [result] = await db.query(
                "INSERT INTO `hitme_requests` (`confession_author_id`, `hitter_id`, `confession_id`, `is_super_hit`) VALUES (?, ?, ?, ?)",
                [confessionAuthorId, hitterId, confession.id, isSuperHit]
            );
            const requestId = result.insertId;

            // Notify confessor ONLY if this is the first request in their queue
            if (isFirstRequest) {
                await this.sendApprovalRequest(ctx, requestId, confessionAuthorId, hitterId, isSuperHit);
            }

            if (!isSuperHit) {
                await ConfessionRepo.recordActionSent(hitterId, 'hitme');
            }

            const successMessage = isSuperHit ? '🌟 *Super Hit Terkirim!*' : '📤 *Permintaan Hit Me Terkirim!*';
            await ctx.reply(successMessage, { parse_mode: 'Markdown' });

            return true;
        } catch (error) {
            console.error('Error creating hit me request:', error);
            await ctx.reply('❌ Terjadi kesalahan saat membuat permintaan.');
            return false;
        }
    }

    async sendApprovalRequest(ctx, requestId, confessorId, hitterId, isSuperHit) {
        const hitter = await UserRepo.getUserById(hitterId);
        const messagePrefix = isSuperHit ? `🌟 *Super Hit Request!*` : `💝 *Hit Me Request!*`;

        const message = `${messagePrefix}\n\nSeseorang ingin chat denganmu.\n\n` +
            `👤 **Info Hitter:**\n` +
            `• Gender: ${hitter.gender || 'Rahasia'}\n` +
            `• Origin: ${hitter.origin || 'Rahasia'}\n` +
            `• Rank: ${hitter.rank || 'Member'}\n\n` +
            `🤔 Apakah kamu mau chat anonymous?`;

        try {
            await this.bot.telegram.sendMessage(confessorId, message, {
                parse_mode: 'Markdown',
                reply_markup: Markup.inlineKeyboard([
                    [Markup.button.callback('✅ Terima', `approve_hitme_${requestId}`)],
                    [Markup.button.callback('❌ Tolak', `decline_hitme_${requestId}`)]
                ]).reply_markup
            });
        } catch (e) {
            console.error(`Failed to send approval request to ${confessorId}:`, e.message);
            // If sending fails, we should probably delete the request to avoid a stuck queue
            await db.query("DELETE FROM `hitme_requests` WHERE id = ?", [requestId]);
        }
    }


    /**
     * Approve hit me request
     */
    async approveHitMeRequest(ctx, requestId) {
        const [requests] = await db.query("SELECT * FROM `hitme_requests` WHERE `id` = ? AND `status` = 'pending'", [requestId]);
        const request = requests[0];

        if (!request) {
            return ctx.editMessageText('❌ Permintaan sudah tidak valid atau sudah diproses.');
        }

        // Check if either user is already in a chat
        const confessorInChat = await this.chatManager.isUserInChat(request.confession_author_id);
        const hitterInChat = await this.chatManager.isUserInChat(request.hitter_id);

        if (confessorInChat || hitterInChat) {
             await this.declineHitMeRequest(ctx, requestId, true); // Decline silently
             return ctx.editMessageText('❌ Salah satu dari kalian sudah berada dalam chat. Permintaan ditolak.');
        }

        await db.query("UPDATE `hitme_requests` SET `status` = 'approved' WHERE `id` = ?", [requestId]);
        await this.chatManager.createChatSession(request.confession_id, request.confession_author_id, request.hitter_id);

        await ctx.editMessageText('✅ *Permintaan Diterima!*\n\nChat anonymous telah dimulai. Silakan cek chat personal dari bot.');

        // Process next in queue for the confessor
        const nextRequest = await getNextPendingRequest(request.confession_author_id);
        if (nextRequest) {
            await this.sendApprovalRequest(ctx, nextRequest.id, nextRequest.confession_author_id, nextRequest.hitter_id, nextRequest.is_super_hit);
        }
    }

    /**
     * Decline hit me request
     */
    async declineHitMeRequest(ctx, requestId, silent = false) {
        const [requests] = await db.query("SELECT * FROM `hitme_requests` WHERE `id` = ? AND `status` = 'pending'", [requestId]);
        const request = requests[0];

        if (!request) {
            if (!silent) await ctx.editMessageText('❌ Permintaan sudah tidak valid atau sudah diproses.');
            return;
        }

        await db.query("UPDATE `hitme_requests` SET `status` = 'declined' WHERE `id` = ?", [requestId]);

        if (!silent) {
            await ctx.editMessageText('❌ Permintaan Hit Me ditolak.');
            try {
                await this.bot.telegram.sendMessage(request.hitter_id, '😔 Permintaan Hit Me kamu ditolak.');
            } catch (e) {
                console.error("Could not notify hitter of decline: ", e.message);
            }
        }

        // Process next in queue for the confessor
        const nextRequest = await getNextPendingRequest(request.confession_author_id);
        if (nextRequest) {
            await this.sendApprovalRequest(ctx, nextRequest.id, nextRequest.confession_author_id, nextRequest.hitter_id, nextRequest.is_super_hit);
        }
    }

    /**
     * A job to clean up requests that have been pending for too long.
     */
    static async cleanupExpiredRequests() {
        try {
            // We need to notify users whose requests are about to be cleaned up
            const [expiredRequests] = await db.query(
                "SELECT * FROM `hitme_requests` WHERE `status` = 'pending' AND `created_at` < NOW() - INTERVAL 10 MINUTE"
            );

            if (expiredRequests.length > 0) {
                 const [result] = await db.query(
                    "UPDATE `hitme_requests` SET `status` = 'expired' WHERE `status` = 'pending' AND `created_at` < NOW() - INTERVAL 10 MINUTE"
                );
                console.log(`Cleaned up ${result.affectedRows} expired hit me requests.`);
                // Here you could add logic to process the next in queue for each affected confessor
            }

        } catch (error) {
            console.error('Error in cleanupExpiredRequests job:', error);
        }
    }
}
