import { Markup } from 'telegraf';
import { getChatSessionById, createChatSession as dbCreateChatSession,
  endChatSession as dbEndChatSession, saveAnonymousMessage,
  checkRevealStatus, getActiveSessions, getActiveChatSession,
  cleanupInactiveSessions as dbCleanupInactiveSessions
} from '../../repositories/chat.repo.js';

/**
 * Chat Manager — Handles anonymous chat sessions and messaging.
 *
 * Dipindah dari: src/commands/chat-manager.js
 * Import DB langsung dari repositories/ (bukan lewat Database shim).
 */
export class ChatManager {
  constructor(bot) {
    this.bot = bot;
    this.activeChatUsers = new Map(); // userId → { sessionId, role, partnerId }
  }

  // ─── Setup ────────────────────────────────────────────────────────────────

  /** No-op stub — handler teks dikelola di bot.js lewat bot.on('text'). */
  setupMessageHandler() {
    console.log('Setting up message handler for anonymous chat');
  }

  // ─── Messaging ────────────────────────────────────────────────────────────

  /**
   * Kirim pesan anonymous dari satu user ke partner-nya.
   */
  async sendAnonymousMessage(ctx, userId, text) {
    try {
      console.log(`Processing anonymous message from ${userId}`);

      const userChatData = this.activeChatUsers.get(userId);
      if (!userChatData) {
        console.log(`No chat data found for user ${userId}`);
        await ctx.reply('❌ Kamu tidak sedang dalam chat anonymous.');
        return false;
      }

      const { sessionId, partnerId: receiverId, role: senderRole } = userChatData;

      console.log('Anonymous message details:', { sender: userId, receiver: receiverId, sessionId, role: senderRole });

      // Validasi session
      const session = await getChatSessionById(sessionId);
      if (!session || !session.is_active) {
        console.log(`Session ${sessionId} not found or inactive`);
        this.activeChatUsers.delete(userId);
        await ctx.reply('❌ Chat session tidak aktif atau sudah berakhir.');
        return false;
      }

      // Validasi receiver masih aktif
      if (!this.activeChatUsers.has(receiverId)) {
        console.log(`Receiver ${receiverId} not in active chat`);
        await ctx.reply('❌ Lawan chat sudah tidak aktif.');
        return false;
      }

      // Simpan ke DB
      await saveAnonymousMessage(sessionId, userId, text);
      console.log(`Message saved to database for session ${sessionId}`);

      // Label pengirim — override dengan nama asli jika kedua pihak sudah reveal
      const senderLabel = senderRole === 'confessor' ? '👤 Confessor' : '💝 Hitter';
      const senderRevealed   = await checkRevealStatus(sessionId, userId);
      const receiverRevealed = await checkRevealStatus(sessionId, receiverId);
      const bothRevealed     = senderRevealed && receiverRevealed;

      let senderDisplayName = senderLabel;
      if (bothRevealed) {
        try {
          const senderInfo = await ctx.telegram.getChat(userId);
          senderDisplayName = `${senderInfo.first_name}${senderInfo.last_name ? ' ' + senderInfo.last_name : ''}`;
        } catch {
          senderDisplayName = senderLabel; // fallback ke role
        }
      }

      // Kirim ke receiver
      try {
        await ctx.telegram.sendMessage(receiverId, `${text}\n\n`);
        console.log(`Message successfully sent to receiver ${receiverId}`);
      } catch (sendError) {
        console.error(`Error sending message to receiver ${receiverId}:`, sendError);
        let errorMsg = '❌ Gagal mengirim pesan ke lawan chat.';
        const desc = sendError?.response?.description || '';
        if (desc.includes('bot was blocked by the user') || desc.includes('user not found')) {
          errorMsg += '\n\nKemungkinan lawan chat belum pernah memulai chat dengan bot. Minta mereka untuk klik /start di bot ini agar bisa menerima pesan.';
        }
        await ctx.reply(errorMsg);
        return false;
      }

      console.log(`Anonymous message successfully processed for session ${sessionId}`);
      return true;

    } catch (error) {
      console.error('Error sending anonymous message:', error);
      return false;
    }
  }

  // ─── Session lifecycle ────────────────────────────────────────────────────

  /**
   * Buat chat session baru dan daftarkan kedua user ke memory map.
   */
  async createChatSession(confessionId, confessorId, hitterId) {
    try {
      console.log(`Creating chat session: confession ${confessionId}, confessor ${confessorId}, hitter ${hitterId}`);

      const session = await dbCreateChatSession(confessionId, confessorId, hitterId);
      console.log('Chat session created:', session.id);

      this.activeChatUsers.set(hitterId, { sessionId: session.id, role: 'hitter', partnerId: confessorId });
      this.activeChatUsers.set(confessorId, { sessionId: session.id, role: 'confessor', partnerId: hitterId });

      console.log('Added users to active chat map:', { hitter: hitterId, confessor: confessorId, sessionId: session.id });
      return session;

    } catch (error) {
      console.error('Error creating chat session:', error);
      throw error;
    }
  }

  /**
   * Akhiri session dari sisi user (command /endchat atau tombol End Chat).
   */
  async endChatSession(ctx, userId) {
    try {
      console.log(`Ending chat session for user ${userId}`);

      if (!this.activeChatUsers.has(userId)) {
        console.log(`User ${userId} not in active chat`);
        return ctx.reply('❌ Kamu tidak sedang dalam chat anonymous.');
      }

      const { sessionId, partnerId } = this.activeChatUsers.get(userId);

      const session = await getChatSessionById(sessionId);
      if (!session) {
        console.log(`Session ${sessionId} not found`);
        this.activeChatUsers.delete(userId);
        return ctx.reply('❌ Session tidak ditemukan.');
      }

      await dbEndChatSession(sessionId);
      console.log(`Session ${sessionId} ended in database`);

      this.activeChatUsers.delete(session.confessor_id);
      this.activeChatUsers.delete(session.hitter_id);
      console.log(`Removed users from active chat map: ${session.confessor_id}, ${session.hitter_id}`);

      const endMessage =
        '❌ *Chat Anonymous Berakhir*\n\n' +
        '👋 Chat session telah diakhiri.\n' +
        'Terima kasih telah menggunakan fitur anonymous chat!\n\n' +
        '💡 Kamu bisa memulai chat baru dengan hit confession lain.';

      await ctx.reply(endMessage, { parse_mode: 'Markdown' });

      if (partnerId && partnerId !== userId) {
        try {
          await ctx.telegram.sendMessage(partnerId, endMessage, { parse_mode: 'Markdown' });
          console.log(`Notified partner ${partnerId} about chat end`);
        } catch (error) {
          console.error('Error notifying partner about chat end:', error);
        }
      }

      console.log('Chat session ended:', sessionId);
      return true;

    } catch (error) {
      console.error('Error ending chat session:', error);
      await ctx.reply('❌ Terjadi kesalahan saat mengakhiri chat.');
      return false;
    }
  }

  /**
   * Force-end session (admin use / cleanup).
   * Tidak mengirim notifikasi ke user — bersifat silent.
   */
  async forceEndSession(userId) {
    try {
      console.log(`Force ending session for user ${userId}`);

      if (!this.activeChatUsers.has(userId)) {
        console.log(`User ${userId} not in active chat`);
        return false;
      }

      const chatData = this.activeChatUsers.get(userId);
      await dbEndChatSession(chatData.sessionId);

      this.activeChatUsers.delete(userId);
      if (chatData.partnerId) this.activeChatUsers.delete(chatData.partnerId);

      console.log(`Force ended session for user ${userId}`);
      return true;

    } catch (error) {
      console.error('Error in force end session:', error);
      return false;
    }
  }

  // ─── Notifications ────────────────────────────────────────────────────────

  /**
   * Kirim notifikasi ke kedua user saat session baru dimulai.
   */
  async notifySessionStart(confessorId, hitterId, sessionId) {
    try {
      console.log(`Notifying session start for session ${sessionId}`);

      const commonKeyboard = {
        inline_keyboard: [[
          { text: '🎭 Reveal',  callback_data: `reveal_request_${sessionId}` },
          { text: '❌ End Chat', callback_data: 'end_chat' }
        ]]
      };

      const startMsg = (role) =>
        role === 'confessor'
          ? '✅ *Permintaan Hit Me Diterima!*\n\n' +
            '🔐 Chat anonymous telah dimulai!\n' +
            '👤 Kamu sekarang terhubung dengan penghit\n\n' +
            '📝 Ketik pesan untuk memulai percakapan\n' +
            '🎭 Identitas kalian masih tersembunyi\n\n' +
            '💡 *Perintah dalam chat:*\n' +
            '• `/reveal` - Minta reveal identitas\n' +
            '• `/endchat` - Akhiri percakapan'
          : '🎉 *Hit Me Request Diterima!*\n\n' +
            '🔐 Chat anonymous telah dimulai!\n' +
            '👤 Pembuat confession menerima permintaan kamu\n\n' +
            '📝 Ketik pesan untuk memulai percakapan\n' +
            '🎭 Identitas kalian masih tersembunyi\n\n' +
            '💡 *Perintah dalam chat:*\n' +
            '• `/reveal` - Minta reveal identitas\n' +
            '• `/endchat` - Akhiri percakapan';

      for (const [recipientId, role] of [[confessorId, 'confessor'], [hitterId, 'hitter']]) {
        try {
          await this.bot.telegram.sendMessage(recipientId, startMsg(role), {
            parse_mode: 'Markdown',
            reply_markup: commonKeyboard
          });
          console.log(`Notified ${role} ${recipientId}`);
        } catch (error) {
          console.error(`Error notifying ${role} ${recipientId}:`, error);
        }
      }

    } catch (error) {
      console.error('Error notifying session start:', error);
    }
  }

  // ─── Sync & Cleanup ───────────────────────────────────────────────────────

  /**
   * Sinkronisasi memory map dengan DB — bersihkan orphaned sessions.
   * Dipanggil saat bot start dan periodik.
   */
  async syncSessionsWithDatabase() {
    try {
      console.log('=== SYNCING SESSIONS WITH DATABASE ===');

      const activeSessions = await getActiveSessions();
      console.log('Active sessions in database:', activeSessions.length);

      for (const session of activeSessions) {
        const confessorInMemory = this.activeChatUsers.has(session.confessor_id);
        const hitterInMemory    = this.activeChatUsers.has(session.hitter_id);

        console.log(`Session ${session.id}: confessor_in_memory=${confessorInMemory}, hitter_in_memory=${hitterInMemory}`);

        if (!confessorInMemory && !hitterInMemory) {
          console.log(`Cleaning up orphaned session ${session.id}`);
          await dbEndChatSession(session.id);
          continue;
        }

        if (confessorInMemory && !hitterInMemory) {
          console.log(`Removing orphaned confessor ${session.confessor_id} from memory`);
          this.activeChatUsers.delete(session.confessor_id);
          await dbEndChatSession(session.id);
        } else if (!confessorInMemory && hitterInMemory) {
          console.log(`Removing orphaned hitter ${session.hitter_id} from memory`);
          this.activeChatUsers.delete(session.hitter_id);
          await dbEndChatSession(session.id);
        }
      }

      // Bersihkan memory entry yang sessionnya sudah tidak ada di DB
      const memoryUserIds = Array.from(this.activeChatUsers.keys());
      for (const userId of memoryUserIds) {
        const userChatData = this.activeChatUsers.get(userId);
        const sessionExists = activeSessions.some(
          s => s.id === userChatData.sessionId && s.is_active
        );
        if (!sessionExists) {
          console.log(`Removing user ${userId} from memory - session not found in database`);
          this.activeChatUsers.delete(userId);
        }
      }

      console.log('Session sync completed');

    } catch (error) {
      console.error('Error syncing sessions with database:', error);
    }
  }

  /**
   * Bersihkan memory + DB entries user yang stuck.
   */
  async forceCleanupUserSession(userId) {
    try {
      console.log(`=== FORCE CLEANUP FOR USER ${userId} ===`);

      if (this.activeChatUsers.has(userId)) {
        const chatData = this.activeChatUsers.get(userId);
        console.log(`Removing user ${userId} from memory (session: ${chatData.sessionId})`);

        if (chatData.partnerId && this.activeChatUsers.has(chatData.partnerId)) {
          console.log(`Also removing partner ${chatData.partnerId} from memory`);
          this.activeChatUsers.delete(chatData.partnerId);
        }

        await dbEndChatSession(chatData.sessionId);
        console.log(`Ended session ${chatData.sessionId} in database`);
        this.activeChatUsers.delete(userId);
      }

      // Cek DB juga kalau ada session aktif yang tidak ada di memory
      const userActiveSession = await getActiveChatSession(userId);
      if (userActiveSession) {
        console.log(`Found active session in database for user ${userId}, cleaning up...`);
        await dbEndChatSession(userActiveSession.id);
      }

      console.log(`Force cleanup completed for user ${userId}`);
      return true;

    } catch (error) {
      console.error(`Error in force cleanup for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Bersihkan sessions yang sudah tidak aktif (dipanggil periodik dari hitme.js).
   */
  async cleanupInactiveSessions() {
    try {
      let cleanedUsers = 0;
      const activeSessions = await getActiveSessions();

      for (const [userId, chatData] of this.activeChatUsers.entries()) {
        const sessionExists = activeSessions.some(
          s => s.id === chatData.sessionId && s.is_active
        );
        if (!sessionExists) {
          console.log('Removing inactive user from chat map:', userId);
          this.activeChatUsers.delete(userId);
          cleanedUsers++;
        }
      }

      const cleanedCount = await dbCleanupInactiveSessions();
      if (cleanedCount > 0 || cleanedUsers > 0) {
        console.log(`Cleaned up ${cleanedCount} inactive database sessions and ${cleanedUsers} inactive users`);
      }

    } catch (error) {
      console.error('Error in cleanup inactive sessions:', error);
    }
  }

  // ─── Utility / Accessors ─────────────────────────────────────────────────

  isUserInChat(userId) {
    const inChat = this.activeChatUsers.has(userId);
    console.log(`Checking if user ${userId} is in chat: ${inChat}`);
    return inChat;
  }

  getUserChatInfo(userId) {
    const info = this.activeChatUsers.get(userId) || null;
    console.log(`Getting chat info for user ${userId}:`, info);
    return info;
  }

  getActiveUsers() {
    return Array.from(this.activeChatUsers.entries());
  }

  getActiveSessionCount() {
    return this.activeChatUsers.size;
  }

  getAllActiveSessions() {
    const sessions = new Map();
    for (const [userId, chatData] of this.activeChatUsers.entries()) {
      if (!sessions.has(chatData.sessionId)) {
        sessions.set(chatData.sessionId, { sessionId: chatData.sessionId, users: [] });
      }
      sessions.get(chatData.sessionId).users.push({ userId, role: chatData.role });
    }
    return Array.from(sessions.values());
  }

  debugActiveUsers() {
    console.log('=== ACTIVE CHAT USERS DEBUG ===');
    console.log('Total active users:', this.activeChatUsers.size);
    for (const [userId, chatData] of this.activeChatUsers.entries()) {
      console.log(`User ${userId}:`, chatData);
    }
    console.log('===============================');
  }
}