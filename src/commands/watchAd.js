/**
 * Command: /tontoniklan
 *
 * Mengizinkan user menonton iklan untuk mendapatkan menfess gratis.
 */
import { Markup } from 'telegraf';
import { db } from '../services/db.js';
import { configService } from '../services/config.service.js';
import { privateChatOnly } from '../middleware/private-chat-only.js';
import crypto from 'crypto';

export default function watchAdCommand(bot) {
  bot.command('tontoniklan', privateChatOnly('Fitur ini hanya tersedia di chat pribadi.'), async (ctx) => {
    const userId = ctx.from.id;

    try {
      // 1. Cek apakah fitur diaktifkan
      if (!configService.isFeatureEnabled('watch_ad')) {
        return ctx.reply('Fitur tonton iklan sedang tidak tersedia saat ini.');
      }

      // 2. Cek batas harian
      const dailyLimit = parseInt(configService.get('ads_watch_daily_limit', '3'), 10);
      const todayCount = await countTodayViews(userId);

      if (todayCount >= dailyLimit) {
        return ctx.reply(`Kamu sudah mencapai batas harian (${dailyLimit}x) untuk menonton iklan. Coba lagi besok ya.`);
      }

      // 3. Buat token unik
      const token = crypto.randomBytes(20).toString('hex');
      const adWebsiteUrl = process.env.AD_WEBSITE_URL;

      if (!adWebsiteUrl) {
          console.error('❌ AD_WEBSITE_URL tidak diatur di .env');
          return ctx.reply('Terjadi kesalahan konfigurasi. Hubungi admin.');
      }

      const fullUrl = `${adWebsiteUrl}?token=${token}`;

      // 4. Simpan token ke database (berlaku 10 menit)
      await db.query(
        'INSERT INTO `ad_view_tokens` (`token`, `user_id`, `expires_at`) VALUES (?, ?, NOW() + INTERVAL 10 MINUTE)',
        [token, userId]
      );

      console.log(`🎬 [AD_WATCH] User ${userId} meminta link iklan. Token: ${token}`);

      // 5. Kirim URL ke pengguna
      await ctx.reply(
        '🎁 Dapatkan 1 menfess gratis!\n\nKlik tombol di bawah untuk menonton berita/iklan. Setelah selesai, hadiah akan otomatis masuk.',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎬 Tonton Sekarang', url: fullUrl }],
            ]
          }
        }
      );

    } catch (error) {
      console.error(`❌ Error pada /tontoniklan untuk user ${userId}:`, error);
      return ctx.reply('Terjadi kesalahan. Silakan coba lagi nanti.');
    }
  });
}

/**
 * Menghitung berapa kali user telah menonton iklan hari ini.
 * @param {number} userId
 */
async function countTodayViews(userId) {
  const [[{ count }]] = await db.query(
    "SELECT COUNT(*) as count FROM `ad_view_history` WHERE `user_id` = ? AND `viewed_at` >= CURDATE()",
    [userId]
  );
  return count;
}
