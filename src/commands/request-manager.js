import { Markup } from 'telegraf';
import { Database } from './database.js';

/**
 * Request Manager - Handles Hit Me requests and approvals
 */
export class RequestManager {
  constructor(bot, chatManager) {
    this.bot = bot;
    this.chatManager = chatManager;
    this.pendingHitMeRequests = new Map();
  }

  /**
   * Setup request handlers
   */
  setupHandlers() {
    console.log('Setting up request handlers...');

    // Handler untuk approve hit me request
    this.bot.action(/^approve_hitme_(.+)$/, async (ctx) => {
      try {
        console.log('Approve hit me button clicked by:', ctx.from.id);
        await ctx.answerCbQuery();
        const requestId = ctx.match[1];
        console.log('Processing approve request for ID:', requestId);
        await this.approveHitMeRequest(ctx, requestId);
      } catch (error) {
        console.error('Error approving hit me request:', error);
        await ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi.');
      }
    });

    // Handler untuk decline hit me request
    this.bot.action(/^decline_hitme_(.+)$/, async (ctx) => {
      try {
        console.log('Decline hit me button clicked by:', ctx.from.id);
        await ctx.answerCbQuery();
        const requestId = ctx.match[1];
        console.log('Processing decline request for ID:', requestId);
        await this.declineHitMeRequest(ctx, requestId);
      } catch (error) {
        console.error('Error declining hit me request:', error);
        await ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi.');
      }
    });

    console.log('Request handlers set up successfully');
  }

  /**
   * Create hit me request
   */
  async createHitMeRequest(ctx, confessionAuthorId, hitterId, confession) {
    try {
      console.log('=== CREATING HIT ME REQUEST ===');
      console.log('Confessor:', confessionAuthorId, 'Hitter:', hitterId);

      // Check if there's already a pending request from this hitter to this confessor
      const existingRequest = Array.from(this.pendingHitMeRequests.values()).find(
        req => req.hitterId === hitterId && req.confessionAuthorId === confessionAuthorId
      );

      if (existingRequest) {
        console.log('Existing request found, notifying user');
        const message = '⏳ Kamu sudah mengirim permintaan Hit Me ke pembuat confession ini. Tunggu respon mereka.';
        if (ctx.chat.type === 'private') {
          await ctx.reply(message);
        } else {
          await ctx.telegram.sendMessage(hitterId, message);
        }
        return false;
      }

      // Generate unique request ID
      const requestId = Date.now().toString();
      console.log('Generated request ID:', requestId);

      // Store pending request
      this.pendingHitMeRequests.set(requestId, {
        hitterId,
        confessionAuthorId,
        confessionId: confession.id,
        timestamp: Date.now()
      });
      console.log('Stored pending request, total pending:', this.pendingHitMeRequests.size);

      // Get hitter info for display
      const hitterInfo = await this.getHitterDisplayInfo(ctx, hitterId);
      console.log('Got hitter info:', hitterInfo);

      console.log('Sending approval request to confessor...');
      // Send approval request to confession author
      try {
        await ctx.telegram.sendMessage(
          confessionAuthorId,
          `💝 *Hit Me Request!*\n\n` +
          `🎯 Seseorang ingin chat dengan kamu terkait confession kamu!\n\n` +
          `👤 **Info Penghit:**\n` +
          `• Nama: ${hitterInfo.name}\n` +
          `• Username: @${hitterInfo.username}\n` +
          `• Gender: ${hitterInfo.gender}\n` +
          `• Origin: ${hitterInfo.origin}\n` +
          `• Rank: ${hitterInfo.rank}\n\n` +
          `🤔 **Apakah kamu mau chat anonymous dengan orang ini?**\n\n` +
          `✅ Jika setuju, kalian akan chat secara anonymous\n` +
          `❌ Jika tidak, permintaan akan ditolak\n\n` +
          `⏰ *Permintaan ini akan expired dalam 10 menit*`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ Terima', callback_data: `approve_hitme_${requestId}` },
                  { text: '❌ Tolak', callback_data: `decline_hitme_${requestId}` }
                ]
              ]
            }
          }
        );
        console.log('Approval request sent to confessor successfully');
      } catch (sendError) {
        console.error('Error sending approval request to confessor:', sendError);
        this.pendingHitMeRequests.delete(requestId);
        return false;
      }

      // Notify hitter that request has been sent
      const successMessage = '📤 *Permintaan Hit Me Terkirim!*\n\n' +
        '⏳ Permintaan kamu telah dikirim ke pembuat confession\n' +
        '🔔 Mereka akan mendapat notifikasi di bot pribadi\n' +
        '⏱️ Tunggu persetujuan dari mereka\n\n' +
        '💡 *Permintaan akan expired dalam 10 menit*';

      try {
        if (ctx.chat.type === 'private') {
          await ctx.reply(successMessage, { parse_mode: 'Markdown' });
        } else {
          await ctx.telegram.sendMessage(hitterId, successMessage, { parse_mode: 'Markdown' });
        }
        console.log('Success message sent to hitter');
      } catch (notifyError) {
        console.error('Error sending success message to hitter:', notifyError);
      }

      // Auto-expire request after 10 minutes
      setTimeout(() => {
        if (this.pendingHitMeRequests.has(requestId)) {
          this.pendingHitMeRequests.delete(requestId);
          console.log('Hit me request auto-expired:', requestId);
        }
      }, 10 * 60 * 1000);

      console.log('Hit me request created successfully');
      return true;

    } catch (error) {
      console.error('Error creating hit me request:', error);
      return false;
    }
  }

  /**
   * Get hitter display info
   */
  async getHitterDisplayInfo(ctx, hitterId) {
    try {
      const hitter = await Database.getUserById(hitterId);
      const hitterTelegramInfo = await ctx.telegram.getChat(hitterId);
      const hitterName = `${hitterTelegramInfo.first_name}${hitterTelegramInfo.last_name ? ' ' + hitterTelegramInfo.last_name : ''}`;

      return {
        name: hitterName,
        username: hitterTelegramInfo.username || 'Tidak ada',
        gender: hitter.gender || 'Unknown',
        origin: hitter.origin || 'Unknown',
        rank: hitter.rank || 'Member'
      };
    } catch (error) {
      console.error('Error getting hitter info:', error);
      const hitter = await Database.getUserById(hitterId);
      return {
        name: 'Unknown User',
        username: 'Tidak ada',
        gender: hitter?.gender || 'Unknown',
        origin: hitter?.origin || 'Unknown',
        rank: hitter?.rank || 'Member'
      };
    }
  }

  /**
   * Approve hit me request
   */
  async approveHitMeRequest(ctx, requestId) {
    try {
      console.log('=== APPROVING HIT ME REQUEST ===');
      console.log('Request ID:', requestId);

      const request = this.pendingHitMeRequests.get(requestId);
      if (!request) {
        console.log('Request not found or expired');
        return ctx.editMessageText('❌ Permintaan sudah expired atau tidak valid.');
      }

      const { hitterId, confessionAuthorId, confessionId } = request;
      console.log('Request details:', { hitterId, confessionAuthorId, confessionId });

      // Double check if both users are still available
      const hitterSession = await Database.getActiveChatSession(hitterId);
      const confessionOwnerSession = await Database.getActiveChatSession(confessionAuthorId);

      if (hitterSession) {
        console.log('Hitter already has active session');
        this.pendingHitMeRequests.delete(requestId);
        return ctx.editMessageText('❌ Penghit sudah dalam chat dengan orang lain.');
      }

      if (confessionOwnerSession) {
        console.log('Confession owner already has active session');
        this.pendingHitMeRequests.delete(requestId);
        return ctx.editMessageText('❌ Kamu sudah dalam chat dengan orang lain.');
      }

      console.log('Creating chat session...');
      // Create chat session
      const session = await this.chatManager.createChatSession(confessionId, confessionAuthorId, hitterId);
      console.log('Chat session created with ID:', session.id);

      // Remove from pending requests
      this.pendingHitMeRequests.delete(requestId);
      console.log('Removed request from pending list');

      console.log('Updating approval message...');
      // Update message to show approval
      try {
        await ctx.editMessageText(
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
            reply_markup: {
              inline_keyboard: [
                [{ text: '❌ End Chat', callback_data: 'end_chat' }]
              ]
            }
          }
        );
        console.log('Approval message updated successfully');
      } catch (editError) {
        console.error('Error editing approval message:', editError);
      }

      console.log('Notifying hitter...');
      // Notify hitter
      try {
        await ctx.telegram.sendMessage(
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
            reply_markup: {
              inline_keyboard: [
                [{ text: '❌ End Chat', callback_data: 'end_chat' }]
              ]
            }
          }
        );
        console.log('Hitter notified successfully');
      } catch (notifyError) {
        console.error('Error notifying hitter:', notifyError);
      }

      console.log('Hit me request approved successfully');
      return true;

    } catch (error) {
      console.error('Error in approve hit me request:', error);
      await ctx.editMessageText('❌ Terjadi kesalahan saat memproses persetujuan.');
      return false;
    }
  }

  /**
   * Decline hit me request
   */
  async declineHitMeRequest(ctx, requestId) {
    try {
      console.log('=== DECLINING HIT ME REQUEST ===');
      console.log('Request ID:', requestId);

      const request = this.pendingHitMeRequests.get(requestId);
      if (!request) {
        console.log('Request not found or expired');
        return ctx.editMessageText('❌ Permintaan sudah expired atau tidak valid.');
      }

      const { hitterId } = request;
      console.log('Declining request for hitter:', hitterId);

      // Remove from pending requests
      this.pendingHitMeRequests.delete(requestId);
      console.log('Removed request from pending list');

      // Notify confessor
      try {
        await ctx.editMessageText(
          '❌ *Permintaan Hit Me Ditolak*\n\n' +
          '👋 Kamu telah menolak permintaan chat anonymous.\n' +
          '💡 Penghit akan mendapat notifikasi bahwa permintaan ditolak.',
          { parse_mode: 'Markdown' }
        );
        console.log('Confessor notified about decline');
      } catch (editError) {
        console.error('Error editing decline message:', editError);
      }

      // Notify hitter
      try {
        await ctx.telegram.sendMessage(
          hitterId,
          '😔 *Permintaan Hit Me Ditolak*\n\n' +
          '❌ Pembuat confession menolak permintaan chat kamu\n' +
          '🎯 Jangan berkecil hati, coba hit confession lain!\n\n' +
          '💡 Mungkin mereka sedang tidak ingin chat atau sudah ada yang lain.',
          { parse_mode: 'Markdown' }
        );
        console.log('Hitter notified about decline');
      } catch (notifyError) {
        console.error('Error notifying hitter about decline:', notifyError);
      }

      console.log('Hit me request declined successfully');
      return true;

    } catch (error) {
      console.error('Error in decline hit me request:', error);
      await ctx.editMessageText('❌ Terjadi kesalahan saat menolak permintaan.');
      return false;
    }
  }

  /**
   * Cleanup expired requests
   */
  async cleanupExpiredRequests() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [requestId, request] of this.pendingHitMeRequests.entries()) {
      if (now - request.timestamp > 10 * 60 * 1000) { // 10 minutes
        this.pendingHitMeRequests.delete(requestId);
        cleanedCount++;
        console.log('Expired hit me request removed:', requestId);
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired hit me requests`);
    }
  }

  // Debug method
  debugPendingRequests() {
    console.log('=== PENDING REQUESTS DEBUG ===');
    console.log('Total pending requests:', this.pendingHitMeRequests.size);
    for (const [requestId, request] of this.pendingHitMeRequests.entries()) {
      console.log(`Request ${requestId}:`, request);
    }
    console.log('==============================');
  }

  // Utility methods
  getPendingRequests() {
    return Array.from(this.pendingHitMeRequests.entries());
  }

  getPendingRequestCount() {
    return this.pendingHitMeRequests.size;
  }

  clearPendingRequest(requestId) {
    return this.pendingHitMeRequests.delete(requestId);
  }

  hasPendingRequest(hitterId, confessionAuthorId) {
    return Array.from(this.pendingHitMeRequests.values()).some(
      req => req.hitterId === hitterId && req.confessionAuthorId === confessionAuthorId
    );
  }
}