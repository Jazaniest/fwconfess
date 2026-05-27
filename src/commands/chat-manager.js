import { Markup } from 'telegraf';
import { Database } from './database.js';

/**
 * Chat Manager - Handles anonymous chat sessions and messaging
 */
export class ChatManager {
  constructor(bot) {
    this.bot = bot;
    this.activeChatUsers = new Map();
  }

  /**
   * Setup message handler for anonymous chat
   */
  setupMessageHandler() {
    console.log('Setting up message handler for anonymous chat');
  }

  /**
   * Send anonymous message between users
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

      const sessionId = userChatData.sessionId;
      const receiverId = userChatData.partnerId;
      const senderRole = userChatData.role;

      console.log(`Anonymous message details:`, {
        sender: userId,
        receiver: receiverId,
        sessionId: sessionId,
        role: senderRole
      });

      // Validate session
      const session = await Database.getChatSessionById(sessionId);
      if (!session || !session.is_active) {
        console.log(`Session ${sessionId} not found or inactive`);
        this.activeChatUsers.delete(userId);
        await ctx.reply('❌ Chat session tidak aktif atau sudah berakhir.');
        return false;
      }

      // Validate receiver is still active
      if (!this.activeChatUsers.has(receiverId)) {
        console.log(`Receiver ${receiverId} not in active chat`);
        await ctx.reply('❌ Lawan chat sudah tidak aktif.');
        return false;
      }

      // Save message to database
      await Database.saveAnonymousMessage(sessionId, userId, text);
      console.log(`Message saved to database for session ${sessionId}`);

      // Determine labels
      const senderLabel = senderRole === 'confessor' ? '👤 Confessor' : '💝 Hitter';
      const receiverLabel = senderRole === 'confessor' ? '💝 Hitter' : '👤 Confessor';

      // Check if identities are revealed
      const senderRevealed = await Database.checkRevealStatus(sessionId, userId);
      const receiverRevealed = await Database.checkRevealStatus(sessionId, receiverId);
      const bothRevealed = senderRevealed && receiverRevealed;

      let senderDisplayName = senderLabel;
      if (bothRevealed) {
        try {
          const senderInfo = await ctx.telegram.getChat(userId);
          senderDisplayName = `${senderInfo.first_name}${senderInfo.last_name ? ' ' + senderInfo.last_name : ''}`;
        } catch (error) {
          console.error('Error getting sender info for revealed chat:', error);
          senderDisplayName = senderLabel; // Fallback to role
        }
      }

      console.log(`Sending message to receiver ${receiverId}`);

      // Send message to receiver
      try {
        await ctx.telegram.sendMessage(
          receiverId,
          `${text}\n\n`,
        );
        console.log(`Message successfully sent to receiver ${receiverId}`);
      } catch (sendError) {
        console.error(`Error sending message to receiver ${receiverId}:`, sendError);
        let errorMsg = '❌ Gagal mengirim pesan ke lawan chat.';
        if (sendError && sendError.response && sendError.response.description) {
          if (sendError.response.description.includes('bot was blocked by the user') || sendError.response.description.includes('user not found')) {
            errorMsg += '\n\nKemungkinan lawan chat belum pernah memulai chat dengan bot. Minta mereka untuk klik /start di bot ini agar bisa menerima pesan.';
          }
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

  /**
   * Create new chat session
   */
  async createChatSession(confessionId, confessorId, hitterId) {
    try {
      console.log(`Creating chat session: confession ${confessionId}, confessor ${confessorId}, hitter ${hitterId}`);

      const session = await Database.createChatSession(confessionId, confessorId, hitterId);
      console.log('Chat session created:', session.id);

      // Add users to active chat map
      this.activeChatUsers.set(hitterId, {
        sessionId: session.id,
        role: 'hitter',
        partnerId: confessorId
      });

      this.activeChatUsers.set(confessorId, {
        sessionId: session.id,
        role: 'confessor',
        partnerId: hitterId
      });

      console.log(`Added users to active chat map:`, {
        hitter: hitterId,
        confessor: confessorId,
        sessionId: session.id
      });

      return session;
    } catch (error) {
      console.error('Error creating chat session:', error);
      throw error;
    }
  }

  /**
   * End chat session
   */
  async endChatSession(ctx, userId) {
    try {
      console.log(`Ending chat session for user ${userId}`);

      if (!this.activeChatUsers.has(userId)) {
        console.log(`User ${userId} not in active chat`);
        return ctx.reply('❌ Kamu tidak sedang dalam chat anonymous.');
      }

      const userChatData = this.activeChatUsers.get(userId);
      const sessionId = userChatData.sessionId;
      const partnerId = userChatData.partnerId;

      const session = await Database.getChatSessionById(sessionId);

      if (!session) {
        console.log(`Session ${sessionId} not found`);
        this.activeChatUsers.delete(userId);
        return ctx.reply('❌ Session tidak ditemukan.');
      }

      // End session in database
      await Database.endChatSession(sessionId);
      console.log(`Session ${sessionId} ended in database`);

      // Remove both users from active chat map
      this.activeChatUsers.delete(session.confessor_id);
      this.activeChatUsers.delete(session.hitter_id);
      console.log(`Removed users from active chat map: ${session.confessor_id}, ${session.hitter_id}`);

      // Notify both users
      const endMessage = 
        '❌ *Chat Anonymous Berakhir*\n\n' +
        '👋 Chat session telah diakhiri.\n' +
        'Terima kasih telah menggunakan fitur anonymous chat!\n\n' +
        '💡 Kamu bisa memulai chat baru dengan hit confession lain.';

      await ctx.reply(endMessage, { parse_mode: 'Markdown' });

      // Notify the other user if still connected
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
   * Force end session (admin function)
   */
  async forceEndSession(userId) {
    try {
      console.log(`Force ending session for user ${userId}`);

      if (!this.activeChatUsers.has(userId)) {
        console.log(`User ${userId} not in active chat`);
        return false;
      }

      const chatData = this.activeChatUsers.get(userId);
      await Database.endChatSession(chatData.sessionId);

      // Remove both users
      this.activeChatUsers.delete(userId);
      if (chatData.partnerId) {
        this.activeChatUsers.delete(chatData.partnerId);
      }

      console.log(`Force ended session for user ${userId}`);
      return true;
    } catch (error) {
      console.error('Error in force end session:', error);
      return false;
    }
  }

  /**
   * Cleanup inactive sessions
   */
  async cleanupInactiveSessions() {
    try {
      console.log('Starting cleanup of inactive sessions');
      const activeSessions = await Database.getActiveSessions();

      let cleanedUsers = 0;
      for (const [userId, chatData] of this.activeChatUsers.entries()) {
        const sessionExists = activeSessions.some(session => 
          session.id === chatData.sessionId && session.is_active
        );

        if (!sessionExists) {
          console.log('Removing inactive user from chat map:', userId);
          this.activeChatUsers.delete(userId);
          cleanedUsers++;
        }
      }

      // Also cleanup database
      const cleanedCount = await Database.cleanupInactiveSessions();
      if (cleanedCount > 0 || cleanedUsers > 0) {
        console.log(`Cleaned up ${cleanedCount} inactive database sessions and ${cleanedUsers} inactive users`);
      }

    } catch (error) {
      console.error('Error in cleanup inactive sessions:', error);
    }
  }

  /**
   * Notify both users about session start
   */
  async notifySessionStart(confessorId, hitterId, sessionId) {
    try {
      console.log(`Notifying session start for session ${sessionId}`);

      const commonKeyboard = {
        inline_keyboard: [
          [
            { text: '🎭 Reveal', callback_data: `reveal_request_${sessionId}` },
            { text: '❌ End Chat', callback_data: 'end_chat' }
          ]
        ]
      };

      // Notify confessor
      try {
        await this.bot.telegram.sendMessage(
          confessorId,
          '✅ *Permintaan Hit Me Diterima!*\n\n' +
          '🔐 Chat anonymous telah dimulai!\n' +
          '👤 Kamu sekarang terhubung dengan penghit\n\n' +
          '📝 Ketik pesan untuk memulai percakapan\n' +
          '🎭 Identitas kalian masih tersembunyi\n\n' +
          '💡 *Perintah dalam chat:*\n' +
          '• `/reveal` - Minta reveal identitas\n' +
          '• `/endchat` - Akhiri percakapan',
          {
            parse_mode: 'Markdown',
            reply_markup: commonKeyboard
          }
        );
        console.log(`Notified confessor ${confessorId}`);
      } catch (error) {
        console.error(`Error notifying confessor ${confessorId}:`, error);
      }

      // Notify hitter
      try {
        await this.bot.telegram.sendMessage(
          hitterId,
          '🎉 *Hit Me Request Diterima!*\n\n' +
          '🔐 Chat anonymous telah dimulai!\n' +
          '👤 Pembuat confession menerima permintaan kamu\n\n' +
          '📝 Ketik pesan untuk memulai percakapan\n' +
          '🎭 Identitas kalian masih tersembunyi\n\n' +
          '💡 *Perintah dalam chat:*\n' +
          '• `/reveal` - Minta reveal identitas\n' +
          '• `/endchat` - Akhiri percakapan',
          {
            parse_mode: 'Markdown',
            reply_markup: commonKeyboard
          }
        );
        console.log(`Notified hitter ${hitterId}`);
      } catch (error) {
        console.error(`Error notifying hitter ${hitterId}:`, error);
      }

    } catch (error) {
      console.error('Error notifying session start:', error);
    }
  }

  // Debug method to check current state
  debugActiveUsers() {
    console.log('=== ACTIVE CHAT USERS DEBUG ===');
    console.log('Total active users:', this.activeChatUsers.size);
    for (const [userId, chatData] of this.activeChatUsers.entries()) {
      console.log(`User ${userId}:`, chatData);
    }
    console.log('===============================');
  }

  /**
   * Sync database sessions with memory - Clean up orphaned sessions
   */
  async syncSessionsWithDatabase() {
    try {
      console.log('=== SYNCING SESSIONS WITH DATABASE ===');

      // Get all active sessions from database
      const activeSessions = await Database.getActiveSessions();
      console.log('Active sessions in database:', activeSessions.length);

      // Check each session in database
      for (const session of activeSessions) {
        const confessorInMemory = this.activeChatUsers.has(session.confessor_id);
        const hitterInMemory = this.activeChatUsers.has(session.hitter_id);

        console.log(`Session ${session.id}: confessor_in_memory=${confessorInMemory}, hitter_in_memory=${hitterInMemory}`);

        // If session exists in database but both users are not in memory, 
        // it's an orphaned session - clean it up
        if (!confessorInMemory && !hitterInMemory) {
          console.log(`Cleaning up orphaned session ${session.id}`);
          await Database.endChatSession(session.id);
          continue;
        }

        // If only one user is in memory, remove the orphaned memory entry
        if (confessorInMemory && !hitterInMemory) {
          console.log(`Removing orphaned confessor ${session.confessor_id} from memory`);
          this.activeChatUsers.delete(session.confessor_id);
          await Database.endChatSession(session.id);
        } else if (!confessorInMemory && hitterInMemory) {
          console.log(`Removing orphaned hitter ${session.hitter_id} from memory`);
          this.activeChatUsers.delete(session.hitter_id);
          await Database.endChatSession(session.id);
        }
      }

      // Also check memory entries that don't exist in database
      const memoryUserIds = Array.from(this.activeChatUsers.keys());
      for (const userId of memoryUserIds) {
        const userChatData = this.activeChatUsers.get(userId);
        const sessionExists = activeSessions.some(session => 
          session.id === userChatData.sessionId && session.is_active
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
   * Force cleanup user session - for when user gets stuck
   */
  async forceCleanupUserSession(userId) {
    try {
      console.log(`=== FORCE CLEANUP FOR USER ${userId} ===`);

      // Remove from memory
      if (this.activeChatUsers.has(userId)) {
        const chatData = this.activeChatUsers.get(userId);
        console.log(`Removing user ${userId} from memory (session: ${chatData.sessionId})`);

        // Also remove partner if exists
        if (chatData.partnerId && this.activeChatUsers.has(chatData.partnerId)) {
          console.log(`Also removing partner ${chatData.partnerId} from memory`);
          this.activeChatUsers.delete(chatData.partnerId);
        }

        // End session in database
        await Database.endChatSession(chatData.sessionId);
        console.log(`Ended session ${chatData.sessionId} in database`);

        this.activeChatUsers.delete(userId);
      }

      // Also check database for any active sessions for this user
      const userActiveSessions = await Database.getActiveChatSession(userId);
      if (userActiveSessions) {
        console.log(`Found active session in database for user ${userId}, cleaning up...`);
        await Database.endChatSession(userActiveSessions.id);
      }

      console.log(`Force cleanup completed for user ${userId}`);
      return true;

    } catch (error) {
      console.error(`Error in force cleanup for user ${userId}:`, error);
      return false;
    }
  }

  // Utility methods
  getActiveUsers() {
    return Array.from(this.activeChatUsers.entries());
  }

  getActiveSessionCount() {
    return this.activeChatUsers.size;
  }

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

  getAllActiveSessions() {
    const sessions = new Map();
    for (const [userId, chatData] of this.activeChatUsers.entries()) {
      if (!sessions.has(chatData.sessionId)) {
        sessions.set(chatData.sessionId, {
          sessionId: chatData.sessionId,
          users: []
        });
      }
      sessions.get(chatData.sessionId).users.push({
        userId,
        role: chatData.role
      });
    }
    return Array.from(sessions.values());
  }
}