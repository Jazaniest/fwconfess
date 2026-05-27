import { Markup } from 'telegraf';
import { Database } from './database.js';
import { ChatManager } from './chat-manager.js';
import { RevealManager } from './reveal-manager.js';
import { RequestManager } from './request-manager.js';

/**
 * ✅ FIX BUG #6: Helper isAdmin terpusat, pakai ADMIN_ID dari env — bukan cek rank DB.
 * Sebelumnya semua command cek `user.rank !== 'Admin'` (kapital), padahal rank di DB
 * disimpan lowercase ('admin'). Selain itu admin_id dari env jauh lebih aman dan
 * tidak bergantung pada data di database yang bisa berubah.
 */
function isAdminUser(userId) {
  const adminId = process.env.ADMIN_ID;
  return adminId && userId.toString() === adminId.toString();
}

/**
 * Handler untuk fitur Hit Me dan Anonymous Chat
 * @param {Telegraf} bot
 */
export default function hitMeCommand(bot) {
  console.log('=== Hit Me command initializing ===');

  const chatManager = new ChatManager(bot);
  const revealManager = new RevealManager(bot, chatManager);
  const requestManager = new RequestManager(bot, chatManager);

  console.log('Managers created, setting up handlers...');

  requestManager.setupHandlers();
  chatManager.setupMessageHandler();
  revealManager.setupHandlers();
  setupChatManagementHandlers(bot, chatManager);
  setupAdminHandlers(bot, chatManager, requestManager);

  // Handler untuk tombol Hit Me
  bot.action(/^hitme_(\d+)$/, async (ctx) => {
    try {
      const confessionAuthorId = parseInt(ctx.match[1]);
      const hitterId = ctx.from.id;

      console.log('=== HIT ME CLICKED ===');
      console.log('Hit Me clicked by:', hitterId, 'for confession by:', confessionAuthorId);
      console.log('Chat type:', ctx.chat.type);

      if (ctx.chat.type !== 'private') {
        await ctx.answerCbQuery('🔄 Memproses Hit Me...', false);

        try {
          await processHitMeRequest(ctx, confessionAuthorId, hitterId, requestManager);
        } catch (privateError) {
          console.error('Error sending private message:', privateError);
          await ctx.answerCbQuery(
            '⚠️ Mohon start chat dengan bot terlebih dahulu untuk menggunakan Hit Me!',
            true
          );
        }
        return;
      }

      await ctx.answerCbQuery();
      await processHitMeRequest(ctx, confessionAuthorId, hitterId, requestManager);

    } catch (error) {
      console.error('Error in hit me handler:', error);
      await ctx.answerCbQuery('❌ Terjadi kesalahan. Silakan coba lagi nanti.', true);
    }
  });

  /**
   * Process Hit Me request
   */
  async function processHitMeRequest(ctx, confessionAuthorId, hitterId, requestManager) {
    try {
      console.log('=== PROCESSING HIT ME REQUEST ===');

      const validationResult = await validateHitMeRequest(confessionAuthorId, hitterId);
      console.log('Validation result:', validationResult.valid ? 'PASSED' : 'FAILED');

      if (!validationResult.valid) {
        const message = validationResult.message;
        const keyboard = validationResult.keyboard;

        if (ctx.chat.type === 'private') {
          return ctx.reply(message, keyboard || {});
        } else {
          return await ctx.telegram.sendMessage(hitterId, message, keyboard || {});
        }
      }

      const success = await requestManager.createHitMeRequest(
        ctx,
        confessionAuthorId,
        hitterId,
        validationResult.confession
      );

    } catch (error) {
      console.error('Error processing hit me request:', error);
      const errorMessage = '❌ Terjadi kesalahan. Silakan coba lagi nanti.';

      if (ctx.chat.type === 'private') {
        await ctx.reply(errorMessage);
      } else {
        await ctx.telegram.sendMessage(hitterId, errorMessage);
      }
    }
  }

  /**
   * Validate hit me request
   */
  async function validateHitMeRequest(confessionAuthorId, hitterId) {
    try {
      console.log('=== VALIDATING HIT ME REQUEST ===');

      await chatManager.syncSessionsWithDatabase();

      const hitter = await Database.getUserById(hitterId);
      if (!hitter) {
        return {
          valid: false,
          message: '❌ Kamu belum terdaftar!\n\nSilakan daftar terlebih dahulu untuk bisa menggunakan fitur Hit Me.',
          keyboard: Markup.inlineKeyboard([
            [Markup.button.callback('📝 Daftar Sekarang', 'btn_register')]
          ])
        };
      }

      if (confessionAuthorId === hitterId) {
        return { valid: false, message: '❌ Kamu tidak bisa hit confession sendiri!' };
      }

      const confessor = await Database.getUserById(confessionAuthorId);
      if (!confessor) {
        return { valid: false, message: '❌ Pembuat confession tidak ditemukan atau belum terdaftar.' };
      }

      // Cek dan bersihkan session hitter yang orphaned
      const hitterInMemory = chatManager.isUserInChat(hitterId);
      const existingHitterSession = await Database.getActiveChatSession(hitterId);

      if (existingHitterSession && !hitterInMemory) {
        await chatManager.forceCleanupUserSession(hitterId);
      } else if (!existingHitterSession && hitterInMemory) {
        await chatManager.forceCleanupUserSession(hitterId);
      } else if (existingHitterSession && hitterInMemory) {
        return {
          valid: false,
          message: '⚠️ Kamu sudah memiliki chat session yang aktif!\n\nSelesaikan chat yang sedang berlangsung terlebih dahulu.',
          keyboard: Markup.inlineKeyboard([
            [Markup.button.callback('💬 Lanjut Chat', 'continue_chat')],
            [Markup.button.callback('❌ End Chat', 'end_chat')],
            [Markup.button.callback('🔧 Force Cleanup', `force_cleanup_${hitterId}`)]
          ])
        };
      }

      // Cek dan bersihkan session confessor yang orphaned
      const confessorInMemory = chatManager.isUserInChat(confessionAuthorId);
      const confessionOwnerSession = await Database.getActiveChatSession(confessionAuthorId);

      if (confessionOwnerSession && !confessorInMemory) {
        await chatManager.forceCleanupUserSession(confessionAuthorId);
      } else if (!confessionOwnerSession && confessorInMemory) {
        await chatManager.forceCleanupUserSession(confessionAuthorId);
      } else if (confessionOwnerSession && confessorInMemory) {
        return { valid: false, message: '❌ Pembuat confession sedang dalam chat dengan user lain. Coba lagi nanti.' };
      }

      const confession = await Database.getLatestConfessionByUserId(confessionAuthorId);
      if (!confession) {
        return { valid: false, message: '❌ Data confession tidak ditemukan.' };
      }

      return { valid: true, confession };

    } catch (error) {
      console.error('Error in validation:', error);
      return { valid: false, message: '❌ Terjadi kesalahan saat validasi. Silakan coba lagi.' };
    }
  }

  setupCleanup(chatManager, requestManager);
  console.log('=== Hit Me command initialization complete ===');

  return {
    chatManager,
    revealManager,
    requestManager,
    getActiveChatUsers: () => chatManager.getActiveUsers(),
    getPendingRequests: () => requestManager.getPendingRequests(),
    getActiveSessionCount: () => chatManager.getActiveSessionCount(),
    getPendingRequestCount: () => requestManager.getPendingRequestCount(),
    forceEndSession: async (userId) => await chatManager.forceEndSession(userId),
    clearPendingRequest: (requestId) => requestManager.clearPendingRequest(requestId),
    isUserInChat: (userId) => chatManager.isUserInChat(userId),
    getUserChatInfo: (userId) => chatManager.getUserChatInfo(userId),
    getAllActiveSessions: () => chatManager.getAllActiveSessions(),
    debugActiveUsers: () => chatManager.debugActiveUsers()
  };
}

// ─── Chat Management Handlers ────────────────────────────────────────────────

function setupChatManagementHandlers(bot, chatManager) {
  console.log('Setting up chat management handlers...');

  bot.command('endchat', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    await chatManager.endChatSession(ctx, ctx.from.id);
  });

  bot.action('end_chat', async (ctx) => {
    await ctx.answerCbQuery();
    await chatManager.endChatSession(ctx, ctx.from.id);
  });

  bot.action('continue_chat', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
      '💬 *Chat Anonymous Berlanjut*\n\n' +
      'Ketik pesan untuk melanjutkan percakapan dengan lawan chat kamu.\n\n' +
      '💡 *Perintah yang tersedia:*\n' +
      '• `/reveal` - Minta reveal identitas\n' +
      '• `/endchat` - Akhiri percakapan',
      { parse_mode: 'Markdown' }
    );
  });

  bot.action(/^force_cleanup_(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const targetUserId = parseInt(ctx.match[1]);
      const currentUserId = ctx.from.id;

      if (targetUserId !== currentUserId) {
        return ctx.reply('❌ Kamu hanya bisa cleanup session sendiri.');
      }

      const success = await chatManager.forceCleanupUserSession(targetUserId);
      if (success) {
        await ctx.reply(
          '✅ *Session Berhasil Di-cleanup!*\n\n' +
          '🧹 Data chat yang bermasalah telah dibersihkan\n' +
          '💡 Sekarang kamu bisa mencoba hit confession lagi',
          { parse_mode: 'Markdown' }
        );
      } else {
        await ctx.reply('❌ Gagal cleanup session. Silakan coba lagi atau hubungi admin.');
      }
    } catch (error) {
      console.error('Error in force cleanup handler:', error);
      await ctx.reply('❌ Terjadi kesalahan saat cleanup session.');
    }
  });

  console.log('Chat management handlers set up successfully');
}

// ─── Admin Handlers ───────────────────────────────────────────────────────────

function setupAdminHandlers(bot, chatManager, requestManager) {
  console.log('Setting up admin handlers...');

  // ✅ FIX BUG #6: Semua pengecekan admin diganti dari `user.rank !== 'Admin'`
  // (yang selalu gagal karena DB simpan lowercase 'admin') menjadi isAdminUser()
  // yang cek ADMIN_ID dari env — konsisten, tidak bergantung kolom rank di DB.

  bot.command('chatstatus', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    if (!isAdminUser(ctx.from.id)) return ctx.reply('❌ Command ini hanya untuk admin.');

    const activeCount = chatManager.getActiveSessionCount();
    const pendingCount = requestManager.getPendingRequestCount();

    let statusMessage = `📊 *Status Anonymous Chat*\n\n`;
    statusMessage += `👥 Active Chat Users: ${activeCount}\n`;
    statusMessage += `⏳ Pending Requests: ${pendingCount}\n\n`;

    if (activeCount > 0) {
      statusMessage += `*Active Sessions:*\n`;
      const activeSessions = chatManager.getAllActiveSessions();
      activeSessions.forEach(session => {
        statusMessage += `• Session ${session.sessionId}: `;
        session.users.forEach((user, index) => {
          statusMessage += `${user.userId} (${user.role})`;
          if (index < session.users.length - 1) statusMessage += ', ';
        });
        statusMessage += '\n';
      });
    }

    await ctx.reply(statusMessage, { parse_mode: 'Markdown' });
  });

  bot.command('forceend', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    if (!isAdminUser(ctx.from.id)) return ctx.reply('❌ Command ini hanya untuk admin.');

    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply('❌ Gunakan: /forceend <user_id>');

    const targetUserId = parseInt(args[1]);
    if (isNaN(targetUserId)) return ctx.reply('❌ User ID harus berupa angka.');

    const success = await chatManager.forceEndSession(targetUserId);
    await ctx.reply(
      success
        ? `✅ Session untuk user ${targetUserId} berhasil diakhiri.`
        : `❌ User ${targetUserId} tidak sedang dalam chat session.`
    );
  });

  bot.command('debugchat', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    if (!isAdminUser(ctx.from.id)) return ctx.reply('❌ Command ini hanya untuk admin.');

    chatManager.debugActiveUsers();
    await ctx.reply('🔍 Debug info printed to console. Check server logs.');
  });

  bot.command('syncsessions', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    if (!isAdminUser(ctx.from.id)) return ctx.reply('❌ Command ini hanya untuk admin.');

    await ctx.reply('🔄 Syncing sessions with database...');
    await chatManager.syncSessionsWithDatabase();
    await ctx.reply('✅ Sessions synced successfully!');
  });

  bot.command('forceuser', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    if (!isAdminUser(ctx.from.id)) return ctx.reply('❌ Command ini hanya untuk admin.');

    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply('❌ Gunakan: /forceuser <user_id>');

    const targetUserId = parseInt(args[1]);
    if (isNaN(targetUserId)) return ctx.reply('❌ User ID harus berupa angka.');

    const success = await chatManager.forceCleanupUserSession(targetUserId);
    await ctx.reply(
      success
        ? `✅ Force cleanup untuk user ${targetUserId} berhasil.`
        : `❌ Gagal force cleanup untuk user ${targetUserId}.`
    );
  });

  console.log('Admin handlers set up successfully');
}

// ─── Cleanup Interval ─────────────────────────────────────────────────────────

function setupCleanup(chatManager, requestManager) {
  setInterval(async () => {
    try {
      await requestManager.cleanupExpiredRequests();
      await chatManager.cleanupInactiveSessions();
      console.log(
        'Cleanup completed - Active sessions:',
        chatManager.getActiveSessionCount(),
        'Pending requests:',
        requestManager.getPendingRequestCount()
      );
    } catch (error) {
      console.error('Error in cleanup:', error);
    }
  }, 30 * 60 * 1000); // Setiap 30 menit
}