import { Database } from '../../commands/database.js';

// ─── Utility helpers (scoped to stats) ───────────────────────────────────────

async function getTotalUsers() {
  try { return await Database.getTotalUsers(); } catch { return 0; }
}
async function getTotalConfessions() {
  try { return await Database.getTotalConfessions(); } catch { return 0; }
}
async function getTotalComments() {
  // Note: belum diimplementasikan di Database class
  return 0;
}
async function getActiveToday() {
  try { return await Database.getActiveUsersToday(); } catch { return 0; }
}
async function getBannedUsersCount() {
  try { return await Database.getBannedUsersCount(); } catch { return 0; }
}
async function getTotalReports() {
  try { return await Database.getTotalReports(); } catch { return 0; }
}
async function getRecentReports(limit = 5) {
  try { return await Database.getRecentReports(limit); } catch { return []; }
}

// ─── Setup ────────────────────────────────────────────────────────────────────

/**
 * Setup handler statistik bot
 * @param {Telegraf} bot
 * @param {Function} adminMiddleware
 */
export function setupAdminStats(bot, adminMiddleware) {
  bot.action('admin_stats', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery('📊 Memuat statistik...');

    try {
      const stats = {
        totalUsers       : await getTotalUsers(),
        totalConfessions : await getTotalConfessions(),
        totalComments    : await getTotalComments(),
        activeToday      : await getActiveToday(),
        bannedUsers      : await getBannedUsersCount(),
        reportsCount     : await getTotalReports()
      };

      const statsText =
        `📊 *Statistik Bot*\n\n` +
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
              { text: '🔄 Refresh',      callback_data: 'admin_stats'          },
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
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Coba Lagi', callback_data: 'admin_stats' }],
              [{ text: '🏠 Kembali',   callback_data: 'back_to_admin' }]
            ]
          }
        }
      );
    }
  });

  bot.action('admin_detailed_stats', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery('📈 Memuat detail...');
    try {
      const [sessionStats, reportStats, newUsers] = await Promise.all([
        Database.getSessionStats(),
        Database.getReportStats(),
        Database.countNewUsers(),
      ]);

      const text =
        `📈 *Detail Statistik*\n\n` +
        `👥 *Registrasi:*\n` +
        `• 24 jam: *${newUsers.day1}*\n` +
        `• 7 hari: *${newUsers.day7}*\n` +
        `• 30 hari: *${newUsers.day30}*\n\n` +
        `💬 *Sesi Chat:*\n` +
        `• Total: *${sessionStats.total}*\n` +
        `• Aktif: *${sessionStats.active}*\n` +
        `• Selesai: *${sessionStats.completed}*\n` +
        `• Pesan terkirim: *${sessionStats.messages}*\n` +
        `• Reveal: *${sessionStats.reveals}*\n\n` +
        `📋 *Laporan:*\n` +
        `• Total: *${reportStats.total}*\n` +
        `• Pending: *${reportStats.pending}*\n` +
        `• Ditangani: *${reportStats.handled}*\n` +
        `• Ditolak: *${reportStats.rejected}*\n\n` +
        `🕐 _Last updated: ${new Date().toLocaleString('id-ID')}_`;

      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Refresh',  callback_data: 'admin_detailed_stats' },
              { text: '🔙 Kembali',  callback_data: 'admin_stats'          }
            ]
          ]
        }
      });
    } catch (error) {
      console.error('❌ Error getting detailed stats:', error);
      await ctx.editMessageText('❌ Error memuat detail statistik.', {
        reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'admin_stats' }]] }
      });
    }
  });
}

export { getTotalUsers, getTotalConfessions, getTotalReports, getRecentReports };