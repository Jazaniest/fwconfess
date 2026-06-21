/**
 * Confess command — entry point, hanya registrasi handler ke bot.
 * Business logic ada di handlers/confession.handler.js
 */
import { Markup } from 'telegraf';
import { Database } from './database.js';
import commentHandler from '../handlers/comment/comment.js';
import showMeHandler from '../handlers/showme/showme.js';
import reportHandler from '../handlers/report/report.js';
import { renderMsg } from '../utils/formatters.js';
import { createConfessionHandler } from '../handlers/confession.handler.js';

/**
 * @param {Telegraf} bot
 * @param {string|number} targetChannelId
 */
export default function confessCommand(bot, targetChannelId) {
  if (!targetChannelId) {
    throw new Error(
      '❌ KONFIG ERROR: TARGET_CHANNEL_ID tidak di-set di environment variables!\n' +
      'Tambahkan TARGET_CHANNEL_ID ke file .env kamu.'
    );
  }

  const pending = new Map();
  const commentSystem = commentHandler(bot, process.env.DISCUSSION_GROUP_ID);
  const showMeSystem = showMeHandler(bot);
  const reportSystem = reportHandler(bot, targetChannelId);

  const { handleConfessText, getRateLimitConfig } = createConfessionHandler(
    pending, targetChannelId, commentSystem, showMeSystem, reportSystem
  );

  console.log('🚀 Confess command initialized with channel:', targetChannelId);
  console.log('💬 Discussion group ID:', process.env.DISCUSSION_GROUP_ID);
  console.log('💬 Comment system enabled:', commentSystem.isCommentSystemEnabled());

  // Tombol Kirim Menfess
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

      // Check rate limit
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

  // Debug commands
  bot.command('debug_pending', async (ctx) => {
    if (ctx.from.id === parseInt(process.env.ADMIN_ID)) {
      const pendingList = Array.from(pending.entries()).map(([id, data]) =>
        `${id}: ${data.user.gender || 'Unknown'} - ${new Date(data.timestamp).toLocaleString()}`
      );
      await ctx.reply(`Pending users:\n${pendingList.join('\n') || 'None'}`);
    }
  });

  return {
    handleConfessText,
    isUserPending: (userId) => pending.has(userId),
    getPendingUsers: () => Array.from(pending.keys()),
    clearPending: (userId) => pending.delete(userId),
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
