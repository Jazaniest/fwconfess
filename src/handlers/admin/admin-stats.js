/**
 * Admin stats handler — business logic untuk statistik bot.
 */
import { Database } from '../../commands/database.js';

export async function handleAdminStats(ctx) {
  try {
    const stats = {
      totalUsers: await Database.getTotalUsers(),
      totalConfessions: await Database.getTotalConfessions(),
      totalComments: 0,
      activeToday: await Database.getActiveUsersToday(),
      bannedUsers: await Database.getBannedUsersCount(),
      reportsCount: await Database.getTotalReports()
    };

    const statsText = `📊 *Statistik Bot*\n\n` +
      `👥 Total Users: *${stats.totalUsers}*\n` +
      `📝 Total Menfess: *${stats.totalConfessions}*\n` +
      `💬 Total Comments: *${stats.totalComments}*\n` +
      `📈 Aktif Hari Ini: *${stats.activeToday}*\n` +
      `🚫 User Banned: *${stats.bannedUsers}*\n` +
      `📋 Total Laporan: *${stats.reportsCount}*\n\n` +
      `🕐 _Last updated: ${new Date().toLocaleString('id-ID')}_`;

    await ctx.editMessageText(statsText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔄 Refresh', callback_data: 'admin_stats' },
            { text: '📈 Detail Stats', callback_data: 'admin_detailed_stats' }
          ],
          [{ text: '🏠 Kembali', callback_data: 'back_to_admin' }]
        ]
      }
    });
  } catch (error) {
    console.error('❌ Error getting stats:', error);
    await ctx.editMessageText(
      '❌ Error memuat statistik. Silakan coba lagi.',
      { reply_markup: { inline_keyboard: [[{ text: '🔄 Coba Lagi', callback_data: 'admin_stats' }], [{ text: '🏠 Kembali', callback_data: 'back_to_admin' }]] } }
    );
  }
}
