/**
 * Middleware: ban.js
 *
 * Sumber: blok "Ban middleware global" di bot.js.
 * Diekstrak menjadi fungsi yang bisa dipakai ulang dan ditest secara terpisah.
 */

import { getActiveBan } from '../repositories/ban.repo.js';
import { isAdminUser }  from './admin-auth.js';

/**
 * Buat Telegraf middleware untuk cek ban.
 *
 * Middleware ini:
 * - Hanya aktif di private chat dan (opsional) discussion group
 * - Admin (ADMIN_ID di env) selalu dilewati tanpa pengecekan
 * - Jika user kena ban → kirim notifikasi dan hentikan chain (tanpa next())
 * - Jika error DB → fail-open (panggil next() agar tidak memblokir semua user)
 *
 * Cara pakai di bot.js:
 *   import { createBanMiddleware } from './middleware/ban.js';
 *   bot.use(createBanMiddleware());
 *
 * @returns {Function} Telegraf middleware (ctx, next) => Promise<void>
 */
export function createBanMiddleware() {
  const DISCUSSION_GROUP_ID = process.env.DISCUSSION_GROUP_ID;

  return async function banMiddleware(ctx, next) {
    const userId = ctx.from?.id;
    if (!userId) return next();

    // Admin tidak pernah kena ban check
    if (isAdminUser(userId)) return next();

    // Hanya berlaku untuk private chat dan discussion group
    const chatId   = ctx.chat?.id?.toString();
    const chatType = ctx.chat?.type;

    const isPrivate         = chatType === 'private';
    const isDiscussionGroup = DISCUSSION_GROUP_ID &&
      chatId === DISCUSSION_GROUP_ID.toString();

    if (!isPrivate && !isDiscussionGroup) return next();

    try {
      const activeBan = await getActiveBan(userId);
      if (!activeBan) return next();

      // ── User terkena ban — bangun pesan notifikasi ──────────────────────────
      const isPermanent = activeBan.ban_type === 'permanent';
      const expText     = isPermanent
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
        await ctx.answerCbQuery('🚫 Kamu di-ban dari bot ini.').catch(() => {});
      }

      // Kirim notifikasi hanya di private (tidak spam di grup)
      if (isPrivate) {
        await ctx.reply(banMsg, { parse_mode: 'Markdown' }).catch(() => {});
      }

      // Pesan di discussion group bisa dihapus diam-diam (uncomment jika diinginkan):
      // if (isDiscussionGroup && ctx.message?.message_id) {
      //   await ctx.telegram.deleteMessage(chatId, ctx.message.message_id).catch(() => {});
      // }

      // Hentikan middleware chain — user yang di-ban tidak lanjut ke handler
      return;

    } catch (err) {
      console.error('❌ Ban middleware error:', err);
      return next(); // fail-open: error DB tidak boleh memblokir semua user
    }
  };
}