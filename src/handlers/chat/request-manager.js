import { getActiveChatSession } from '../../repositories/chat.repo.js';
import { getConfig, getConfigs } from '../../repositories/config.repo.js';
import {
  countRecentActions, getOldestActionTime,
  recordActionSent, getActionLimitByRank
} from '../../repositories/confession.repo.js';
import { getUserById } from '../../repositories/user.repo.js';
import { getEffectiveRank } from '../../repositories/confession.repo.js';

/**
 * Request Manager — Handles Hit Me requests and approvals.
 *
 * Dipindah dari: src/commands/request-manager.js
 * Import DB langsung dari repositories/ (bukan lewat Database shim).
 */
export class RequestManager {
  constructor(bot, chatManager) {
    this.bot = bot;
    this.chatManager = chatManager;
    this.pendingHitMeRequests = new Map(); // requestId → { hitterId, confessionAuthorId, confessionId, timestamp }
    this.ownerQueues = new Map();          // confessionAuthorId → requestId[]
  }

  // ─── Rate limit helper ────────────────────────────────────────────────────

  async _getRLConfig(userId) {
    const windowHours  = parseFloat(await getConfig('confession_window_hours', '8'));
    const effectiveRank = await getEffectiveRank(userId);
    const maxCount     = await getActionLimitByRank(effectiveRank, 'hitme');
    return {
      maxCount,
      windowMs: windowHours * 60 * 60 * 1000,
      windowHours,
    };
  }

  // ─── Handler setup ────────────────────────────────────────────────────────

  setupHandlers() {
    console.log('Setting up request handlers...');

    this.bot.action(/^approve_hitme_(.+)$/, async (ctx) => {
      try {
        console.log('Approve hit me button clicked by:', ctx.from.id);
        await ctx.answerCbQuery();
        await this.approveHitMeRequest(ctx, ctx.match[1]);
      } catch (error) {
        console.error('Error approving hit me request:', error);
        await ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi.');
      }
    });

    this.bot.action(/^decline_hitme_(.+)$/, async (ctx) => {
      try {
        console.log('Decline hit me button clicked by:', ctx.from.id);
        await ctx.answerCbQuery();
        await this.declineHitMeRequest(ctx, ctx.match[1]);
      } catch (error) {
        console.error('Error declining hit me request:', error);
        await ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi.');
      }
    });

    console.log('Request handlers set up successfully');
  }

  // ─── Create request ───────────────────────────────────────────────────────

  async createHitMeRequest(ctx, confessionAuthorId, hitterId, confession) {
    try {
      console.log('=== CREATING HIT ME REQUEST ===');
      console.log('Confessor:', confessionAuthorId, 'Hitter:', hitterId);

      // Rate limit check
      const rlCfg       = await this._getRLConfig(hitterId);
      const recentCount = await countRecentActions(hitterId, 'hitme', rlCfg.windowMs);

      if (recentCount >= rlCfg.maxCount) {
        const oldest      = await getOldestActionTime(hitterId, 'hitme', rlCfg.windowMs);
        const nextAllowed = new Date(oldest.getTime() + rlCfg.windowMs);
        const msg = `⏰ Kamu sudah melakukan Hit Me ${rlCfg.maxCount}x dalam ${rlCfg.windowHours} jam terakhir.\n\nCoba lagi setelah: *${nextAllowed.toLocaleString('id-ID')}*`;

        if (ctx.chat?.type === 'private') {
          await ctx.reply(msg, { parse_mode: 'Markdown' });
        } else {
          await ctx.telegram.sendMessage(hitterId, msg, { parse_mode: 'Markdown' });
        }
        return false;
      }

      // Cek request duplikat
      const existingRequest = Array.from(this.pendingHitMeRequests.values()).find(
        req => req.hitterId === hitterId && req.confessionAuthorId === confessionAuthorId
      );
      if (existingRequest) {
        const message = '⏳ Kamu sudah mengirim permintaan Hit Me ke pembuat confession ini. Tunggu respon mereka.';
        if (ctx.chat.type === 'private') {
          await ctx.reply(message);
        } else {
          await ctx.telegram.sendMessage(hitterId, message);
        }
        return false;
      }

      const requestId = Date.now().toString();
      console.log('Generated request ID:', requestId);

      this.pendingHitMeRequests.set(requestId, {
        hitterId,
        confessionAuthorId,
        confessionId: confession.id,
        timestamp: Date.now()
      });

      // Masukkan ke antrian owner
      const queue = this.ownerQueues.get(confessionAuthorId) || [];
      queue.push(requestId);
      this.ownerQueues.set(confessionAuthorId, queue);
      console.log(`📋 Queue owner ${confessionAuthorId}: ${queue.length} request(s)`);

      // Kirim notif ke owner hanya jika ini request pertama di antrian
      if (queue.length === 1) {
        const hitterInfo = await this.getHitterDisplayInfo(ctx, hitterId);
        console.log('Got hitter info:', hitterInfo);

        try {
          await ctx.telegram.sendMessage(
            confessionAuthorId,
            `💝 *Hit Me Request!*\n\n` +
            `🎯 Seseorang ingin chat dengan kamu terkait confession kamu!\n\n` +
            `👤 **Info Hitter:**\n` +
            `• Gender: ${hitterInfo.gender}\n` +
            `• Origin: ${hitterInfo.origin}\n` +
            `• Rank: ${hitterInfo.rank}\n\n` +
            `🤔 **Apakah kamu mau chat anonymous dengan orang ini?**\n\n` +
            `✅ Jika setuju, kalian akan chat secara anonymous\n` +
            `❌ Jika tidak, permintaan akan ditolak\n\n` +
            `⏰ *Permintaan ini akan expired dalam 10 menit*`,
            {
              parse_mode: 'Markdown',
              link_preview_options: { is_disabled: true },
              reply_markup: {
                inline_keyboard: [[
                  { text: '✅ Terima', callback_data: `approve_hitme_${requestId}` },
                  { text: '❌ Tolak',  callback_data: `decline_hitme_${requestId}` }
                ]]
              }
            }
          );
          console.log('Approval request sent to confessor successfully');
        } catch (sendError) {
          console.error('Error sending approval request to confessor:', sendError);
          // Rollback jika gagal kirim
          this.pendingHitMeRequests.delete(requestId);
          this.ownerQueues.set(confessionAuthorId, queue.filter(id => id !== requestId));
          return false;
        }
      }

      // Catat ke DB
      await recordActionSent(hitterId, 'hitme');

      const successMessage =
        '📤 *Permintaan Hit Me Terkirim!*\n\n' +
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
      } catch (notifyError) {
        console.error('Error sending success message to hitter:', notifyError);
      }

      return true;

    } catch (error) {
      console.error('Fatal error in createHitMeRequest:', error);
      return false;
    }
  }

  // ─── Approve / Decline ────────────────────────────────────────────────────

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

      // Double-check kedua user belum ada session lain
      const hitterSession   = await getActiveChatSession(hitterId);
      const confessorSession = await getActiveChatSession(confessionAuthorId);

      if (hitterSession) {
        await this.finishAndDequeue(ctx, confessionAuthorId, requestId);
        return ctx.editMessageText('❌ Penghit sudah dalam chat dengan orang lain.');
      }
      if (confessorSession) {
        await this.finishAndDequeue(ctx, confessionAuthorId, requestId);
        return ctx.editMessageText('❌ Kamu sudah dalam chat dengan orang lain.');
      }

      const session = await this.chatManager.createChatSession(confessionId, confessionAuthorId, hitterId);
      console.log('Chat session created with ID:', session.id);

      await this.finishAndDequeue(ctx, confessionAuthorId, requestId);

      const endChatKeyboard = { inline_keyboard: [[{ text: '❌ End Chat', callback_data: 'end_chat' }]] };
      const chatStartedMsg  = (isConfessor) =>
        isConfessor
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

      // Update pesan approve ke confessor
      try {
        await ctx.editMessageText(chatStartedMsg(true), { parse_mode: 'Markdown', reply_markup: endChatKeyboard });
      } catch (editError) {
        console.error('Error editing approval message:', editError);
      }

      // Notify hitter
      try {
        await ctx.telegram.sendMessage(hitterId, chatStartedMsg(false), { parse_mode: 'Markdown', reply_markup: endChatKeyboard });
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

  async declineHitMeRequest(ctx, requestId) {
    try {
      console.log('=== DECLINING HIT ME REQUEST ===');

      const request = this.pendingHitMeRequests.get(requestId);
      if (!request) {
        return ctx.editMessageText('❌ Permintaan sudah expired atau tidak valid.');
      }

      const { hitterId } = request;

      await this.finishAndDequeue(ctx, request.confessionAuthorId, requestId);

      try {
        await ctx.editMessageText(
          '❌ *Permintaan Hit Me Ditolak*\n\n' +
          '👋 Kamu telah menolak permintaan chat anonymous.\n' +
          '💡 Penghit akan mendapat notifikasi bahwa permintaan ditolak.',
          { parse_mode: 'Markdown' }
        );
      } catch (editError) {
        console.error('Error editing decline message:', editError);
      }

      try {
        await ctx.telegram.sendMessage(
          hitterId,
          '😔 *Permintaan Hit Me Ditolak*\n\n' +
          '❌ Pembuat confession menolak permintaan chat kamu\n' +
          '🎯 Jangan berkecil hati, coba hit confession lain!\n\n' +
          '💡 Mungkin mereka sedang tidak ingin chat atau sudah ada yang lain.',
          { parse_mode: 'Markdown' }
        );
      } catch (notifyError) {
        console.error('Error notifying hitter about decline:', notifyError);
      }

      return true;

    } catch (error) {
      console.error('Error in decline hit me request:', error);
      await ctx.editMessageText('❌ Terjadi kesalahan saat menolak permintaan.');
      return false;
    }
  }

  // ─── Queue management ─────────────────────────────────────────────────────

  async finishAndDequeue(ctx, ownerId, doneRequestId) {
    const queue    = this.ownerQueues.get(ownerId) || [];
    const newQueue = queue.filter(id => id !== doneRequestId);
    this.pendingHitMeRequests.delete(doneRequestId);

    if (newQueue.length === 0) {
      this.ownerQueues.delete(ownerId);
      return;
    }

    this.ownerQueues.set(ownerId, newQueue);

    const nextRequestId = newQueue[0];
    const nextRequest   = this.pendingHitMeRequests.get(nextRequestId);
    if (!nextRequest) {
      await this.finishAndDequeue(ctx, ownerId, nextRequestId);
      return;
    }

    try {
      const hitterInfo = await this.getHitterDisplayInfo(ctx, nextRequest.hitterId);
      await ctx.telegram.sendMessage(
        ownerId,
        `💝 *Hit Me Request!*\n\n` +
        `🎯 Seseorang ingin chat dengan kamu terkait confession kamu!\n\n` +
        `👤 **Info Hitter:**\n` +
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
            inline_keyboard: [[
              { text: '✅ Terima', callback_data: `approve_hitme_${nextRequestId}` },
              { text: '❌ Tolak',  callback_data: `decline_hitme_${nextRequestId}` }
            ]]
          }
        }
      );
    } catch (err) {
      console.error('Error sending next queued hit me request:', err);
      await this.finishAndDequeue(ctx, ownerId, nextRequestId);
    }
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  async cleanupExpiredRequests() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [requestId, request] of Array.from(this.pendingHitMeRequests.entries())) {
      if (now - request.timestamp > 10 * 60 * 1000) {
        this.pendingHitMeRequests.delete(requestId);
        cleanedCount++;

        const ownerId = request.confessionAuthorId;
        const queue   = this.ownerQueues.get(ownerId);
        if (queue) {
          const newQueue = queue.filter(id => id !== requestId);
          if (newQueue.length === 0) this.ownerQueues.delete(ownerId);
          else this.ownerQueues.set(ownerId, newQueue);
        }
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired hit me requests`);
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  async getHitterDisplayInfo(ctx, hitterId) {
    try {
      const hitter           = await getUserById(hitterId);
      const hitterTelegramInfo = await ctx.telegram.getChat(hitterId);
      const hitterName       = `${hitterTelegramInfo.first_name}${hitterTelegramInfo.last_name ? ' ' + hitterTelegramInfo.last_name : ''}`;
      return {
        name    : hitterName,
        username: hitterTelegramInfo.username || 'Tidak ada',
        gender  : hitter?.gender || 'Unknown',
        origin  : hitter?.origin || 'Unknown',
        rank    : hitter?.rank   || 'Member',
      };
    } catch (error) {
      console.error('Error getting hitter info:', error);
      const hitter = await getUserById(hitterId);
      return {
        name    : 'Unknown User',
        username: 'Tidak ada',
        gender  : hitter?.gender || 'Unknown',
        origin  : hitter?.origin || 'Unknown',
        rank    : hitter?.rank   || 'Member',
      };
    }
  }

  // ─── Accessors ────────────────────────────────────────────────────────────

  getPendingRequests()              { return Array.from(this.pendingHitMeRequests.entries()); }
  getPendingRequestCount()          { return this.pendingHitMeRequests.size; }
  clearPendingRequest(requestId)    { return this.pendingHitMeRequests.delete(requestId); }
  hasPendingRequest(hitterId, confessionAuthorId) {
    return Array.from(this.pendingHitMeRequests.values()).some(
      req => req.hitterId === hitterId && req.confessionAuthorId === confessionAuthorId
    );
  }

  debugPendingRequests() {
    console.log('=== PENDING REQUESTS DEBUG ===');
    console.log('Total pending requests:', this.pendingHitMeRequests.size);
    for (const [requestId, request] of this.pendingHitMeRequests.entries()) {
      console.log(`Request ${requestId}:`, request);
    }
    console.log('==============================');
  }
}