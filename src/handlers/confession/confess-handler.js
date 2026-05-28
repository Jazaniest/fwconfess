import { Markup } from 'telegraf';
import {
  countRecentConfessions,
  getLastConfessionTime,
  recordConfessionSent,
  getConfessionLimitByRank,
  getEffectiveRank,
} from '../../repositories/confession.repo.js';
import { getConfigs }   from '../../repositories/config.repo.js';
import { getUserById }  from '../../repositories/user.repo.js';
import { saveConfession } from '../../repositories/confession.repo.js';
import { formatConfessionMessage } from '../../utils/formatters.js';

/**
 * setupConfessHandlers — business logic inti untuk fitur menfess.
 *
 * Dipindah dari: src/commands/confess.js
 * File commands/confess.js cukup import fungsi ini dan delegasikan.
 *
 * @param {import('telegraf').Telegraf} bot
 * @param {string|number} targetChannelId
 * @param {Object} commentSystem  - dari handlers/confession/comment.js
 * @param {Object} showMeSystem   - dari handlers/confession/showme.js
 * @param {Object} reportSystem   - dari handlers/confession/report.js
 * @returns {Object} public interface
 */
export function setupConfessHandlers(bot, targetChannelId, commentSystem, showMeSystem, reportSystem) {
  if (!targetChannelId) {
    throw new Error(
      '❌ KONFIG ERROR: TARGET_CHANNEL_ID tidak di-set di environment variables!\n' +
      'Tambahkan TARGET_CHANNEL_ID ke file .env kamu.'
    );
  }

  // userId → { timestamp, user }
  const pending = new Map();

  // ─── Rate-limit helpers ─────────────────────────────────────────────────────

  async function getRateLimitConfig(userId) {
    const cfg = await getConfigs([
      'confession_window_hours',
      'ratelimit_msg_hit',
      'ratelimit_msg_success',
    ]);

    const effectiveRank = await getEffectiveRank(userId);
    const maxCount      = await getConfessionLimitByRank(effectiveRank);
    const windowHours   = parseFloat(cfg['confession_window_hours'] || '8');

    return {
      maxCount,
      windowMs   : windowHours * 60 * 60 * 1000,
      windowHours,
      effectiveRank,
      msgHit     : cfg['ratelimit_msg_hit']    ||
        '⏰ Kamu sudah menfess {count}x dalam {hours} jam terakhir.\n\nCoba lagi setelah: *{next_time}*',
      msgSuccess : cfg['ratelimit_msg_success'] ||
        '🎉 *Menfess berhasil dipublish!*\n\n⏰ Kamu bisa menfess lagi dalam {hours} jam',
    };
  }

  function renderMsg(template, vars = {}) {
    return Object.entries(vars).reduce(
      (str, [k, v]) => str.replaceAll(`{${k}}`, v),
      template
    );
  }

  // ─── btn_confess action ──────────────────────────────────────────────────────

  bot.action('btn_confess', async (ctx) => {
    try {
      console.log('🔘 Button confess clicked by user:', ctx.from.id);
      await ctx.answerCbQuery();
      const userId = ctx.from.id;

      const user = await getUserById(userId);
      if (!user) {
        console.log('❌ User not registered:', userId);
        return ctx.reply(
          '❌ Kamu belum terdaftar!\n\n' +
          'Silakan daftar terlebih dahulu untuk bisa mengirim menfess.',
          Markup.inlineKeyboard([
            [Markup.button.callback('📝 Daftar Sekarang', 'btn_register')],
            [Markup.button.callback('🏠 Kembali ke Menu', 'btn_back_to_start')],
          ])
        );
      }

      const now    = Date.now();
      const rlCfg  = await getRateLimitConfig(userId);
      const recent = await countRecentConfessions(userId, rlCfg.windowMs);

      if (recent >= rlCfg.maxCount) {
        const oldest     = await getLastConfessionTime(userId, rlCfg.windowMs);
        const nextAllowed = new Date(oldest.getTime() + rlCfg.windowMs);
        console.log('🚫 Rate limit hit for user:', userId);
        return ctx.reply(
          renderMsg(rlCfg.msgHit, {
            count     : rlCfg.maxCount,
            hours     : rlCfg.windowHours,
            next_time : nextAllowed.toLocaleString('id-ID'),
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

  // /cancel command
  bot.command('cancel', async (ctx) => {
    const userId = ctx.from.id;
    if (pending.has(userId)) {
      pending.delete(userId);
      await ctx.reply('❌ Confession dibatalkan.');
    } else {
      await ctx.reply('❌ Tidak ada confession yang sedang dibuat.');
    }
  });

  // ─── Text handler (dipanggil dari bot.on('text') di bot.js) ─────────────────

  async function handleConfessText(ctx, next) {
    const userId = ctx.from.id;
    const text   = ctx.message.text;

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
      const user        = pendingData.user;
      pending.delete(userId);

      // Double-check rate limit
      const now    = Date.now();
      const rlCfg  = await getRateLimitConfig(userId);
      const recent = await countRecentConfessions(userId, rlCfg.windowMs);

      if (recent >= rlCfg.maxCount) {
        const oldest     = await getLastConfessionTime(userId, rlCfg.windowMs);
        const nextAllowed = new Date(oldest.getTime() + rlCfg.windowMs);
        return ctx.reply(
          renderMsg(rlCfg.msgHit, {
            count     : rlCfg.maxCount,
            hours     : rlCfg.windowHours,
            next_time : nextAllowed.toLocaleString('id-ID'),
          }),
          { parse_mode: 'Markdown' }
        );
      }

      if (!text.includes('#fwconfess')) {
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

      // Kirim ke grup diskusi (comment)
      const commentUrl = await commentSystem.sendToDiscussionGroup(ctx, confessionMessage);

      // Buat inline keyboard awal
      const inlineKeyboard = commentSystem.createInlineKeyboard(commentUrl, userId);

      // Kirim ke channel
      const result = await ctx.telegram.sendMessage(targetChannelId, confessionMessage, {
        parse_mode  : 'Markdown',
        reply_markup: { inline_keyboard: inlineKeyboard },
      });

      console.log('✅ Message sent successfully to channel, message_id:', result.message_id);

      // Tambahkan tombol Show Me + Report setelah pesan terkirim
      try {
        inlineKeyboard.push([
          showMeSystem.createShowMeButton(result.message_id)[0],
          reportSystem.createReportButton(result.message_id),
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

      // Catat ke DB
      await recordConfessionSent(userId);
      console.log('⏰ Rate limit recorded to DB for user:', userId);

      await saveConfession(userId, text, result.message_id);
      console.log('✅ Confession saved to database');

      const successMessage = renderMsg(rlCfg.msgSuccess, { hours: rlCfg.windowHours });
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

      // Kembalikan ke pending jika bukan rate-limit error
      if (err.code !== 429) {
        try {
          const userData = await getUserById(userId);
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
      } else if (err.message?.includes('chat not found')) {
        errorMessage += '🔍 Channel tidak ditemukan. Periksa ID channel.';
      } else {
        errorMessage += '🔧 Silakan coba lagi nanti.';
      }

      await ctx.reply(errorMessage);
    }
  }

  // ─── Debug commands ──────────────────────────────────────────────────────────

  bot.command('debug_pending', async (ctx) => {
    if (ctx.from.id === parseInt(process.env.ADMIN_ID)) {
      const pendingList = Array.from(pending.entries()).map(([id, data]) =>
        `${id}: ${data.user.gender || 'Unknown'} - ${new Date(data.timestamp).toLocaleString()}`
      );
      await ctx.reply(`Pending users:\n${pendingList.join('\n') || 'None'}`);
    }
  });

  // ─── Public interface ────────────────────────────────────────────────────────

  return {
    handleConfessText,
    isUserPending   : (userId) => pending.has(userId),
    getPendingUsers : ()       => Array.from(pending.keys()),
    clearPending    : (userId) => pending.delete(userId),
    forceAddPending : async (userId) => {
      const user = await getUserById(userId);
      if (user) { pending.set(userId, { timestamp: Date.now(), user }); return true; }
      return false;
    },
  };
}