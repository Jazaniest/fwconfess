/**
 * Admin authentication middleware.
 * Extracted from admin.js — canonical source for admin checks.
 */

/**
 * Cek apakah userId adalah admin berdasarkan ADMIN_ID di env.
 */
export function isAdmin(userId) {
  const adminId = process.env.ADMIN_ID;
  return adminId && userId.toString() === adminId.toString();
}

/**
 * Middleware Telegraf untuk proteksi handler admin.
 * Gunakan di bot.action() dan handler lain yang hanya boleh diakses admin.
 */
export async function adminMiddleware(ctx, next) {
  const userId = ctx.from.id;

  if (!isAdmin(userId)) {
    await ctx.answerCbQuery('❌ Akses ditolak! Hanya admin yang bisa mengakses fitur ini.');
    return;
  }

  return next();
}
