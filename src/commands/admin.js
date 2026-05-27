import { Markup } from 'telegraf';
import { Database } from './database.js';

/**
 * Handler untuk Admin Panel
 * @param {Telegraf} bot
 */

export default function adminPanel(bot, targetChannelId) {
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
      const reportStats = await Database.getReportStats();
      const recentReports = await Database.getReportsPaginated('pending', 5, 0);

      let text = `📋 *Laporan User*\n\n`;
      text += `📊 *Ringkasan:*\n`;
      text += `• Total: *${reportStats.total}*  |  ⏰ Pending: *${reportStats.pending}*\n`;
      text += `• ✅ Ditangani: *${reportStats.handled}*  |  ❌ Ditolak: *${reportStats.rejected}*\n\n`;

      if (recentReports.length > 0) {
        text += `🆕 *Laporan Pending Terbaru:*\n`;
        recentReports.forEach((r, i) => {
          text += `${i + 1}. \`#${r.id}\` — ${r.reason} — ${new Date(r.created_at).toLocaleDateString('id-ID')}\n`;
        });
      } else {
        text += `✅ Tidak ada laporan pending.`;
      }

      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '⏰ Pending', callback_data: 'admin_reports_filter_pending_0' },
              { text: '✅ Ditangani', callback_data: 'admin_reports_filter_handled_0' },
              { text: '❌ Ditolak', callback_data: 'admin_reports_filter_rejected_0' }
            ],
            [{ text: '🏠 Kembali', callback_data: 'back_to_admin' }]
          ]
        }
      });
    } catch (error) {
      console.error('❌ Error getting reports:', error);
      await ctx.editMessageText('❌ Error memuat laporan.', {
        reply_markup: { inline_keyboard: [[{ text: '🏠 Kembali', callback_data: 'back_to_admin' }]] }
      });
    }
  });

  // Filter & pagination laporan
  bot.action(/^admin_reports_filter_(\w+)_(\d+)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const status = ctx.match[1]; // pending | handled | rejected
    const offset = parseInt(ctx.match[2]);
    const limit  = 5;

    const reports = await Database.getReportsPaginated(status, limit + 1, offset);
    const hasMore = reports.length > limit;
    const page    = reports.slice(0, limit);

    const statusLabel = { pending: '⏰ Pending', handled: '✅ Ditangani', rejected: '❌ Ditolak' }[status];

    let text = `📋 *Laporan — ${statusLabel}*\n\n`;
    if (page.length === 0) {
      text += `Tidak ada laporan dengan status ini.`;
    } else {
      page.forEach((r, i) => {
        text += `*${offset + i + 1}.* ID \`#${r.id}\`\n`;
        text += `   Alasan: ${r.reason}\n`;
        text += `   Tanggal: ${new Date(r.created_at).toLocaleDateString('id-ID')}\n`;
        text += `   [Lihat Detail →]\n\n`;
      });
    }

    // Tombol detail per laporan
    const detailButtons = page.map(r => ([{
      text: `🔍 Detail Laporan #${r.id}`,
      callback_data: `admin_report_detail_${r.id}_${status}_${offset}`
    }]));

    // Navigasi pagination
    const navButtons = [];
    if (offset > 0) navButtons.push({ text: '⬅️ Sebelumnya', callback_data: `admin_reports_filter_${status}_${offset - limit}` });
    if (hasMore)    navButtons.push({ text: '➡️ Selanjutnya', callback_data: `admin_reports_filter_${status}_${offset + limit}` });

    const keyboard = [
      ...detailButtons,
      ...(navButtons.length ? [navButtons] : []),
      [{ text: '🔙 Kembali', callback_data: 'admin_reports' }]
    ];

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    });
  });

  // Detail satu laporan
  bot.action(/^admin_report_detail_(\d+)_(\w+)_(\d+)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const reportId     = parseInt(ctx.match[1]);
    const backStatus   = ctx.match[2];
    const backOffset   = ctx.match[3];

    const report = await Database.getReportWithDetail(reportId);
    if (!report) return ctx.editMessageText('❌ Laporan tidak ditemukan.');

    const confessPreview = report.confession_text?.substring(0, 200) + (report.confession_text?.length > 200 ? '...' : '');

    const text =
      `🔍 *Detail Laporan #${report.id}*\n\n` +
      `📌 Status: *${report.status}*\n` +
      `⚠️ Alasan: *${report.reason}*\n` +
      `👤 Reporter ID: \`${report.reporter_id}\`\n` +
      `✍️ Confessor ID: \`${report.confessor_id}\`\n` +
      `📅 Tanggal: ${new Date(report.created_at).toLocaleString('id-ID')}\n\n` +
      `💬 *Isi Confession:*\n${confessPreview}`;

    const actionButtons = report.status === 'pending'
      ? [
          [
            { text: '✅ Tandai Ditangani', callback_data: `admin_report_status_${reportId}_handled_${backStatus}_${backOffset}` },
            { text: '❌ Tolak Laporan',    callback_data: `admin_report_status_${reportId}_rejected_${backStatus}_${backOffset}` }
          ],
          [{ text: '🗑️ Hapus Confession dari Channel', callback_data: `admin_report_delete_${reportId}_${backStatus}_${backOffset}` }]
        ]
      : [];

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          ...actionButtons,
          [{ text: '🔙 Kembali', callback_data: `admin_reports_filter_${backStatus}_${backOffset}` }]
        ]
      }
    });
  });

  // Update status laporan (handled / rejected)
  bot.action(/^admin_report_status_(\d+)_(handled|rejected)_(\w+)_(\d+)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery('⏳ Memperbarui...');
    const reportId   = parseInt(ctx.match[1]);
    const newStatus  = ctx.match[2];
    const backStatus = ctx.match[3];
    const backOffset = ctx.match[4];

    await Database.updateReportStatus(reportId, newStatus);

    const label = newStatus === 'handled' ? '✅ Ditandai sebagai Ditangani' : '❌ Laporan Ditolak';

    await ctx.editMessageText(
      `${label}\n\nLaporan \`#${reportId}\` berhasil diperbarui.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Kembali ke Daftar', callback_data: `admin_reports_filter_${backStatus}_${backOffset}` }]
          ]
        }
      }
    );
  });

  // Hapus confession dari channel
  bot.action(/^admin_report_delete_(\d+)_(\w+)_(\d+)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const reportId   = parseInt(ctx.match[1]);
    const backStatus = ctx.match[2];
    const backOffset = ctx.match[3];

    const report = await Database.getReportWithDetail(reportId);
    if (!report) return ctx.editMessageText('❌ Laporan tidak ditemukan.');

    await ctx.editMessageText(
      `🗑️ *Konfirmasi Hapus*\n\n` +
      `Apakah kamu yakin ingin menghapus confession ini dari channel?\n\n` +
      `ID Laporan: \`#${reportId}\`\n` +
      `Confessor: \`${report.confessor_id}\`\n\n` +
      `⚠️ _Tindakan ini tidak bisa dibatalkan._`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Ya, Hapus',  callback_data: `admin_report_delete_confirm_${reportId}_${backStatus}_${backOffset}` },
              { text: '❌ Batal',      callback_data: `admin_report_detail_${reportId}_${backStatus}_${backOffset}` }
            ]
          ]
        }
      }
    );
  });

  // Konfirmasi hapus confession
  bot.action(/^admin_report_delete_confirm_(\d+)_(\w+)_(\d+)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery('🗑️ Menghapus...');
    const reportId   = parseInt(ctx.match[1]);
    const backStatus = ctx.match[2];
    const backOffset = ctx.match[3];

    const report = await Database.getReportWithDetail(reportId);
    if (!report) return ctx.editMessageText('❌ Laporan tidak ditemukan.');

    let deleteSuccess = false;
    try {
      await ctx.telegram.deleteMessage(targetChannelId, report.channel_message_id);
      deleteSuccess = true;
    } catch (err) {
      console.error('❌ Gagal hapus pesan dari channel:', err.message);
    }

    // Tandai laporan sebagai handled
    await Database.updateReportStatus(reportId, 'handled');

    await ctx.editMessageText(
      deleteSuccess
        ? `✅ *Confession berhasil dihapus dari channel.*\n\nLaporan \`#${reportId}\` ditandai sebagai Ditangani.`
        : `⚠️ *Gagal menghapus pesan dari channel.*\n\nMungkin sudah dihapus sebelumnya. Laporan tetap ditandai Ditangani.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Kembali ke Daftar', callback_data: `admin_reports_filter_${backStatus}_${backOffset}` }]
          ]
        }
      }
    );
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
            [
              { text: '🏆 Pengaturan Rank', callback_data: 'admin_rank_settings' },
              { text: '🏠 Kembali', callback_data: 'back_to_admin' }
            ]
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

  // Menu utama rank settings
  bot.action('admin_rank_settings', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const rankEnabled = await Database.getConfig('rank_system_enabled', '0');
    const isEnabled = rankEnabled === '1';

    await ctx.editMessageText(
      `🏆 *Pengaturan Sistem Rank*\n\n` +
      `Status: ${isEnabled ? '✅ Aktif' : '❌ Nonaktif'}\n\n` +
      `${isEnabled ? 'Sistem rank sedang berjalan. User bisa upgrade rank.' : 'Sistem rank dimatikan. Semua user menggunakan limit rank Member.'}`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: isEnabled ? '🔴 Nonaktifkan Rank' : '🟢 Aktifkan Rank', callback_data: 'admin_rank_toggle' }],
            [{ text: '⚙️ Atur Limit per Rank', callback_data: 'admin_rank_limits' }],
            [{ text: '👑 Promote User', callback_data: 'admin_promote_user' }],
            [{ text: '🏠 Kembali', callback_data: 'admin_settings' }]
          ]
        }
      }
    );
  });

  // Toggle rank system on/off
  bot.action('admin_rank_toggle', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const current = await Database.getConfig('rank_system_enabled', '0');
    const newVal = current === '1' ? '0' : '1';
    await Database.setConfig('rank_system_enabled', newVal);

    await ctx.editMessageText(
      `✅ Sistem rank berhasil *${newVal === '1' ? 'diaktifkan' : 'dinonaktifkan'}*.\n\n` +
      `${newVal === '0' ? 'Semua user sementara menggunakan limit rank Member.' : 'User kini menggunakan limit sesuai rank masing-masing.'}`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Kembali ke Rank Settings', callback_data: 'admin_rank_settings' }]
          ]
        }
      }
    );
  });

  // Lihat & atur limit per rank
  bot.action('admin_rank_limits', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const ranks = await Database.getAllRankLimits();

    let text = `⚙️ *Limit per Rank*\n\n`;
    ranks.forEach(r => {
      const status = r.is_active ? '✅' : '❌';
      text += `${status} *${r.rank}* — confess: ${r.max_count}x | hitme: ${r.hitme_max_count}x | showme: ${r.showme_max_count}x\n`;
    });
    text += `\n_Pilih rank untuk mengubah limit:_`;

    const buttons = ranks.map(r => ([{
      text: `${r.is_active ? '✅' : '❌'} ${r.rank}`,
      callback_data: `admin_rank_edit_${r.rank}`
    }]));
    buttons.push([{ text: '🏠 Kembali', callback_data: 'admin_rank_settings' }]);

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons }
    });
  });

  // Edit rank tertentu
  bot.action(/^admin_rank_edit_(.+)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const rank = ctx.match[1];
    const ranks = await Database.getAllRankLimits();
    const rankData = ranks.find(r => r.rank === rank);
    if (!rankData) return ctx.reply('❌ Rank tidak ditemukan.');

    await ctx.editMessageText(
      `✏️ *Edit Rank: ${rank}*\n\n` +
      `Status: ${rankData.is_active ? '✅ Aktif' : '❌ Nonaktif'}\n\n` +
      `📊 *Limit saat ini:*\n` +
      `• Confess : *${rankData.max_count}x* per window\n` +
      `• Hit Me  : *${rankData.hitme_max_count}x* per window\n` +
      `• Show Me : *${rankData.showme_max_count}x* per window\n\n` +
      `Pilih aksi:`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: rankData.is_active ? '🔴 Nonaktifkan' : '🟢 Aktifkan', callback_data: `admin_rank_toggle_${rank}` }],
            [{ text: '✏️ Limit Confess',  callback_data: `admin_rank_setlimit_${rank}_confess`  }],
            [{ text: '✏️ Limit Hit Me',   callback_data: `admin_rank_setlimit_${rank}_hitme`    }],
            [{ text: '✏️ Limit Show Me',  callback_data: `admin_rank_setlimit_${rank}_showme`   }],
            [{ text: '🔙 Kembali', callback_data: 'admin_rank_limits' }]
          ]
        }
      }
    );
  });

  // Toggle aktif/nonaktif rank tertentu
  bot.action(/^admin_rank_toggle_(.+)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const rank = ctx.match[1];
    if (rank === 'member') return ctx.answerCbQuery('❌ Rank member tidak bisa dinonaktifkan.');

    const ranks = await Database.getAllRankLimits();
    const rankData = ranks.find(r => r.rank === rank);
    const newActive = rankData.is_active ? 0 : 1;

    // Toggle tidak mengubah limit, pakai confess sebagai anchor (isActive berlaku global per rank)
    await Database.updateRankLimit(rank, 'confess', rankData.max_count, newActive);

    await ctx.editMessageText(
      `✅ Rank *${rank}* berhasil *${newActive ? 'diaktifkan' : 'dinonaktifkan'}*.\n` +
      `${newActive ? 'Rank ini sekarang tampil di pilihan upgrade user.' : 'Rank ini tidak akan tampil di pilihan upgrade user.'}`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Kembali', callback_data: 'admin_rank_limits' }]
          ]
        }
      }
    );
  });

  // Set limit confession rank tertentu
  bot.action(/^admin_rank_setlimit_([^_]+)_(confess|hitme|showme)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const rank       = ctx.match[1];
    const actionType = ctx.match[2];

    const actionLabel = { confess: 'Confess', hitme: 'Hit Me', showme: 'Show Me' }[actionType];
    adminInputState.set(ctx.from.id, { action: 'set_rank_limit', rank, actionType });

    await ctx.editMessageText(
      `✏️ *Ubah Limit ${actionLabel} — Rank: ${rank}*\n\n` +
      `Kirimkan angka baru untuk maksimal *${actionLabel}* rank ini.\n` +
      `Contoh: \`5\` → user rank ${rank} bisa ${actionLabel} 5x per window\n\n` +
      `_Ketik /cancel untuk membatalkan_`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '❌ Batal', callback_data: `admin_rank_edit_${rank}` }]]
        }
      }
    );
  });

  // Promote user — dummy untuk sekarang
  bot.action('admin_promote_user', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `👑 *Promote User*\n\n` +
      `Kirimkan ID Telegram user yang ingin di-promote.\n\n` +
      `_Fitur ini akan terhubung ke sistem pembayaran di masa mendatang._\n\n` +
      `_Ketik /cancel untuk membatalkan_`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '❌ Batal', callback_data: 'admin_rank_settings' }]]
        }
      }
    );
    adminInputState.set(ctx.from.id, { action: 'promote_user_step1' });
  });

  bot.action(/^admin_do_promote_(\d+)_(.+)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const targetId = ctx.match[1];
    const newRank = ctx.match[2];
    adminInputState.delete(ctx.from.id);

    await db.query('UPDATE `users` SET `rank` = ? WHERE `telegram_id` = ?', [newRank, targetId]);

    await ctx.editMessageText(
      `✅ User \`${targetId}\` berhasil di-promote ke rank *${newRank}*.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'admin_rank_settings' }]]
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
      } else if (state.action === 'set_rank_limit') {
        const val = parseInt(text, 10);
        if (isNaN(val) || val < 1 || val > 100) {
          return ctx.reply('❌ Masukkan angka antara 1 sampai 100.');
        }
        const ranks    = await Database.getAllRankLimits();
        const rankData = ranks.find(r => r.rank === state.rank);
        const actionLabel = { confess: 'Confess', hitme: 'Hit Me', showme: 'Show Me' }[state.actionType];
        await Database.updateRankLimit(state.rank, state.actionType, val, rankData.is_active);
        adminInputState.delete(userId);
        await ctx.reply(
          `✅ *Limit ${actionLabel} rank ${state.rank} diperbarui: ${val}x per window*`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[{ text: '🔙 Kembali ke Rank', callback_data: `admin_rank_edit_${state.rank}` }]]
            }
          }
        );

      } else if (state.action === 'promote_user_step1') {
        const targetId = parseInt(text, 10);
        if (isNaN(targetId)) return ctx.reply('❌ ID tidak valid.');
        const user = await Database.getUserById(targetId);
        if (!user) return ctx.reply('❌ User tidak ditemukan.');
        adminInputState.set(userId, { action: 'promote_user_step2', targetId });
        const ranks = await Database.getAllRankLimits();
        const buttons = ranks
          .filter(r => r.rank !== 'member')
          .map(r => ([{ text: r.rank, callback_data: `admin_do_promote_${targetId}_${r.rank}` }]));
        buttons.push([{ text: '❌ Batal', callback_data: 'admin_rank_settings' }]);
        await ctx.reply(
          `👤 User ditemukan: \`${targetId}\` (rank saat ini: *${user.rank}*)\n\nPilih rank tujuan:`,
          { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }
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