/**
 * Middleware: admin-auth.js
 *
 * Sumber: isAdmin() dari admin.js + isAdminUser() dari hitme.js.
 * Keduanya identik — dicentralisasi di sini agar tidak ada duplikasi.
 */

// ─── Pure helper ─────────────────────────────────────────────────────────────

/**
 * Cek apakah userId adalah admin berdasarkan ADMIN_ID di env.
 * Fungsi murni — tidak butuh ctx, bisa dipanggil di mana saja.
 *
 * @param {number|string} userId
 * @returns {boolean}
 */
export function isAdminUser(userId) {
  const adminId = process.env.ADMIN_ID;
  return !!adminId && userId.toString() === adminId.toString();
}

// ─── Telegraf middleware ──────────────────────────────────────────────────────

/**
 * Middleware Telegraf untuk action/command yang hanya boleh diakses admin.
 * Jika bukan admin:
 *   - Callback query → answerCbQuery dengan pesan error (tombol tidak loading)
 *   - Command biasa  → reply pesan error
 * Jika admin → lanjut ke next()
 *
 * Cara pakai:
 *   bot.action('admin_stats', adminMiddleware, async (ctx) => { ... });
 *   bot.command('forceend',   adminMiddleware, async (ctx) => { ... });
 *
 * @param {import('telegraf').Context} ctx
 * @param {Function} next
 */
export async function adminMiddleware(ctx, next) {
  const userId = ctx.from?.id;

  if (!userId || !isAdminUser(userId)) {
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery('❌ Akses ditolak! Hanya admin yang bisa mengakses fitur ini.').catch(() => {});
    } else {
      await ctx.reply('❌ Command ini hanya untuk admin.').catch(() => {});
    }
    return;
  }

  return next();
}