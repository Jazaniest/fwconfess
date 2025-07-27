import { Markup } from 'telegraf';
import { Database } from './database.js';
import { ChatManager } from './chat-manager.js';
import { RevealManager } from './reveal-manager.js';
import { RequestManager } from './request-manager.js';

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

  // Setup all handlers FIRST before any other logic
  console.log('Setting up request handlers...');
  requestManager.setupHandlers();

  console.log('Setting up chat message handlers...');
  chatManager.setupMessageHandler();

  console.log('Setting up reveal handlers...');
  revealManager.setupHandlers();

  console.log('Setting up chat management handlers...');
  setupChatManagementHandlers(bot, chatManager);

  console.log('Setting up admin handlers...');
  setupAdminHandlers(bot, chatManager, requestManager);

  // Handler untuk tombol Hit Me
  bot.action(/^hitme_(\d+)$/, async (ctx) => {
    try {
      const confessionAuthorId = parseInt(ctx.match[1]);
      const hitterId = ctx.from.id;

      console.log('=== HIT ME CLICKED ===');
      console.log('Hit Me clicked by:', hitterId, 'for confession by:', confessionAuthorId);
      console.log('Chat type:', ctx.chat.type);

      // Check if this is from a group/channel - if so, only send private message
      if (ctx.chat.type !== 'private') {
        console.log('Hit Me clicked from group/channel, redirecting to private');
        // Answer callback query with minimal response to prevent group notification
        await ctx.answerCbQuery('🔄 Memproses Hit Me...', false);

        // Send all responses to private chat only
        try {
          await processHitMeRequest(ctx, confessionAuthorId, hitterId, requestManager);
        } catch (privateError) {
          console.error('Error sending private message:', privateError);
          // If can't send private message, answer callback query with instruction
          await ctx.answerCbQuery(
            '⚠️ Mohon start chat dengan bot terlebih dahulu untuk menggunakan Hit Me!', 
            true
          );
        }
        return;
      }

      // If this is already in private chat, process normally
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
      console.log('Confessor ID:', confessionAuthorId);
      console.log('Hitter ID:', hitterId);

      // Validation checks
      const validationResult = await validateHitMeRequest(confessionAuthorId, hitterId);
      console.log('Validation result:', validationResult.valid ? 'PASSED' : 'FAILED');

      if (!validationResult.valid) {
        console.log('Validation failed:', validationResult.message);
        const message = validationResult.message;
        const keyboard = validationResult.keyboard;

        if (ctx.chat.type === 'private') {
          return ctx.reply(message, keyboard || {});
        } else {
          return await ctx.telegram.sendMessage(hitterId, message, keyboard || {});
        }
      }

      console.log('Creating hit me request...');
      // Create and send hit me request
      const success = await requestManager.createHitMeRequest(
        ctx, 
        confessionAuthorId, 
        hitterId, 
        validationResult.confession
      );

      if (!success) {
        console.log('Failed to create hit me request');
        const errorMessage = '❌ Terjadi kesalahan saat membuat permintaan. Silakan coba lagi.';
        if (ctx.chat.type === 'private') {
          await ctx.reply(errorMessage);
        } else {
          await ctx.telegram.sendMessage(hitterId, errorMessage);
        }
      } else {
        console.log('Hit me request created successfully');
      }

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

      // First, sync sessions to clean up any orphaned data
      console.log('Syncing sessions with database...');
      await chatManager.syncSessionsWithDatabase();

      // Check if hitter is registered
      console.log('Checking if hitter is registered...');
      const hitter = await Database.getUserById(hitterId);
      if (!hitter) {
        console.log('Hitter not registered');
        return {
          valid: false,
          message: '❌ Kamu belum terdaftar!\n\nSilakan daftar terlebih dahulu untuk bisa menggunakan fitur Hit Me.',
          keyboard: Markup.inlineKeyboard([
            [Markup.button.callback('📝 Daftar Sekarang', 'btn_register')]
          ])
        };
      }
      console.log('Hitter is registered');

      // Check if trying to hit own confession
      if (confessionAuthorId === hitterId) {
        console.log('User trying to hit own confession');
        return {
          valid: false,
          message: '❌ Kamu tidak bisa hit confession sendiri!'
        };
      }

      // Check if confessor is registered
      console.log('Checking if confessor is registered...');
      const confessor = await Database.getUserById(confessionAuthorId);
      if (!confessor) {
        console.log('Confessor not found or not registered');
        return {
          valid: false,
          message: '❌ Pembuat confession tidak ditemukan atau belum terdaftar.'
        };
      }
      console.log('Confessor is registered');

      // Check if hitter already has active chat (check both memory and database)
      console.log('Checking if hitter has active chat...');
      const hitterInMemory = chatManager.isUserInChat(hitterId);
      const existingHitterSession = await Database.getActiveChatSession(hitterId);

      console.log(`Hitter ${hitterId}: in_memory=${hitterInMemory}, db_session=${!!existingHitterSession}`);

      // If there's a mismatch, clean it up
      if (existingHitterSession && !hitterInMemory) {
        console.log('Found orphaned database session for hitter, cleaning up...');
        await chatManager.forceCleanupUserSession(hitterId);
      } else if (!existingHitterSession && hitterInMemory) {
        console.log('Found orphaned memory entry for hitter, cleaning up...');
        await chatManager.forceCleanupUserSession(hitterId);
      } else if (existingHitterSession && hitterInMemory) {
        console.log('Hitter already has active chat session');
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

      // Check if confessor already has active chat (check both memory and database)  
      console.log('Checking if confessor has active chat...');
      const confessorInMemory = chatManager.isUserInChat(confessionAuthorId);
      const confessionOwnerSession = await Database.getActiveChatSession(confessionAuthorId);

      console.log(`Confessor ${confessionAuthorId}: in_memory=${confessorInMemory}, db_session=${!!confessionOwnerSession}`);

      // If there's a mismatch, clean it up
      if (confessionOwnerSession && !confessorInMemory) {
        console.log('Found orphaned database session for confessor, cleaning up...');
        await chatManager.forceCleanupUserSession(confessionAuthorId);
      } else if (!confessionOwnerSession && confessorInMemory) {
        console.log('Found orphaned memory entry for confessor, cleaning up...');
        await chatManager.forceCleanupUserSession(confessionAuthorId);
      } else if (confessionOwnerSession && confessorInMemory) {
        console.log('Confessor already has active chat session');
        return {
          valid: false,
          message: '❌ Pembuat confession sedang dalam chat dengan user lain. Coba lagi nanti.'
        };
      }

      // Get confession data
      console.log('Getting confession data...');
      let confession = await Database.getLatestConfessionByUserId(confessionAuthorId);
      if (!confession) {
        console.log('Confession not found');
        return {
          valid: false,
          message: '❌ Data confession tidak ditemukan.'
        };
      }

      console.log('All validations passed');
      return {
        valid: true,
        confession: confession
      };

    } catch (error) {
      console.error('Error in validation:', error);
      return {
        valid: false,
        message: '❌ Terjadi kesalahan saat validasi. Silakan coba lagi.'
      };
    }
  }

  console.log('Setting up cleanup...');
  setupCleanup(chatManager, requestManager);

  console.log('=== Hit Me command initialization complete ===');

  // Return utility functions
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

/**
 * Setup chat management handlers
 */
function setupChatManagementHandlers(bot, chatManager) {
  console.log('Setting up chat management handlers...');

  // Handler untuk end chat
  bot.command('endchat', async (ctx) => {
    console.log('End chat command received from user:', ctx.from.id);
    if (ctx.chat.type !== 'private') {
      console.log('End chat command from non-private chat, ignoring');
      return;
    }
    await chatManager.endChatSession(ctx, ctx.from.id);
  });

  bot.action('end_chat', async (ctx) => {
    console.log('End chat button clicked by user:', ctx.from.id);
    await ctx.answerCbQuery();
    await chatManager.endChatSession(ctx, ctx.from.id);
  });

  bot.action('continue_chat', async (ctx) => {
    console.log('Continue chat button clicked by user:', ctx.from.id);
    await ctx.answerCbQuery();
    await ctx.reply(
      '💬 *Chat Anonymous Berlanjut*\n\n' +
      'Ketik pesan untuk melanjutkan percakapan dengan lawan chat kamu.\n\n' +
      '🤖 Bot akan meneruskan pesan kamu ke lawan chat\n\n' +
      '💡 *Perintah yang tersedia:*\n' +
      '• `/reveal` - Minta reveal identitas\n' +
      '• `/endchat` - Akhiri percakapan',
      { parse_mode: 'Markdown' }
    );
  });

  // Handler untuk force cleanup
  bot.action(/^force_cleanup_(\d+)$/, async (ctx) => {
    try {
      console.log('Force cleanup button clicked by user:', ctx.from.id);
      await ctx.answerCbQuery();

      const targetUserId = parseInt(ctx.match[1]);
      const currentUserId = ctx.from.id;

      // Only allow user to cleanup their own session
      if (targetUserId !== currentUserId) {
        return ctx.reply('❌ Kamu hanya bisa cleanup session sendiri.');
      }

      console.log(`Force cleanup requested for user: ${targetUserId}`);

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

/**
 * Setup admin handlers
 */
function setupAdminHandlers(bot, chatManager, requestManager) {
  console.log('Setting up admin handlers...');

  // Command untuk debug dan admin
  bot.command('chatstatus', async (ctx) => {
    if (ctx.chat.type !== 'private') return;

    const userId = ctx.from.id;
    const user = await Database.getUserById(userId);

    if (!user || user.rank !== 'Admin') {
      return ctx.reply('❌ Command ini hanya untuk admin.');
    }

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

  // Command untuk force end session (admin only)
  bot.command('forceend', async (ctx) => {
    if (ctx.chat.type !== 'private') return;

    const userId = ctx.from.id;
    const user = await Database.getUserById(userId);

    if (!user || user.rank !== 'Admin') {
      return ctx.reply('❌ Command ini hanya untuk admin.');
    }

    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
      return ctx.reply('❌ Gunakan: /forceend <user_id>');
    }

    const targetUserId = parseInt(args[1]);
    if (isNaN(targetUserId)) {
      return ctx.reply('❌ User ID harus berupa angka.');
    }

    const success = await chatManager.forceEndSession(targetUserId);
    if (success) {
      await ctx.reply(`✅ Session untuk user ${targetUserId} berhasil diakhiri.`);
    } else {
      await ctx.reply(`❌ User ${targetUserId} tidak sedang dalam chat session.`);
    }
  });

  // Debug command untuk melihat active users
  bot.command('debugchat', async (ctx) => {
    if (ctx.chat.type !== 'private') return;

    const userId = ctx.from.id;
    const user = await Database.getUserById(userId);

    if (!user || user.rank !== 'Admin') {
      return ctx.reply('❌ Command ini hanya untuk admin.');
    }

    chatManager.debugActiveUsers();
    await ctx.reply('🔍 Debug info printed to console. Check server logs.');
  });

  // Admin command untuk sync sessions
  bot.command('syncsessions', async (ctx) => {
    if (ctx.chat.type !== 'private') return;

    const userId = ctx.from.id;
    const user = await Database.getUserById(userId);

    if (!user || user.rank !== 'Admin') {
      return ctx.reply('❌ Command ini hanya untuk admin.');
    }

    await ctx.reply('🔄 Syncing sessions with database...');
    await chatManager.syncSessionsWithDatabase();
    await ctx.reply('✅ Sessions synced successfully!');
  });

  // Admin command untuk force cleanup user
  bot.command('forceuser', async (ctx) => {
    if (ctx.chat.type !== 'private') return;

    const userId = ctx.from.id;
    const user = await Database.getUserById(userId);

    if (!user || user.rank !== 'Admin') {
      return ctx.reply('❌ Command ini hanya untuk admin.');
    }

    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
      return ctx.reply('❌ Gunakan: /forceuser <user_id>');
    }

    const targetUserId = parseInt(args[1]);
    if (isNaN(targetUserId)) {
      return ctx.reply('❌ User ID harus berupa angka.');
    }

    const success = await chatManager.forceCleanupUserSession(targetUserId);
    if (success) {
      await ctx.reply(`✅ Force cleanup untuk user ${targetUserId} berhasil.`);
    } else {
      await ctx.reply(`❌ Gagal force cleanup untuk user ${targetUserId}.`);
    }
  });

  console.log('Admin handlers set up successfully');
}

/**
 * Setup cleanup interval
 */
function setupCleanup(chatManager, requestManager) {
  console.log('Setting up cleanup interval...');

  setInterval(async () => {
    try {
      console.log('Running scheduled cleanup...');

      // Cleanup expired requests
      await requestManager.cleanupExpiredRequests();

      // Cleanup inactive sessions
      await chatManager.cleanupInactiveSessions();

      console.log('Cleanup completed - Active sessions:', chatManager.getActiveSessionCount(), 'Pending requests:', requestManager.getPendingRequestCount());
    } catch (error) {
      console.error('Error in cleanup:', error);
    }
  }, 30 * 60 * 1000); // Check every 30 minutes

  console.log('Cleanup interval set up successfully');
}