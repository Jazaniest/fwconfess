/**
 * Confession handler — business logic untuk menfess.
 * Factory function: menerima dependencies dan mengembalikan handler functions.
 */
import { Database } from '../commands/database.js';
import { formatConfessionMessage, renderMsg } from '../utils/formatters.js';
import * as LeaderboardRepo from '../repositories/leaderboard.repo.js';


/**
 * Buat confession handler.
 * @param {Map} pendingMap - Map<userId, {timestamp, user}>
 * @param {string|number} targetChannelId
 * @param {object} commentSystem
 * @param {object} showMeSystem
 * @param {object} reportSystem
 */
export function createConfessionHandler(pendingMap, targetChannelId, commentSystem, showMeSystem, reportSystem) {
  const pending = pendingMap;

  /**
   * Ambil config rate limit dari database.
   */
  async function getRateLimitConfig(userId) {
    const cfg = await Database.getConfigs([
      'confession_window_hours',
      'ratelimit_msg_hit',
      'ratelimit_msg_success'
    ]);

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

  /**
   * Handle input teks confession dari user.
   */
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
          showMeSystem.createShowMeButton(result.message_id)[0],
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

      // Lacak untuk papan peringkat
      await LeaderboardRepo.recordAction(userId, 'weekly_confessions');


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

  return {
    handleConfessText,
    getRateLimitConfig,
  };
}
