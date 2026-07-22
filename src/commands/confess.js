/**
 * Confess command — entry point, hanya registrasi handler ke bot.
 */
import { Markup } from 'telegraf';
import * as UserRepo from '../repositories/user.repo.js';
import * as ConfessionRepo from '../repositories/confession.repo.js';
import commentHandler from '../handlers/comment/comment.js';
import showMeHandler from '../handlers/showme/showme.js';
import reportHandler from '../handlers/report/report.js';
import { createConfessionHandler } from '../handlers/confession.handler.js';
import { privateChatOnly } from '../middleware/private-chat-only.js';


/**
 * @param {Telegraf} bot
 * @param {string|number} targetChannelId
 */
export default function confessCommand(bot, targetChannelId, chatManager) {
  if (!targetChannelId) {
    throw new Error(
      '❌ KONFIG ERROR: TARGET_CHANNEL_ID tidak di-set di environment variables!'
    );
  }

  const commentSystem = commentHandler(bot, process.env.DISCUSSION_GROUP_ID);
  const showMeSystem = showMeHandler(bot, chatManager);
  const reportSystem = reportHandler(bot, targetChannelId);

  // createConfessionHandler sekarang tidak lagi butuh `pendingMap`
  const { handleConfessText, getRateLimitConfig } = createConfessionHandler(
    targetChannelId, commentSystem, showMeSystem, reportSystem
  );

  console.log('🚀 Confess command initialized with channel:', targetChannelId);

  // Tombol Kirim Menfess
  bot.action('btn_confess', privateChatOnly('Proses mengirim menfess hanya bisa dilakukan di chat pribadi.'), async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const userId = ctx.from.id;

      if (ctx.session.isWritingConfession) {
        return ctx.reply('❌ Kamu sudah dalam mode mengirim menfess. Kirim menfess kamu atau ketik /cancel.');
      }

      const user = await UserRepo.getUserById(userId);
      if (!user) {
        return ctx.reply(
          '❌ Kamu belum terdaftar! Silakan daftar terlebih dahulu.',
          Markup.inlineKeyboard([
            [Markup.button.callback('📝 Daftar Sekarang', 'btn_register')]
          ])
        );
      }

      // Pindahkan Rate limit check ke dalam handler, tapi kita bisa lakukan pre-check di sini
      // untuk memberikan feedback lebih cepat jika menfess gratis tidak tersedia.
      if (user.free_menfess_balance <= 0) {
        const rlCfg = await getRateLimitConfig(userId);
        const recentCount = await ConfessionRepo.countRecentConfessions(userId, rlCfg.windowMs);
        if (recentCount >= rlCfg.maxCount) {
           return ctx.reply('⏰ Kamu sudah mencapai batas maksimal mengirim menfess untuk rank kamu. Coba lagi nanti.');
        }
      }

      ctx.session.isWritingConfession = true;
      ctx.session.confessionUser = user;

      const instructionText = '📝 *Kirim Menfess*\n\n' +
        'Silakan ketik dan kirim langsung menfess kamu di sini.\n\n' +
        'Kamu bisa menyertakan hingga 3 tag (contoh: `#curhat`).\n\n' +
        '⚠️ *Perhatian:*\n' +
        '• Menfess akan ditampilkan secara anonim.\n' +
        '• Pengguna lain dapat mengajakmu ngobrol via "Hit Me".\n\n' +
        '💡 Ketik `/cancel` untuk membatalkan.';

      await ctx.reply(instructionText, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('❌ Error in btn_confess:', error);
      await ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi nanti.');
    }
  });

  // Command untuk cancel confession
  bot.command('cancel', privateChatOnly(), async (ctx) => {
    if (ctx.session.isWritingConfession) {
      delete ctx.session.isWritingConfession;
      delete ctx.session.confessionUser;
      await ctx.reply('❌ Pengiriman menfess dibatalkan.');
    } else {
      await ctx.reply('❌ Tidak ada proses menfess yang sedang berlangsung.');
    }
  });

  return {
    handleConfessText,
    isUserPending: (ctx) => !!ctx.session.isWritingConfession,
  };
}
