/**
 * Confession handler — business logic untuk menfess.
 * Factory function: menerima dependencies dan mengembalikan handler functions.
 */
import { Database } from '../commands/database.js';
import { formatConfessionMessage, renderMsg } from '../utils/formatters.js';
import * as LeaderboardRepo from '../repositories/leaderboard.repo.js';
import * as AchievementRepo from '../repositories/achievement.repo.js';
import { configService } from '../services/config.service.js';




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


      if (text.length > 4000) {
        pending.set(userId, { timestamp: now, user });
        return ctx.reply(
          '❌ Confession terlalu panjang!\n\n' +
          'Maksimal 4000 karakter. Saat ini: ' + text.length + ' karakter'
        );
      }

      // Simpan menfess dan langsung proses
      const confessionText = ctx.message.text;

      // Ekstrak tags dari teks confession
      const tags = (confessionText.match(/#\w+/g) || []).slice(0, 3);

      try {
        // Cek rate limit
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

        const user = await Database.getUserById(userId);
        const confessionMessage = formatConfessionMessage(confessionText, user);

        // Hapus tag dari pesan utama agar tidak duplikat jika user sudah menyertakannya
        const finalMessageBody = confessionText.replace(/#\w+/g, '').trim();
        const finalMessage = `${formatConfessionMessage(finalMessageBody, user)}\n\n${tags.join(' ')}`;

        const commentUrl = await commentSystem.sendToDiscussionGroup(ctx, finalMessage);
        const inlineKeyboard = commentSystem.createInlineKeyboard(commentUrl, userId);

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

        await Database.recordConfessionSent(userId);
        await Database.saveConfession(userId, confessionText, result.message_id, tags.join(','));

        await LeaderboardRepo.recordAction(userId, 'weekly_confessions');

        const totalConfessions = await Database.getTotalUserConfessions(userId);
        if (totalConfessions === 1) {
          await AchievementRepo.unlockAchievement(userId, 'FIRST_CONFESSION');
           await ctx.reply('🎉 Selamat! Kamu mendapatkan achievement *Konfessor Pemula*! Lihat di /profile.');
        } else if (totalConfessions === 10) {
           await AchievementRepo.unlockAchievement(userId, 'TEN_CONFESSIONS');
           await ctx.reply('🎉 Hebat! Kamu mendapatkan achievement *Mulai Terbuka*! Lihat di /profile.');
        }

        const successMessage = renderMsg(rlCfg.msgSuccess, { hours: rlCfg.windowHours });
        await ctx.reply(successMessage, { parse_mode: 'Markdown' });

      } catch (err) {
        console.error('❌ ===== ERROR PROCESSING CONFESSION (Unified) =====');
        console.error('👤 User:', userId);
        console.error('💥 Error:', err);
        await ctx.reply('❌ Terjadi kesalahan saat memproses menfess kamu.');
      }
    } catch (err) {
      console.error('❌ ===== ERROR PROCESSING CONFESSION (Initial) =====');
      console.error('👤 User:', userId);
      console.error('💥 Error:', err);
      // ... (error handling lainnya)
      await ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi nanti.');
    }
  }


  return {
    handleConfessText,
    getRateLimitConfig,
  };
}
