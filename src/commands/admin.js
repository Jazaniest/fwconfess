import { Markup } from 'telegraf';
import { Database } from './database.js';

/**
 * Handler untuk Admin Panel
 * @param {Telegraf} bot
 */

export default function adminPanel(bot) {
  console.log('👑 Admin panel initialized');

  /**
   * Fungsi untuk memeriksa apakah user adalah admin
   * @param {number} userId - ID user yang akan dicek
   * @returns {boolean} - True jika user adalah admin
   */
  function isAdmin(userId) {
    const adminId = process.env.ADMIN_ID;
    return adminId && userId.toString() === adminId.toString();
  }

  /**
   * Middleware khusus untuk memeriksa apakah user adalah admin
   * @param {Context} ctx - Context dari Telegraf
   * @param {Function} next - Fungsi next untuk melanjutkan
   */
  async function adminMiddleware(ctx, next) {
    const userId = ctx.from.id;
    
    if (!isAdmin(userId)) {
      await ctx.answerCbQuery('❌ Akses ditolak! Hanya admin yang bisa mengakses fitur ini.');
      return;
    }
    
    return next();
  }

  /**
   * Fungsi untuk menampilkan menu admin
   * @param {Context} ctx - Context dari Telegraf
   */
  async function showAdminMenu(ctx) {
    const adminText = `👑 *Admin Panel*\n\nSelamat datang Admin ${ctx.from.first_name}!\n\nPilih opsi pengelolaan:`;
    const buttons = [
      // Baris pertama - Menu User dan Statistik
      [
        Markup.button.callback('👤 Profile', 'btn_profile'),
        Markup.button.callback('📊 Statistik Bot', 'admin_stats')
      ],
      // Baris kedua - Menu Admin khusus
      [
        Markup.button.callback('👥 Kelola User', 'admin_users'),
        Markup.button.callback('📋 Laporan User', 'admin_reports')
      ],
      // Baris ketiga - Menu Admin khusus
      [
        Markup.button.callback('🚫 Ban/Unban User', 'admin_ban'),
        Markup.button.callback('📢 Broadcast', 'admin_broadcast')
      ],
      // Baris keempat - Menu Admin khusus
      [
        Markup.button.callback('⚙️ Pengaturan Bot', 'admin_settings'),
        Markup.button.callback('🔧 Debug Info', 'admin_debug')
      ],
      // Baris kelima - Menu navigasi
      [
        Markup.button.callback('💬 Mode User', 'switch_to_user'),
        Markup.button.callback('ℹ️ Bantuan', 'btn_help')
      ]
    ];
    await ctx.reply(adminText, { 
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons }
    });
  }

  // === ADMIN MENU HANDLERS ===

  // Handler untuk statistik bot
  bot.action('admin_stats', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery('📊 Memuat statistik...');
    
    try {
      // TODO: Implement actual database queries
      const stats = {
        totalUsers: await getTotalUsers(),
        totalConfessions: await getTotalConfessions(),
        totalComments: await getTotalComments(),
        activeToday: await getActiveToday(),
        bannedUsers: await getBannedUsers(),
        reportsCount: await getTotalReports()
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
        Markup.inlineKeyboard([
          [{ text: '🔄 Coba Lagi', callback_data: 'admin_stats' }],
          [{ text: '🏠 Kembali', callback_data: 'back_to_admin' }]
        ])
      );
    }
  });

  // Handler untuk laporan user
  bot.action('admin_reports', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery('📋 Memuat laporan...');
    
    try {
      // TODO: Implement actual database queries
      const recentReports = await getRecentReports(5);
      const reportStats = await getReportStats();
      
      let reportsText = `📋 *Laporan User*\n\n`;
      reportsText += `📊 *Ringkasan:*\n`;
      reportsText += `• Total Laporan: *${reportStats.total}*\n`;
      reportsText += `• Pending: *${reportStats.pending}*\n`;
      reportsText += `• Ditangani: *${reportStats.handled}*\n`;
      reportsText += `• Ditolak: *${reportStats.rejected}*\n\n`;
      
      if (recentReports.length > 0) {
        reportsText += `🆕 *Laporan Terbaru:*\n`;
        recentReports.forEach((report, index) => {
          const status = getReportStatusEmoji(report.status);
          reportsText += `${index + 1}. ${status} ${report.type} - ${report.date}\n`;
        });
      } else {
        reportsText += `✅ Tidak ada laporan terbaru`;
      }
      
      await ctx.editMessageText(reportsText, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📋 Semua Laporan', callback_data: 'admin_all_reports' },
              { text: '⏰ Pending', callback_data: 'admin_pending_reports' }
            ],
            [
              { text: '✅ Ditangani', callback_data: 'admin_handled_reports' },
              { text: '❌ Ditolak', callback_data: 'admin_rejected_reports' }
            ],
            [{ text: '🏠 Kembali', callback_data: 'back_to_admin' }]
          ]
        }
      });
      
    } catch (error) {
      console.error('❌ Error getting reports:', error);
      await ctx.editMessageText(
        '❌ Error memuat laporan. Silakan coba lagi.',
        Markup.inlineKeyboard([
          [{ text: '🔄 Coba Lagi', callback_data: 'admin_reports' }],
          [{ text: '🏠 Kembali', callback_data: 'back_to_admin' }]
        ])
      );
    }
  });

  // Handler untuk kelola user
  bot.action('admin_users', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      '👥 *Kelola User*\n\nPilih opsi pengelolaan user:',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📋 Daftar User', callback_data: 'admin_list_users' },
              { text: '🔍 Cari User', callback_data: 'admin_search_user' }
            ],
            [
              { text: '📊 User Stats', callback_data: 'admin_user_stats' },
              { text: '🚫 User Banned', callback_data: 'admin_banned_users' }
            ],
            [
              { text: '🆕 User Baru', callback_data: 'admin_new_users' },
              { text: '👑 Promote User', callback_data: 'admin_promote_user' }
            ],
            [{ text: '🏠 Kembali', callback_data: 'back_to_admin' }]
          ]
        }
      }
    );
  });

  // Handler untuk ban/unban user
  bot.action('admin_ban', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      '🚫 *Ban/Unban User*\n\nPilih aksi yang ingin dilakukan:',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🚫 Ban User', callback_data: 'admin_ban_user' },
              { text: '✅ Unban User', callback_data: 'admin_unban_user' }
            ],
            [
              { text: '📋 Daftar Banned', callback_data: 'admin_banned_list' },
              { text: '📊 Ban Statistics', callback_data: 'admin_ban_stats' }
            ],
            [
              { text: '⏰ Temporary Ban', callback_data: 'admin_temp_ban' },
              { text: '🔍 Cek Status Ban', callback_data: 'admin_check_ban' }
            ],
            [{ text: '🏠 Kembali', callback_data: 'back_to_admin' }]
          ]
        }
      }
    );
  });

  // Handler untuk broadcast
  bot.action('admin_broadcast', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      '📢 *Broadcast Message*\n\n' +
      'Pilih jenis broadcast yang ingin dikirim:\n\n' +
      '⚠️ *Perhatian:* Gunakan fitur ini dengan bijak!',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📢 Broadcast Umum', callback_data: 'admin_broadcast_all' },
              { text: '👥 Broadcast Target', callback_data: 'admin_broadcast_target' }
            ],
            [
              { text: '📊 Preview Audience', callback_data: 'admin_broadcast_preview' },
              { text: '📝 Draft Message', callback_data: 'admin_broadcast_draft' }
            ],
            [{ text: '🏠 Kembali', callback_data: 'back_to_admin' }]
          ]
        }
      }
    );
  });

  // Handler untuk pengaturan bot
  bot.action('admin_settings', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      '⚙️ *Pengaturan Bot*\n\nPilih pengaturan yang ingin diubah:',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '⏰ Rate Limit', callback_data: 'admin_set_ratelimit' },
              { text: '📝 Max Length', callback_data: 'admin_set_maxlength' }
            ],
            [
              { text: '🔧 Maintenance', callback_data: 'admin_maintenance' },
              { text: '📊 Logs', callback_data: 'admin_logs' }
            ],
            [
              { text: '🎯 Auto Mod', callback_data: 'admin_automod' },
              { text: '📢 Announcements', callback_data: 'admin_announcements' }
            ],
            [{ text: '🏠 Kembali', callback_data: 'back_to_admin' }]
          ]
        }
      }
    );
  });

  // Handler untuk debug info
  bot.action('admin_debug', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery('🔧 Memuat debug info...');
    
    const debugInfo = {
      botId: ctx.botInfo?.id || 'Unknown',
      chatId: ctx.chat.id,
      userId: ctx.from.id,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      env: {
        targetChannel: process.env.TARGET_CHANNEL_ID ? '✅ Set' : '❌ Not Set',
        discussionGroup: process.env.DISCUSSION_GROUP_ID ? '✅ Set' : '❌ Not Set',
        adminId: process.env.ADMIN_ID ? '✅ Set' : '❌ Not Set',
        dbUrl: process.env.DATABASE_URL ? '✅ Connected' : '❌ Not Set'
      }
    };
    
    const debugText = `🔧 *Debug Information*\n\n` +
      `🤖 Bot ID: \`${debugInfo.botId}\`\n` +
      `💬 Chat ID: \`${debugInfo.chatId}\`\n` +
      `👤 User ID: \`${debugInfo.userId}\`\n` +
      `⏰ Timestamp: \`${debugInfo.timestamp}\`\n` +
      `🕐 Uptime: \`${debugInfo.uptime}s\`\n` +
      `💾 Memory Used: \`${Math.round(debugInfo.memory.used / 1024 / 1024)}MB\`\n` +
      `💾 Memory Total: \`${Math.round(debugInfo.memory.rss / 1024 / 1024)}MB\`\n` +
      `🟢 Node Version: \`${debugInfo.nodeVersion}\`\n\n` +
      `📋 *Environment Status:*\n` +
      `📺 Target Channel: ${debugInfo.env.targetChannel}\n` +
      `💬 Discussion Group: ${debugInfo.env.discussionGroup}\n` +
      `👑 Admin ID: ${debugInfo.env.adminId}\n` +
      `🗄️ Database: ${debugInfo.env.dbUrl}`;
    
    await ctx.editMessageText(debugText, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔄 Refresh', callback_data: 'admin_debug' },
            { text: '📊 System Info', callback_data: 'admin_system_info' }
          ],
          [
            { text: '📝 Error Logs', callback_data: 'admin_error_logs' },
            { text: '🔍 Activity Logs', callback_data: 'admin_activity_logs' }
          ],
          [{ text: '🏠 Kembali', callback_data: 'back_to_admin' }]
        ]
      }
    });
  });

  // Handler untuk switch ke mode user
  bot.action('switch_to_user', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery('💬 Beralih ke mode user...');
    await ctx.editMessageText(
      `👤 *Mode User*\n\nAnda sekarang dalam mode user biasa, Admin ${ctx.from.first_name}`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Kembali ke Admin Panel', callback_data: 'back_to_admin' }]
          ]
        }
      }
    );
  });

  // Handler untuk kembali ke admin panel
  bot.action('back_to_admin', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery('👑 Kembali ke Admin Panel...');
    await showAdminMenu(ctx);
  });

  // === UTILITY FUNCTIONS ===

  /**
   * Database helper functions (implement sesuai dengan struktur database Anda)
   */
  async function getTotalUsers() {
    try {
      // return await Database.getTotalUsers();
      return 'Loading...'; // Placeholder
    } catch (error) {
      console.error('Error getting total users:', error);
      return 'Error';
    }
  }

  async function getTotalConfessions() {
    try {
      // return await Database.getTotalConfessions();
      return 'Loading...'; // Placeholder
    } catch (error) {
      console.error('Error getting total confessions:', error);
      return 'Error';
    }
  }

  async function getTotalComments() {
    try {
      // return await Database.getTotalComments();
      return 'Loading...'; // Placeholder
    } catch (error) {
      console.error('Error getting total comments:', error);
      return 'Error';
    }
  }

  async function getActiveToday() {
    try {
      // return await Database.getActiveToday();
      return 'Loading...'; // Placeholder
    } catch (error) {
      console.error('Error getting active today:', error);
      return 'Error';
    }
  }

  async function getBannedUsers() {
    try {
      // return await Database.getBannedUsersCount();
      return 'Loading...'; // Placeholder
    } catch (error) {
      console.error('Error getting banned users:', error);
      return 'Error';
    }
  }

  async function getTotalReports() {
    try {
      // return await Database.getTotalReports();
      return 'Loading...'; // Placeholder
    } catch (error) {
      console.error('Error getting total reports:', error);
      return 'Error';
    }
  }

  async function getRecentReports(limit = 5) {
    try {
      // return await Database.getRecentReports(limit);
      return []; // Placeholder
    } catch (error) {
      console.error('Error getting recent reports:', error);
      return [];
    }
  }

  async function getReportStats() {
    try {
      // return await Database.getReportStats();
      return {
        total: 'Loading...',
        pending: 'Loading...',
        handled: 'Loading...',
        rejected: 'Loading...'
      }; // Placeholder
    } catch (error) {
      console.error('Error getting report stats:', error);
      return {
        total: 'Error',
        pending: 'Error',
        handled: 'Error',
        rejected: 'Error'
      };
    }
  }

  function getReportStatusEmoji(status) {
    const statusEmojis = {
      'pending': '⏰',
      'handled': '✅',
      'rejected': '❌',
      'investigating': '🔍'
    };
    return statusEmojis[status] || '❓';
  }

  // Export public methods
  return {
    showAdminMenu,
    adminMiddleware,
    isAdmin,
    // Utility methods yang mungkin dibutuhkan file lain
    getTotalUsers,
    getTotalConfessions,
    getTotalReports,
    getRecentReports
  };
}