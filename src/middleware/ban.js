/**
 * Ban middleware — cek apakah user sedang di-ban sebelum memproses request.
 * Dipasang di bot.use() pada bot.js.
 */
import { getActiveBan } from '../repositories/ban.repo.js';

/**
 * Buat middleware ban check.
 * Mengecek status ban user di private chat dan discussion group.
 * Admin otomatis di-skip.
 */
export default function createBanMiddleware() {
  const ADMIN_ID = process.env.ADMIN_ID;
  const DISCUSSION_GROUP_ID = process.env.DISCUSSION_GROUP_ID;

  return async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return next();

    // Admin tidak pernah kena ban check
    if (ADMIN_ID && userId.toString() === ADMIN_ID.toString()) return next();

    // Hanya berlaku untuk pesan di private chat dan discussion group
    const chatId = ctx.chat?.id?.toString();
    const chatType = ctx.chat?.type;

    const isPrivate = chatType === 'private';
    const isDiscussionGroup = DISCUSSION_GROUP_ID && chatId === DISCUSSION_GROUP_ID.toString();

    if (!isPrivate && !isDiscussionGroup) return next();

    try {
      const activeBan = await getActiveBan(userId);
      if (!activeBan) return next();

      // User kena ban — susun pesan notifikasi
      const isPermanent = activeBan.ban_type === 'permanent';
      const expText = isPermanent
        ? 'permanen'
        : `sampai ${new Date(activeBan.expires_at).toLocaleString('id-ID')}`;

      const banMsg =
        `🚫 *Akses Ditolak*\n\n` +
        `Kamu telah di-ban dari bot ini.\n\n` +
        `⛔ Tipe: *${activeBan.ban_type}*\n` +
        `⏱️ Durasi: ${expText}\n` +
        `📝 Alasan: ${activeBan.reason || '-'}\n\n` +
        `_Jika kamu merasa ini kesalahan, hubungi admin._`;

      // Untuk callback query, jawab dulu agar tombol tidak loading terus
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery('🚫 Kamu di-ban dari bot ini.').catch(() => { });
      }

      // Kirim pesan ban hanya jika private (jangan spam di grup)
      if (isPrivate) {
        await ctx.reply(banMsg, { parse_mode: 'Markdown' }).catch(() => { });
      }

      return; // Stop, jangan lanjut ke handler berikutnya
    } catch (err) {
      console.error('❌ Ban middleware error:', err);
      return next(); // Kalau error, fail open (jangan block semua user)
    }
  };
}
