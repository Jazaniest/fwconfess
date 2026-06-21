import { Markup } from 'telegraf';
import { Database } from './database.js';
import commentHandler from './comment.js';
import showMeHandler from './showme.js';
import reportHandler from './report.js';
import { formatConfessionMessage, getGenderEmoji, getRankEmoji, renderMsg } from '../utils/formatters.js';

/**
 * Handler untuk logika menfess
 * @param {Telegraf} bot
 * @param {string|number} targetChannelId - ID channel atau group untuk publish
 */
export default function confessCommand(bot, targetChannelId) {
  if (!targetChannelId) {
    throw new Error(
      '❌ KONFIG ERROR: TARGET_CHANNEL_ID tidak di-set di environment variables!\n' +
      'Tambahkan TARGET_CHANNEL_ID ke file .env kamu.'
    );
  }

  const pending = new Map();

  // Ambil config rate limit dari database
  async function getRateLimitConfig(userId) {
    const cfg = await Database.getConfigs([
      'confession_window_hours',
      'ratelimit_msg_hit',
      'ratelimit_msg_success'
    ]);

    // Ambil rank efektif user (handle toggle on/off di dalam method ini)
    const effectiveRank = await Database.getEffectiveRank(userId);
    const maxCount = await Database.getConfessionLimitByRank(effectiveRank);

    const windowHours = parseFloat(cfg['confession_window_hours'] || '8');
    return {
      maxCount,
      windowMs: windowHours * 60 * 60 * 1000,
      windowHours,
      effectiveRank,
      msgHit: cfg['ratelimit_msg_hit'] || '⏰ Kamu sudah menfess {count}x dalam {hours} jam terakhir.\n\nCoba lagi setelah: *{next_time}*',
      msgSuccess: cfg['ratelimit_msg_success'] || '🎉 *Menfess berhasil dipublish!*\n\n⏰ Kamu bisa menfess lagi dalam {hours} jam',
    };
  }

  const commentSystem = commentHandler(bot, process.env.DISCUSSION_GROUP_ID);
  const showMeSystem = showMeHandler(bot);
  const reportSystem = reportHandler(bot, targetChannelId);

  console.log('🚀 Confess command initialized with channel:', targetChannelId);
  console.log('💬 Discussion group ID:', process.env.DISCUSSION_GROUP_ID);
  console.log('💬 Comment system enabled:', commentSystem.isCommentSystemEnabled());

  // Tombol Kirim Menfess dari startCommand
  bot.action('btn_confess', async (ctx) => {
    try {
      console.log('🔘 Button confess clicked by user:', ctx.from.id);
      await ctx.answerCbQuery();
      const userId = ctx.from.id;

      const user = await Database.getUserById(userId);
      if (!user) {
        console.log('❌ User not registered:', userId);
        return ctx.reply(
          '❌ Kamu belum terdaftar!\n\n' +
          'Silakan daftar terlebih dahulu untuk bisa mengirim menfess.',
          Markup.inlineKeyboard([
            [Markup.button.callback('📝 Daftar Sekarang', 'btn_register')],
            [Markup.button.callback('🏠 Kembali ke Menu', 'btn_back_to_start')]
          ])
        );
      }

      // Check rate limit (config & pesan dari database)
      const now = Date.now();
      const rlCfg = await getRateLimitConfig(userId);
      const recentCount = await Database.countRecentConfessions(userId, rlCfg.windowMs);
      if (recentCount >= rlCfg.maxCount) {
        const oldestInWindow = await Database.getLastConfessionTime(userId, rlCfg.windowMs);
        const nextAllowed = new Date(oldestInWindow.getTime() + rlCfg.windowMs);
        console.log('🚫 Rate limit hit for user:', userId);
        return ctx.reply(
          renderMsg(rlCfg.msgHit, {
            count: rlCfg.maxCount,
            hours: rlCfg.windowHours,
            next_time: nextAllowed.toLocaleString('id-ID'),
          }),
          { parse_mode: 'Markdown' }
        );
      }

      pending.set(userId, { timestamp: now, user });
      console.log('📝 User added to pending list:', userId);

      const instructionText = commentSystem.isCommentSystemEnabled()
        ? '📝 *Kirim Menfess*\n\n' +
        'Silakan ketik confession kamu. Pastikan menyertakan tag *#fwconfess*\n\n' +
        '⚠️ *Perhatian:*\n' +
        '• Menfess akan ditampilkan dengan gender dan rank kamu\n' +
        '• User lain bisa klik "Hit Me" untuk chat anonymous\n' +
        '• User bisa memberikan komentar di grup diskusi\n' +
        '• Jaga sopan santun dalam menfess\n\n' +
        '💡 *Tips:* Ketik `/cancel` untuk membatalkan'
        : '📝 *Kirim Menfess*\n\n' +
        'Silakan ketik confession kamu. Pastikan menyertakan tag *#fwconfess*\n\n' +
        '⚠️ *Perhatian:*\n' +
        '• Menfess akan ditampilkan dengan gender dan rank kamu\n' +
        '• User lain bisa klik "Hit Me" untuk chat anonymous\n' +
        '• Jaga sopan santun dalam menfess\n\n' +
        '💡 *Tips:* Ketik `/cancel` untuk membatalkan';

      await ctx.reply(instructionText, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('❌ Error in btn_confess:', error);
      await ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi nanti.');
    }
  });

  // Command untuk cancel confession
  bot.command('cancel', async (ctx) => {
    const userId = ctx.from.id;
    if (pending.has(userId)) {
      pending.delete(userId);
      await ctx.reply('❌ Confession dibatalkan.');
    } else {
      await ctx.reply('❌ Tidak ada confession yang sedang dibuat.');
    }
  });

  async function handleConfessText(ctx, next) {
    const userId = ctx.from.id;
    const text = ctx.message.text;

    console.log('📨 ===== TEXT MESSAGE RECEIVED =====');
    console.log('👤 User ID:', userId);
    console.log('💬 Message text:', text);
    console.log('📋 Is user in pending?', pending.has(userId));

    if (text.startsWith('/')) {
      console.log('⏭️ Skipping - Message is a command');
      return;
    }

    if (!pending.has(userId)) {
      console.log('⏭️ Skipping - User not in pending list');
      return;
    }

    console.log('🎯 PROCESSING CONFESSION from user:', userId);

    try {
      const pendingData = pending.get(userId);
      const user = pendingData.user;

      // Hapus dari pending setelah dapat data
      pending.delete(userId);

      // Cek rate limit lagi (double check, config & pesan dari database)
      const now = Date.now();
      const rlCfg = await getRateLimitConfig(userId);
      const recentCount = await Database.countRecentConfessions(userId, rlCfg.windowMs);
      if (recentCount >= rlCfg.maxCount) {
        const oldestInWindow = await Database.getLastConfessionTime(userId, rlCfg.windowMs);
        const nextAllowed = new Date(oldestInWindow.getTime() + rlCfg.windowMs);
        return ctx.reply(
          renderMsg(rlCfg.msgHit, {
            count: rlCfg.maxCount,
            hours: rlCfg.windowHours,
            next_time: nextAllowed.toLocaleString('id-ID'),
          }),
          { parse_mode: 'Markdown' }
        );
      }

      if (!text.includes('#fwconfess')) {
        // Kembalikan user ke pending karena tag salah
        pending.set(userId, { timestamp: now, user });
        return ctx.reply(
          '❌ Tag *#fwconfess* tidak ditemukan.\n\n' +
          'Tambahkan tag tersebut agar confession dapat dipublish.\n\n' +
          '💡 Ketik confession kamu lagi dengan tag #fwconfess',
          { parse_mode: 'Markdown' }
        );
      }

      if (text.length > 4000) {
        pending.set(userId, { timestamp: now, user });
        return ctx.reply(
          '❌ Confession terlalu panjang!\n\n' +
          'Maksimal 4000 karakter. Saat ini: ' + text.length + ' karakter'
        );
      }

      const confessionMessage = formatConfessionMessage(text, user);
      console.log('📡 Attempting to send message to channel:', targetChannelId);

      // Kirim ke grup diskusi
      const commentUrl = await commentSystem.sendToDiscussionGroup(ctx, confessionMessage);

      // Buat inline keyboard awal (tanpa Show Me dulu)
      const inlineKeyboard = commentSystem.createInlineKeyboard(commentUrl, userId);

      // Kirim ke channel
      const result = await ctx.telegram.sendMessage(targetChannelId, confessionMessage, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: inlineKeyboard }
      });

      console.log('✅ Message sent successfully to channel, message_id:', result.message_id);

      try {
        // Baris baru: Show Me + Report dalam satu baris
        inlineKeyboard.push([
          showMeSystem.createShowMeButton(result.message_id)[0], // ambil object button-nya
          reportSystem.createReportButton(result.message_id)
        ]);
        await ctx.telegram.editMessageReplyMarkup(
          targetChannelId,
          result.message_id,
          null,
          { inline_keyboard: inlineKeyboard }
        );
        console.log('✅ Show Me + Report button added to message');
      } catch (editErr) {
        console.error('⚠️ Gagal menambahkan tombol (confession tetap terkirim):', editErr.message);
      }

      // Catat ke database SETELAH berhasil kirim
      await Database.recordConfessionSent(userId);
      console.log('⏰ Rate limit recorded to DB for user:', userId);

      // Save confession to database
      console.log('💾 Saving confession to database...');
      await Database.saveConfession(userId, text, result.message_id);
      console.log('✅ Confession saved to database');

      const successMessage = renderMsg(rlCfg.msgSuccess, {
        hours: rlCfg.windowHours,
      });

      await ctx.reply(successMessage, { parse_mode: 'Markdown' });
      console.log('🎉 SUCCESS: Confession processed completely for user:', userId);

    } catch (err) {
      console.error('❌ ===== ERROR PROCESSING CONFESSION =====');
      console.error('👤 User:', userId);
      console.error('💥 Error:', err);
      console.error('🔍 Error code:', err.code);
      console.error('📡 Error response:', err.response);
      console.error('📚 Stack trace:', err.stack);
      console.error('==========================================');

      // Kembalikan user ke pending jika error bukan dari rate limit
      if (err.code !== 429) {
        try {
          const userData = await Database.getUserById(userId);
          if (userData) {
            pending.set(userId, { timestamp: Date.now(), user: userData });
            console.log('🔄 User returned to pending due to error');
          }
        } catch (dbError) {
          console.error('❌ Error getting user data for pending restore:', dbError);
        }
      }

      let errorMessage = '❌ Terjadi kesalahan saat publish confession.\n\n';

      if (err.code === 403) {
        errorMessage += '🚫 Bot tidak memiliki izin untuk mengirim pesan ke channel tersebut.';
      } else if (err.code === 400) {
        errorMessage += '📝 Format pesan tidak valid. Periksa kembali confession kamu.';
      } else if (err.code === 429) {
        errorMessage += '⏰ Terlalu banyak permintaan. Coba lagi dalam beberapa menit.';
      } else if (err.message && err.message.includes('chat not found')) {
        errorMessage += '🔍 Channel tidak ditemukan. Periksa ID channel.';
      } else {
        errorMessage += '🔧 Silakan coba lagi nanti.';
      }

      await ctx.reply(errorMessage);
    }
  }

  // Debug commands untuk testing
  bot.command('debug_pending', async (ctx) => {
    if (ctx.from.id === parseInt(process.env.ADMIN_ID)) {
      const pendingList = Array.from(pending.entries()).map(([id, data]) =>
        `${id}: ${data.user.gender || 'Unknown'} - ${new Date(data.timestamp).toLocaleString()}`
      );
      await ctx.reply(`Pending users:\n${pendingList.join('\n') || 'None'}`);
    }
  });

  bot.command('debug_ratelimit', async (ctx) => {
    if (ctx.from.id === parseInt(process.env.ADMIN_ID)) {
      const rateList = Array.from(lastSent.entries()).map(([id, time]) =>
        `${id}: ${new Date(time).toLocaleString()}`
      );
      await ctx.reply(`Rate limits:\n${rateList.join('\n') || 'None'}`);
    }
  });

  return {
    handleConfessText,
    isUserPending: (userId) => pending.has(userId),
    getPendingUsers: () => Array.from(pending.keys()),
    getLastSentTimes: () => Array.from(lastSent.entries()),
    clearPending: (userId) => pending.delete(userId),
    clearRateLimit: (userId) => lastSent.delete(userId),
    forceAddPending: async (userId) => {
      const user = await Database.getUserById(userId);
      if (user) {
        pending.set(userId, { timestamp: Date.now(), user });
        return true;
      }
      return false;
    },
    commentSystem,
    showMeSystem,
    reportSystem
  };
}