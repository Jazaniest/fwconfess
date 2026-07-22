/**
 * Confession handler — business logic untuk menfess.
 * Factory function: menerima dependencies dan mengembalikan handler functions.
 */
import { Database } from '../commands/database.js'; // This seems old, let's use Repos
import * as ConfessionRepo from '../repositories/confession.repo.js';
import { formatConfessionMessage, renderMsg } from '../utils/formatters.js';
import * as LeaderboardRepo from '../repositories/leaderboard.repo.js';
import * as AchievementRepo from '../repositories/achievement.repo.js';
import { configService } from '../services/config.service.js';
import * as UserRepo from '../repositories/user.repo.js';

/**
 * Buat confession handler.
 * @param {string|number} targetChannelId
 * @param {object} commentSystem
 * @param {object} showMeSystem
 * @param {object} reportSystem
 */
export function createConfessionHandler(targetChannelId, commentSystem, showMeSystem, reportSystem) {

  /**
   * Ambil config rate limit dari database.
   */
  async function getRateLimitConfig(userId) {
    const rankId = await ConfessionRepo.getEffectiveRankId(userId);
    const maxCount = await ConfessionRepo.getConfessionLimitByRankId(rankId);

    // This can be simplified if configService is used consistently
    const windowHours = parseFloat(await configService.get('confession_window_hours', '8'));
    const msgHit = await configService.get('ratelimit_msg_hit', '⏰ Kamu sudah menfess {count}x dalam {hours} jam terakhir.\n\nCoba lagi setelah: *{next_time}*');
    const msgSuccess = await configService.get('ratelimit_msg_success', '🎉 *Menfess berhasil dipublish!*\n\n⏰ Kamu bisa menfess lagi dalam {hours} jam');

    return {
      maxCount,
      windowMs: windowHours * 60 * 60 * 1000,
      windowHours,
      msgHit,
      msgSuccess,
    };
  }

  /**
   * [DIUBAH] Fungsi terpusat untuk mengirim menfess dengan alur yang aman.
   * @private
   */
  async function _sendConfession(ctx, user, confessionText) {
    let confessionId;
    try {
        const tags = (confessionText.match(/#\w+/g) || []).slice(0, 3);
        const finalMessageBody = confessionText.replace(/#\w+/g, '').trim();

        // 1. Simpan menfess sebagai 'pending' dan dapatkan ID-nya
        confessionId = await ConfessionRepo.createPendingConfession(user.telegram_id, finalMessageBody, tags.join(','));

        const finalMessage = `${formatConfessionMessage(finalMessageBody, user)}\n\n${tags.join(' ')}`;

        const commentUrl = await commentSystem.sendToDiscussionGroup(ctx, finalMessage);
        const inlineKeyboard = commentSystem.createInlineKeyboard(commentUrl, user.telegram_id, confessionId);

        // 2. Kirim ke channel
        const result = await ctx.telegram.sendMessage(targetChannelId, finalMessage, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: inlineKeyboard }
        });

        // 3. Finalisasi dengan message_id
        await ConfessionRepo.finalizeConfession(confessionId, result.message_id);

        // Update tombol showme dan report dengan ID yang benar
        try {
            const buttons = [
                [
                    showMeSystem.createShowMeButton(confessionId)[0], // Use confessionId
                    reportSystem.createReportButton(confessionId)   // Use confessionId
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
            console.error('⚠️ Gagal menambahkan/mengupdate tombol:', editErr.message);
        }

        // Catat aksi dan achievement
        await LeaderboardRepo.recordAction(user.telegram_id, 'weekly_confessions');
        const totalConfessions = await UserRepo.getTotalUserConfessions(user.telegram_id); // Use new efficient query
        if (totalConfessions === 1) {
            const ach = await AchievementRepo.unlockAchievement(user.telegram_id, 'FIRST_CONFESSION');
            if(ach) await ctx.reply(`🎉 Selamat! Kamu mendapatkan achievement *${ach.title}*! Lihat di /profile.`);
        } else if (totalConfessions === 10) {
            const ach = await AchievementRepo.unlockAchievement(user.telegram_id, 'TEN_CONFESSIONS');
            if(ach) await ctx.reply(`🎉 Hebat! Kamu mendapatkan achievement *${ach.title}*! Lihat di /profile.`);
        }

    } catch (error) {
        // Jika terjadi error, tandai menfess sebagai 'failed'
        if (confessionId) {
            await ConfessionRepo.failConfession(confessionId);
        }
        throw error; // Lemparkan lagi agar bisa ditangani di handleConfessText
    }
  }

  /**
   * Handle input teks confession dari user.
   */
  async function handleConfessText(ctx, next) {
    if (!ctx.session.isWritingConfession) {
      return next();
    }

    const userId = ctx.from.id;
    const text = ctx.message.text;

    if (text.startsWith('/')) return;

    // Hapus sesi setelah diproses
    const user = ctx.session.confessionUser;
    delete ctx.session.isWritingConfession;
    delete ctx.session.confessionUser;

    if (!user) {
        return ctx.reply('❌ Terjadi kesalahan, data user tidak ditemukan. Silakan mulai lagi dari /start.');
    }

    if (text.length > 4000) {
      return ctx.reply('❌ Confession terlalu panjang! Maksimal 4000 karakter.');
    }

    try {
      await ctx.reply('⏳ Mengirim menfess kamu...');

      // Alur untuk menfess gratis
      if (user.free_menfess_balance > 0) {
        console.log(`✨ [FREE_MENFESS] User ${userId} menggunakan 1 saldo menfess gratis.`);
        await UserRepo.decrementFreeMenfessBalance(userId);
        await _sendConfession(ctx, user, text);
        const newBalance = await UserRepo.getUserById(userId).then(u => u.free_menfess_balance);
        await ctx.reply(`✅ Menfess gratis berhasil terkirim! Sisa saldo: *${newBalance}*`, { parse_mode: 'Markdown' });
        return;
      }

      // Alur reguler dengan rate limit
      const rlCfg = await getRateLimitConfig(userId);
      const recentCount = await ConfessionRepo.countRecentConfessions(userId, rlCfg.windowMs);

      if (recentCount >= rlCfg.maxCount) {
        const nextTime = await ConfessionRepo.getOldestActionTime(userId, 'confess', rlCfg.windowMs);
        const msg = renderMsg(rlCfg.msgHit, {
          count: recentCount,
          hours: rlCfg.windowHours,
          next_time: new Date(nextTime.getTime() + rlCfg.windowMs).toLocaleString('id-ID'),
        });
        return ctx.reply(msg, { parse_mode: 'Markdown' });
      }

      await _sendConfession(ctx, user, text);
      await ConfessionRepo.recordActionSent(userId, 'confess');

      const successMessage = renderMsg(rlCfg.msgSuccess, { hours: rlCfg.windowHours });
      await ctx.reply(successMessage, { parse_mode: 'Markdown' });

    } catch (err) {
      console.error('❌ ===== ERROR PROCESSING CONFESSION =====');
      console.error('👤 User:', userId);
      console.error('💥 Error:', err);
      await ctx.reply('❌ Terjadi kesalahan saat memproses menfess kamu. Silakan coba lagi atau hubungi admin.');
    }
  }


  return {
    handleConfessText,
    getRateLimitConfig,
  };
}
