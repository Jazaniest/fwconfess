import { db } from '../services/db.js';

/**
 * Middleware untuk memeriksa dan menerapkan badge pengguna sebagai custom title di grup.
 */
export function badgeEnforcer() {
  return async (ctx, next) => {
    // Hanya berjalan di grup dan supergrup, dan hanya untuk pesan teks
    if ((ctx.chat?.type !== 'group' && ctx.chat?.type !== 'supergroup') || !ctx.message?.text) {
      return next();
    }

    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    try {
      // Ambil badge aktif dari database
      const [rows] = await db.query('SELECT * FROM user_badges WHERE user_id = ? AND expires_at > NOW() LIMIT 1', [userId]);
      const activeBadge = rows[0];

      // Ambil custom title pengguna saat ini
      const chatMember = await ctx.getChatMember(userId);
      const currentTitle = chatMember.custom_title || '';

      if (activeBadge) {
        const newTitle = `${activeBadge.badge_icon} ${activeBadge.badge_title}`;
        // Hanya update jika title berbeda, untuk menghindari panggilan API yang tidak perlu
        if (currentTitle !== newTitle) {
          await ctx.setChatAdministratorCustomTitle(newTitle);
          console.log(`🎖️ Badge '${newTitle}' diterapkan untuk user ${userId} di chat ${chatId}.`);
        }
      } else {
        // Jika tidak ada badge aktif tapi ada custom title, hapus
        if (currentTitle !== '') {
          await ctx.setChatAdministratorCustomTitle('');
          console.log(`🚫 Badge dihapus untuk user ${userId} di chat ${chatId}.`);
        }
      }
    } catch (error) {
      // Seringkali error karena bot tidak punya hak admin atau pengguna bukan admin.
      // Kita bisa abaikan error ini di log agar tidak berisik.
      if (error.code !== 400 && error.code !== 403) {
        console.error(`❌ Gagal menerapkan badge untuk user ${userId}:`, error.description || error.message);
      }
    }

    return next();
  };
}
