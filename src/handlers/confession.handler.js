/**
 * Confession handler — business logic untuk menfess.
 * Factory function: menerima dependencies dan mengembalikan handler functions.
 */
import { Database } from '../commands/database.js';
import { formatConfessionMessage, renderMsg } from '../utils/formatters.js';
import * as LeaderboardRepo from '../repositories/leaderboard.repo.js';
import * as AchievementRepo from '../repositories/achievement.repo.js';
import { configService } from '../services/config.service.js';
import * as UserRepo from '../repositories/user.repo.js'; // [BARU] Import UserRepo

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
   * [BARU] Fungsi terpusat untuk mengirim menfess.
   * @private
   */
  async function _sendConfession(ctx, user, confessionText) {
    const tags = (confessionText.match(/#\w+/g) || []).slice(0, 3);
    const finalMessageBody = confessionText.replace(/#\w+/g, '').trim();
    const finalMessage = `${formatConfessionMessage(finalMessageBody, user)}\n\n${tags.join(' ')}`;

    const commentUrl = await commentSystem.sendToDiscussionGroup(ctx, finalMessage);
    const inlineKeyboard = commentSystem.createInlineKeyboard(commentUrl, user.telegram_id);

    const result = await ctx.telegram.sendMessage(targetChannelId, finalMessage, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: inlineKeyboard }
    });

    try {
      const buttons = [
        [
          showMeSystem.createShowMeButton(result.message_id)[0],
          reportSystem.createReportButton(result.message_id)
        ]
      ];

      if (configService.isFeatureEnabled('superhit')) {
          buttons.push([{ text: '🌟 Super Hit (1 Koin)', callback_data: `superhit_${user.telegram_id}` }]);
      }

      inlineKeyboard.push(...buttons);

      await ctx.telegram.editMessageReplyMarkup(
        targetChannelId,
        result.message_id,
        null,
        { inline_keyboard: inlineKeyboard }
      );
    } catch (editErr) {
      console.error('⚠️ Gagal menambahkan tombol (confession tetap terkirim):', editErr.message);
    }

    await Database.saveConfession(user.telegram_id, confessionText, result.message_id, tags.join(','));
    await LeaderboardRepo.recordAction(user.telegram_id, 'weekly_confessions');

    // Cek achievement
    const totalConfessions = await Database.getTotalUserConfessions(user.telegram_id);
    if (totalConfessions === 1) {
      await AchievementRepo.unlockAchievement(user.telegram_id, 'FIRST_CONFESSION');
       await ctx.reply('🎉 Selamat! Kamu mendapatkan achievement *Konfessor Pemula*! Lihat di /profile.');
    } else if (totalConfessions === 10) {
       await AchievementRepo.unlockAchievement(user.telegram_id, 'TEN_CONFESSIONS');
       await ctx.reply('🎉 Hebat! Kamu mendapatkan achievement *Mulai Terbuka*! Lihat di /profile.');
    }
  }

  /**
   * Handle input teks confession dari user.
   */
  async function handleConfessText(ctx, next) {
    const userId = ctx.from.id;
    const text = ctx.message.text;

    if (text.startsWith('/')) {
      return;
    }

    if (!pending.has(userId)) {
      return;
    }

    const pendingData = pending.get(userId);
    pending.delete(userId); // Hapus dari pending

    if (text.length > 4000) {
      pending.set(userId, { timestamp: Date.now(), user: pendingData.user });
      return ctx.reply('❌ Confession terlalu panjang! Maksimal 4000 karakter.');
    }

    try {
      const user = await UserRepo.getUserById(userId); // [BARU] Ambil data user lengkap
      if (!user) {
        return ctx.reply('❌ Gagal memuat profil kamu. Coba lagi.');
      }

      const confessionText = ctx.message.text;

      // [BARU] Alur untuk menfess gratis
      if (user.free_menfess_balance > 0) {
        console.log(`✨ [FREE_MENFESS] User ${userId} menggunakan 1 saldo menfess gratis.`);
        await UserRepo.decrementFreeMenfessBalance(userId); // Fungsi baru di UserRepo
        await _sendConfession(ctx, user, confessionText);
        await ctx.reply(`✅ Menfess gratis berhasil terkirim! Sisa saldo menfess gratismu: *${user.free_menfess_balance - 1}*`, { parse_mode: 'Markdown' });
        return; // Selesai, jangan lanjutkan ke cek rate limit
      }

      // Alur reguler dengan rate limit
      const rlCfg = await getRateLimitConfig(userId);
      const recentCount = await Database.countRecentConfessions(userId, rlCfg.windowMs);

      if (recentCount >= rlCfg.maxCount) {
        const nextTime = await Database.getNextConfessionTime(userId, rlCfg.windowMs);
        const msg = renderMsg(rlCfg.msgHit, {
          count: recentCount,
          hours: rlCfg.windowHours,
          next_time: nextTime,
        });
        return ctx.reply(msg, { parse_mode: 'Markdown' });
      }

      await _sendConfession(ctx, user, confessionText);
      await Database.recordConfessionSent(userId); // Catat untuk rate limit

      const successMessage = renderMsg(rlCfg.msgSuccess, { hours: rlCfg.windowHours });
      await ctx.reply(successMessage, { parse_mode: 'Markdown' });

    } catch (err) {
      console.error('❌ ===== ERROR PROCESSING CONFESSION =====');
      console.error('👤 User:', userId);
      console.error('💥 Error:', err);
      await ctx.reply('❌ Terjadi kesalahan saat memproses menfess kamu.');
    }
  }


  return {
    handleConfessText,
    getRateLimitConfig,
  };
}
