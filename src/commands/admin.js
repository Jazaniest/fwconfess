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
  const adminInputState = new Map();

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

  // Handler untuk lihat & ubah rate limit
  bot.action('admin_set_ratelimit', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();

    try {
      const cfg = await Database.getConfigs([
        'confession_max_per_window',
        'confession_window_hours',
        'ratelimit_msg_hit',
        'ratelimit_msg_success'
      ]);

      const maxCount    = cfg['confession_max_per_window'] || '1';
      const windowHours = cfg['confession_window_hours']   || '8';

      await ctx.editMessageText(
        `⏰ *Pengaturan Rate Limit Menfess*\n\n` +
        `📊 *Konfigurasi Saat Ini:*\n` +
        `• Maksimal menfess: *${maxCount}x*\n` +
        `• Per jangka waktu: *${windowHours} jam*\n\n` +
        `_Artinya: 1 user bisa kirim ${maxCount} menfess setiap ${windowHours} jam._\n\n` +
        `Pilih yang ingin diubah:`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: `✏️ Ubah Maks (${maxCount}x)`,     callback_data: 'admin_rl_set_max'   },
                { text: `✏️ Ubah Jangka (${windowHours}j)`, callback_data: 'admin_rl_set_hours' }
              ],
              [
                { text: '📝 Ubah Pesan Rate Limit',  callback_data: 'admin_rl_set_msg_hit'     },
                { text: '📝 Ubah Pesan Sukses',      callback_data: 'admin_rl_set_msg_success' }
              ],
              [
                { text: '🔄 Reset ke Default', callback_data: 'admin_rl_reset' }
              ],
              [{ text: '🏠 Kembali', callback_data: 'admin_settings' }]
            ]
          }
        }
      );
    } catch (error) {
      console.error('❌ Error loading ratelimit config:', error);
      await ctx.editMessageText('❌ Gagal memuat konfigurasi.', {
        reply_markup: { inline_keyboard: [[{ text: '🏠 Kembali', callback_data: 'admin_settings' }]] }
      });
    }
  });

  // Ubah nilai maksimal menfess
  bot.action('admin_rl_set_max', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    adminInputState.set(ctx.from.id, { action: 'set_max' });

    await ctx.editMessageText(
      `✏️ *Ubah Maksimal Menfess*\n\n` +
      `Kirimkan angka baru untuk maksimal menfess per jangka waktu.\n\n` +
      `Contoh: \`3\` → user bisa kirim 3 menfess per window\n\n` +
      `_Ketik /cancel untuk membatalkan_`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Batal', callback_data: 'admin_rl_cancel' }]
          ]
        }
      }
    );
  });

  // Ubah jangka waktu window
  bot.action('admin_rl_set_hours', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    adminInputState.set(ctx.from.id, { action: 'set_hours' });

    await ctx.editMessageText(
      `✏️ *Ubah Jangka Waktu Window*\n\n` +
      `Kirimkan angka jam baru untuk jangka waktu rate limit.\n\n` +
      `Contoh: \`24\` → reset setiap 24 jam, \`1\` → reset setiap 1 jam\n\n` +
      `_Ketik /cancel untuk membatalkan_`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Batal', callback_data: 'admin_rl_cancel' }]
          ]
        }
      }
    );
  });

  // Ubah pesan rate limit hit
  bot.action('admin_rl_set_msg_hit', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    adminInputState.set(ctx.from.id, { action: 'set_msg_hit' });

    await ctx.editMessageText(
      `✏️ *Ubah Pesan Rate Limit*\n\n` +
      `Kirimkan teks pesan baru. Placeholder yang tersedia:\n` +
      `• \`{count}\` → maks kirim (misal: 3)\n` +
      `• \`{hours}\` → jangka waktu (misal: 8)\n` +
      `• \`{next_time}\` → waktu boleh kirim lagi\n\n` +
      `Contoh:\n` +
      `\`⏰ Kamu sudah kirim {count}x dalam {hours} jam. Coba lagi: {next_time}\`\n\n` +
      `_Ketik /cancel untuk membatalkan_`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Batal', callback_data: 'admin_rl_cancel' }]
          ]
        }
      }
    );
  });

  // Ubah pesan sukses
  bot.action('admin_rl_set_msg_success', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    adminInputState.set(ctx.from.id, { action: 'set_msg_success' });

    await ctx.editMessageText(
      `✏️ *Ubah Pesan Sukses Menfess*\n\n` +
      `Kirimkan teks pesan baru. Placeholder yang tersedia:\n` +
      `• \`{hours}\` → jangka waktu window\n\n` +
      `Contoh:\n` +
      `\`🎉 Menfess berhasil! Kamu bisa kirim lagi dalam {hours} jam.\`\n\n` +
      `_Ketik /cancel untuk membatalkan_`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Batal', callback_data: 'admin_rl_cancel' }]
          ]
        }
      }
    );
  });

  // Reset ke default
  bot.action('admin_rl_reset', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `🔄 *Reset Rate Limit ke Default?*\n\n` +
      `Ini akan mengatur ulang ke:\n` +
      `• Maksimal: *1x*\n` +
      `• Jangka waktu: *8 jam*\n` +
      `• Pesan notifikasi: kembali ke default\n\n` +
      `Yakin?`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Ya, Reset',  callback_data: 'admin_rl_reset_confirm' },
              { text: '❌ Batal',      callback_data: 'admin_set_ratelimit'    }
            ]
          ]
        }
      }
    );
  });

  bot.action('admin_rl_reset_confirm', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery('🔄 Mereset...');
    try {
      await Database.setConfig('confession_max_per_window', '1');
      await Database.setConfig('confession_window_hours',   '8');
      await Database.setConfig('ratelimit_msg_hit',
        '⏰ Kamu sudah menfess {count}x dalam {hours} jam terakhir.\n\nCoba lagi setelah: *{next_time}*'
      );
      await Database.setConfig('ratelimit_msg_success',
        '🎉 *Menfess berhasil dipublish!*\n\n• Menfess kamu sudah tayang di channel\n• User lain bisa klik "Hit Me" untuk chat denganmu\n• Kamu akan dapat notifikasi jika ada yang tertarik\n\n⏰ Kamu bisa menfess lagi dalam {hours} jam'
      );

      await ctx.editMessageText(
        '✅ *Rate limit berhasil direset ke default!*\n\n• Maksimal: 1x\n• Jangka waktu: 8 jam',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '🔙 Kembali ke Rate Limit', callback_data: 'admin_set_ratelimit' }]]
          }
        }
      );
    } catch (error) {
      console.error('❌ Error resetting ratelimit:', error);
      await ctx.reply('❌ Gagal reset. Silakan coba lagi.');
    }
  });

  // Batal input
  bot.action('admin_rl_cancel', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery('❌ Dibatalkan');
    adminInputState.delete(ctx.from.id);
    // Kembali ke halaman rate limit
    ctx.callbackQuery.data = 'admin_set_ratelimit';
    await bot.handleUpdate({ ...ctx.update, callback_query: { ...ctx.callbackQuery, data: 'admin_set_ratelimit' } });
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
      `💾 Memory Used: \`${Math.round(debugInfo.memory.heapUsed / 1024 / 1024)}MB\`\n` +
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
   * Database helper functions - mengambil data dari Database class
   */
  async function getTotalUsers() {
    try {
      return await Database.getTotalUsers();
    } catch (error) {
      console.error('Error getting total users:', error);
      return 0;
    }
  }

  async function getTotalConfessions() {
    try {
      return await Database.getTotalConfessions();
    } catch (error) {
      console.error('Error getting total confessions:', error);
      return 0;
    }
  }

  async function getTotalComments() {
    try {
      // Note: Method ini belum ada di Database class, tambahkan jika diperlukan
      return 0;
    } catch (error) {
      console.error('Error getting total comments:', error);
      return 0;
    }
  }

  async function getActiveToday() {
    try {
      return await Database.getActiveUsersToday();
    } catch (error) {
      console.error('Error getting active today:', error);
      return 0;
    }
  }

  async function getBannedUsers() {
    try {
      return await Database.getBannedUsersCount();
    } catch (error) {
      console.error('Error getting banned users:', error);
      return 0;
    }
  }

  async function getTotalReports() {
    try {
      return await Database.getTotalReports();
    } catch (error) {
      console.error('Error getting total reports:', error);
      return 0;
    }
  }

  async function getRecentReports(limit = 5) {
    try {
      return await Database.getRecentReports(limit);
    } catch (error) {
      console.error('Error getting recent reports:', error);
      return [];
    }
  }

  async function getReportStats() {
    try {
      return await Database.getReportStats();
    } catch (error) {
      console.error('Error getting report stats:', error);
      return {
        total: 0,
        pending: 0,
        handled: 0,
        rejected: 0
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

  // Tangkap input teks dari admin (untuk ubah config rate limit)
  bot.on('text', async (ctx, next) => {
    const userId = ctx.from.id;

    // Hanya proses jika admin dan sedang dalam state input
    if (!isAdmin(userId) || !adminInputState.has(userId)) {
      return next();
    }

    const text = ctx.message.text.trim();

    // Izinkan /cancel keluar dari state
    if (text === '/cancel') {
      adminInputState.delete(userId);
      return ctx.reply('❌ Dibatalkan.', {
        reply_markup: {
          inline_keyboard: [[{ text: '🔙 Kembali ke Rate Limit', callback_data: 'admin_set_ratelimit' }]]
        }
      });
    }

    const state = adminInputState.get(userId);

    try {
      if (state.action === 'set_max') {
        const val = parseInt(text, 10);
        if (isNaN(val) || val < 1 || val > 100) {
          return ctx.reply('❌ Masukkan angka antara 1 sampai 100.');
        }
        await Database.setConfig('confession_max_per_window', val.toString());
        adminInputState.delete(userId);
        await ctx.reply(
          `✅ *Maksimal menfess diperbarui: ${val}x per window*`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[{ text: '🔙 Kembali ke Rate Limit', callback_data: 'admin_set_ratelimit' }]]
            }
          }
        );

      } else if (state.action === 'set_hours') {
        const val = parseFloat(text);
        if (isNaN(val) || val < 0.1 || val > 720) {
          return ctx.reply('❌ Masukkan angka jam antara 0.1 sampai 720 (30 hari).');
        }
        await Database.setConfig('confession_window_hours', val.toString());
        adminInputState.delete(userId);
        await ctx.reply(
          `✅ *Jangka waktu diperbarui: ${val} jam*`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[{ text: '🔙 Kembali ke Rate Limit', callback_data: 'admin_set_ratelimit' }]]
            }
          }
        );

      } else if (state.action === 'set_msg_hit') {
        if (text.length < 10 || text.length > 500) {
          return ctx.reply('❌ Pesan harus antara 10 sampai 500 karakter.');
        }
        await Database.setConfig('ratelimit_msg_hit', text);
        adminInputState.delete(userId);
        await ctx.reply(
          `✅ *Pesan rate limit diperbarui!*\n\nPreview:\n${text}`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[{ text: '🔙 Kembali ke Rate Limit', callback_data: 'admin_set_ratelimit' }]]
            }
          }
        );

      } else if (state.action === 'set_msg_success') {
        if (text.length < 10 || text.length > 500) {
          return ctx.reply('❌ Pesan harus antara 10 sampai 500 karakter.');
        }
        await Database.setConfig('ratelimit_msg_success', text);
        adminInputState.delete(userId);
        await ctx.reply(
          `✅ *Pesan sukses diperbarui!*\n\nPreview:\n${text}`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[{ text: '🔙 Kembali ke Rate Limit', callback_data: 'admin_set_ratelimit' }]]
            }
          }
        );
      }

    } catch (error) {
      console.error('❌ Error saving config:', error);
      adminInputState.delete(userId);
      await ctx.reply('❌ Gagal menyimpan konfigurasi. Silakan coba lagi.');
    }
  });

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