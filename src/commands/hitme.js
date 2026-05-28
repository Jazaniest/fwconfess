import { Markup }          from 'telegraf';
import { ChatManager }     from '../handlers/chat/chat-manager.js';
import { RevealManager }   from '../handlers/chat/reveal-manager.js';
import { RequestManager }  from '../handlers/chat/request-manager.js';
import { isAdminUser }     from '../middleware/admin-auth.js';
import { getUserById }     from '../repositories/user.repo.js';
import { getActiveChatSession } from '../repositories/chat.repo.js';

/**
 * Hit Me command entry-point.
 *
 * Tanggung jawab file ini:
 *   1. Instantiasi ChatManager, RevealManager, RequestManager
 *   2. Registrasi handler hitme_* action
 *   3. Setup handler manajemen chat (endchat, force_cleanup, dll)
 *   4. Setup command admin (chatstatus, forceend, dll)
 *   5. Setup cleanup interval
 *
 * Semua business logic ada di handlers/chat/.
 *
 * @param {import('telegraf').Telegraf} bot
 * @returns {Object} public interface
 */
export default function hitMeCommand(bot) {
  console.log('=== Hit Me command initializing ===');

  const chatManager    = new ChatManager(bot);
  const revealManager  = new RevealManager(bot, chatManager);
  const requestManager = new RequestManager(bot, chatManager);

  console.log('Managers created, setting up handlers...');

  requestManager.setupHandlers();
  chatManager.setupMessageHandler();
  revealManager.setupHandlers();
  setupChatManagementHandlers(bot, chatManager);
  setupAdminHandlers(bot, chatManager, requestManager);
  setupCleanupInterval(chatManager, requestManager);

  // ─── Action: tombol Hit Me di channel/grup ──────────────────────────────────

  bot.action(/^hitme_(\d+)$/, async (ctx) => {
    try {
      const confessionAuthorId = parseInt(ctx.match[1]);
      const hitterId           = ctx.from.id;

      console.log('=== HIT ME CLICKED ===');
      console.log('Hit Me clicked by:', hitterId, 'for confession by:', confessionAuthorId);
      console.log('Chat type:', ctx.chat.type);

      if (ctx.chat.type !== 'private') {
        await ctx.answerCbQuery('🔄 Memproses Hit Me...', false);

        try {
          await processHitMeRequest(ctx, confessionAuthorId, hitterId);
        } catch {
          await ctx.answerCbQuery(
            '⚠️ Mohon start chat dengan bot terlebih dahulu untuk menggunakan Hit Me!',
            true
          );
        }
        return;
      }

      await ctx.answerCbQuery();
      await processHitMeRequest(ctx, confessionAuthorId, hitterId);

    } catch (error) {
      console.error('Error in hit me handler:', error);
      await ctx.answerCbQuery('❌ Terjadi kesalahan. Silakan coba lagi nanti.', true);
    }
  });

  // ─── Process & validate (private helpers) ──────────────────────────────────

  async function processHitMeRequest(ctx, confessionAuthorId, hitterId) {
    try {
      console.log('=== PROCESSING HIT ME REQUEST ===');

      const validation = await validateHitMeRequest(confessionAuthorId, hitterId);
      console.log('Validation result:', validation.valid ? 'PASSED' : 'FAILED');

      if (!validation.valid) {
        const send = ctx.chat.type === 'private'
          ? (msg, opts) => ctx.reply(msg, opts || {})
          : (msg, opts) => ctx.telegram.sendMessage(hitterId, msg, opts || {});
        return send(validation.message, validation.keyboard);
      }

      await requestManager.createHitMeRequest(
        ctx,
        confessionAuthorId,
        hitterId,
        validation.confession
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

  async function validateHitMeRequest(confessionAuthorId, hitterId) {
    try {
      console.log('=== VALIDATING HIT ME REQUEST ===');

      await chatManager.syncSessionsWithDatabase();

      const hitter = await getUserById(hitterId);
      if (!hitter) {
        return {
          valid  : false,
          message: '❌ Kamu belum terdaftar!\n\nSilakan daftar terlebih dahulu untuk bisa menggunakan fitur Hit Me.',
          keyboard: Markup.inlineKeyboard([
            [Markup.button.callback('📝 Daftar Sekarang', 'btn_register')]
          ]),
        };
      }

      if (confessionAuthorId === hitterId) {
        return { valid: false, message: '❌ Kamu tidak bisa hit confession sendiri!' };
      }

      const confessor = await getUserById(confessionAuthorId);
      if (!confessor) {
        return { valid: false, message: '❌ Pembuat confession tidak ditemukan atau belum terdaftar.' };
      }

      // Bersihkan orphaned session hitter
      const hitterInMemory      = chatManager.isUserInChat(hitterId);
      const existingHitterSession = await getActiveChatSession(hitterId);

      if (existingHitterSession && !hitterInMemory) {
        await chatManager.forceCleanupUserSession(hitterId);
      } else if (!existingHitterSession && hitterInMemory) {
        await chatManager.forceCleanupUserSession(hitterId);
      } else if (existingHitterSession && hitterInMemory) {
        return {
          valid  : false,
          message: '⚠️ Kamu sudah memiliki chat session yang aktif!\n\nSelesaikan chat yang sedang berlangsung terlebih dahulu.',
          keyboard: Markup.inlineKeyboard([
            [Markup.button.callback('💬 Lanjut Chat',    'continue_chat')],
            [Markup.button.callback('❌ End Chat',        'end_chat')],
            [Markup.button.callback('🔧 Force Cleanup',  `force_cleanup_${hitterId}`)],
          ]),
        };
      }

      // Bersihkan orphaned session confessor
      const confessorInMemory       = chatManager.isUserInChat(confessionAuthorId);
      const confessionOwnerSession  = await getActiveChatSession(confessionAuthorId);

      if (confessionOwnerSession && !confessorInMemory) {
        await chatManager.forceCleanupUserSession(confessionAuthorId);
      } else if (!confessionOwnerSession && confessorInMemory) {
        await chatManager.forceCleanupUserSession(confessionAuthorId);
      } else if (confessionOwnerSession && confessorInMemory) {
        return { valid: false, message: '❌ Pembuat confession sedang dalam chat dengan user lain. Coba lagi nanti.' };
      }

      const { getLatestConfessionByUserId } = await import('../repositories/confession.repo.js');
      const confession = await getLatestConfessionByUserId(confessionAuthorId);
      if (!confession) {
        return { valid: false, message: '❌ Data confession tidak ditemukan.' };
      }

      return { valid: true, confession };

    } catch (error) {
      console.error('Error in validation:', error);
      return { valid: false, message: '❌ Terjadi kesalahan saat validasi. Silakan coba lagi.' };
    }
  }

  console.log('=== Hit Me command initialization complete ===');

  return {
    chatManager,
    revealManager,
    requestManager,
    getActiveChatUsers    : ()         => chatManager.getActiveUsers(),
    getPendingRequests    : ()         => requestManager.getPendingRequests(),
    getActiveSessionCount : ()         => chatManager.getActiveSessionCount(),
    getPendingRequestCount: ()         => requestManager.getPendingRequestCount(),
    forceEndSession       : async (u)  => chatManager.forceEndSession(u),
    clearPendingRequest   : (id)       => requestManager.clearPendingRequest(id),
    isUserInChat          : (u)        => chatManager.isUserInChat(u),
    getUserChatInfo       : (u)        => chatManager.getUserChatInfo(u),
    getAllActiveSessions   : ()         => chatManager.getAllActiveSessions(),
    debugActiveUsers      : ()         => chatManager.debugActiveUsers(),
  };
}

// ─── Chat Management Handlers ───────────────────────────────────────────────

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
      const targetUserId  = parseInt(ctx.match[1]);
      const currentUserId = ctx.from.id;

      if (targetUserId !== currentUserId) {
        return ctx.reply('❌ Kamu hanya bisa cleanup session sendiri.');
      }

      const success = await chatManager.forceCleanupUserSession(targetUserId);
      await ctx.reply(
        success
          ? '✅ *Session Berhasil Di-cleanup!*\n\n🧹 Data chat yang bermasalah telah dibersihkan\n💡 Sekarang kamu bisa mencoba hit confession lagi'
          : '❌ Gagal cleanup session. Silakan coba lagi atau hubungi admin.',
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('Error in force cleanup handler:', error);
      await ctx.reply('❌ Terjadi kesalahan saat cleanup session.');
    }
  });

  console.log('Chat management handlers set up successfully');
}

// ─── Admin Handlers ─────────────────────────────────────────────────────────

function setupAdminHandlers(bot, chatManager, requestManager) {
  console.log('Setting up admin handlers...');

  bot.command('chatstatus', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    if (!isAdminUser(ctx.from.id)) return ctx.reply('❌ Command ini hanya untuk admin.');

    const activeCount  = chatManager.getActiveSessionCount();
    const pendingCount = requestManager.getPendingRequestCount();

    let text = `📊 *Status Anonymous Chat*\n\n`;
    text    += `👥 Active Chat Users: ${activeCount}\n`;
    text    += `⏳ Pending Requests: ${pendingCount}\n\n`;

    if (activeCount > 0) {
      text += `*Active Sessions:*\n`;
      chatManager.getAllActiveSessions().forEach(session => {
        text += `• Session ${session.sessionId}: `;
        session.users.forEach((user, i) => {
          text += `${user.userId} (${user.role})`;
          if (i < session.users.length - 1) text += ', ';
        });
        text += '\n';
      });
    }

    await ctx.reply(text, { parse_mode: 'Markdown' });
  });

  bot.command('forceend', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    if (!isAdminUser(ctx.from.id)) return ctx.reply('❌ Command ini hanya untuk admin.');

    const args = ctx.message.text.split(' ');
    if (args.length < 2)        return ctx.reply('❌ Gunakan: /forceend <user_id>');
    const targetUserId = parseInt(args[1]);
    if (isNaN(targetUserId))    return ctx.reply('❌ User ID harus berupa angka.');

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
    if (args.length < 2)     return ctx.reply('❌ Gunakan: /forceuser <user_id>');
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

// ─── Cleanup interval ───────────────────────────────────────────────────────

function setupCleanupInterval(chatManager, requestManager) {
  setInterval(async () => {
    try {
      await requestManager.cleanupExpiredRequests();
      await chatManager.cleanupInactiveSessions();
      console.log(
        'Cleanup completed — Active sessions:',
        chatManager.getActiveSessionCount(),
        '| Pending requests:',
        requestManager.getPendingRequestCount()
      );
    } catch (error) {
      console.error('Error in cleanup:', error);
    }
  }, 30 * 60 * 1000); // setiap 30 menit
}