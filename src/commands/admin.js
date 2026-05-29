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
              { text: '📋 Daftar User', callback_data: 'admin_list_users_0' },
              { text: '🔍 Cari User',   callback_data: 'admin_search_user'  }
            ],
            [
              { text: '📊 User Stats',  callback_data: 'admin_user_stats'   },
              { text: '🚫 User Banned', callback_data: 'admin_banned_users_0' }
            ],
            [
              { text: '🆕 User Baru',   callback_data: 'admin_new_users'    }
            ],
            [{ text: '🏠 Kembali', callback_data: 'back_to_admin' }]
          ]
        }
      }
    );
  });

  // ─── Daftar User (pagination) ─────────────────────────────────────────────────
  bot.action(/^admin_list_users_(\d+)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const offset = parseInt(ctx.match[1]);
    const limit  = 10;

    const [users, total] = await Promise.all([
      Database.getUsersPaginated(limit + 1, offset),
      Database.countAllUsers()
    ]);

    const hasMore = users.length > limit;
    const page    = users.slice(0, limit);
    const pageNum = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    let text = `📋 *Daftar User* (hal. ${pageNum}/${totalPages}, total: ${total})\n\n`;
    page.forEach((u, i) => {
      const uname  = u.username ? `@${u.username}` : '_no username_';
      const status = u.is_active ? '✅' : '🚫';
      text += `${status} \`${u.telegram_id}\` ${uname}\n`;
      text += `   Rank: *${u.rank}* | Gender: ${u.gender || '-'} | Menfess: ${u.total_confessions}\n`;
      text += `   Daftar: ${new Date(u.registered_at).toLocaleDateString('id-ID')}\n\n`;
    });

    const navButtons = [];
    if (offset > 0)  navButtons.push({ text: '⬅️ Sebelumnya', callback_data: `admin_list_users_${offset - limit}` });
    if (hasMore)     navButtons.push({ text: '➡️ Selanjutnya', callback_data: `admin_list_users_${offset + limit}` });

    const detailButtons = page.map(u => ([{
      text: `👤 ${u.telegram_id}${u.username ? ' @' + u.username : ''}`,
      callback_data: `admin_user_detail_${u.telegram_id}_list_${offset}`
    }]));

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          ...detailButtons,
          ...(navButtons.length ? [navButtons] : []),
          [{ text: '🔙 Kembali', callback_data: 'admin_users' }]
        ]
      }
    });
  });

  // ─── Detail satu user ─────────────────────────────────────────────────────────
  bot.action(/^admin_user_detail_(\d+)_(\w+)_(\d+)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const targetId   = parseInt(ctx.match[1]);
    const backSource = ctx.match[2]; // 'list' | 'banned' | 'search'
    const backOffset = ctx.match[3];

    const user = await Database.getUserFullProfile(targetId);
    if (!user) return ctx.editMessageText('❌ User tidak ditemukan.');

    const totalConf = await Database.getTotalUserConfessions(targetId);
    const uname     = user.username ? `@${user.username}` : '_tidak ada_';
    const status    = user.is_active ? '✅ Aktif' : '🚫 Banned';

    const text =
      `👤 *Detail User*\n\n` +
      `🆔 Telegram ID: \`${user.telegram_id}\`\n` +
      `👤 Username: ${uname}\n` +
      `📊 Rank: *${user.rank}*\n` +
      `⚧ Gender: ${user.gender || '-'}\n` +
      `📍 Asal: ${user.origin || '-'}\n` +
      `📅 Daftar: ${new Date(user.registered_at).toLocaleString('id-ID')}\n` +
      `📝 Total Menfess: *${totalConf}*\n` +
      `Status: ${status}`;

    const backCb = backSource === 'banned'
      ? `admin_banned_users_${backOffset}`
      : backSource === 'search'
      ? `admin_search_results_${backOffset}`
      : `admin_list_users_${backOffset}`;

    const banButton = user.is_active
      ? { text: '🚫 Ban User',   callback_data: `admin_ban_confirm_${targetId}_${backSource}_${backOffset}` }
      : { text: '✅ Unban User', callback_data: `admin_unban_confirm_${targetId}_${backSource}_${backOffset}` };

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [banButton],
          [{ text: '🔙 Kembali', callback_data: backCb }]
        ]
      }
    });
  });

  // ─── Konfirmasi Ban ───────────────────────────────────────────────────────────
  bot.action(/^admin_ban_confirm_(\d+)_(\w+)_(\d+)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const targetId   = ctx.match[1];
    const backSource = ctx.match[2];
    const backOffset = ctx.match[3];

    await ctx.editMessageText(
      `🚫 *Konfirmasi Ban*\n\nYakin ingin mem-ban user \`${targetId}\`?\n\n_User tidak akan bisa menggunakan bot._`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Ya, Ban',  callback_data: `admin_do_ban_${targetId}_${backSource}_${backOffset}` },
              { text: '❌ Batal',    callback_data: `admin_user_detail_${targetId}_${backSource}_${backOffset}` }
            ]
          ]
        }
      }
    );
  });

  bot.action(/^admin_do_ban_(\d+)_(\w+)_(\d+)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery('🚫 Memban...');
    const targetId   = parseInt(ctx.match[1]);
    const backSource = ctx.match[2];
    const backOffset = ctx.match[3];

    await Database.banUser(targetId);

    await ctx.editMessageText(
      `✅ User \`${targetId}\` berhasil di-ban.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Kembali ke Detail', callback_data: `admin_user_detail_${targetId}_${backSource}_${backOffset}` }]
          ]
        }
      }
    );
  });

  // ─── Konfirmasi Unban ─────────────────────────────────────────────────────────
  bot.action(/^admin_unban_confirm_(\d+)_(\w+)_(\d+)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const targetId   = ctx.match[1];
    const backSource = ctx.match[2];
    const backOffset = ctx.match[3];

    await ctx.editMessageText(
      `✅ *Konfirmasi Unban*\n\nYakin ingin meng-unban user \`${targetId}\`?`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Ya, Unban', callback_data: `admin_do_unban_${targetId}_${backSource}_${backOffset}` },
              { text: '❌ Batal',     callback_data: `admin_user_detail_${targetId}_${backSource}_${backOffset}` }
            ]
          ]
        }
      }
    );
  });

  bot.action(/^admin_do_unban_(\d+)_(\w+)_(\d+)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery('✅ Unban...');
    const targetId   = parseInt(ctx.match[1]);
    const backSource = ctx.match[2];
    const backOffset = ctx.match[3];

    await Database.unbanUser(targetId);

    await ctx.editMessageText(
      `✅ User \`${targetId}\` berhasil di-unban.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Kembali ke Detail', callback_data: `admin_user_detail_${targetId}_${backSource}_${backOffset}` }]
          ]
        }
      }
    );
  });

  // ─── Cari User ────────────────────────────────────────────────────────────────
  bot.action('admin_search_user', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    adminInputState.set(ctx.from.id, { action: 'search_user' });

    await ctx.editMessageText(
      `🔍 *Cari User*\n\nKirimkan Telegram ID (angka) atau username (tanpa @).\n\n_Ketik /cancel untuk membatalkan_`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Batal', callback_data: 'admin_users' }]
          ]
        }
      }
    );
  });

  // Hasil pencarian (pagination)
  bot.action(/^admin_search_results_(\d+)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const offset = parseInt(ctx.match[1]);
    const state  = adminInputState.get(ctx.from.id);
    if (!state?.searchQuery) return ctx.editMessageText('❌ Sesi pencarian habis. Silakan cari ulang.');

    await showSearchResults(ctx, state.searchQuery, offset);
  });

  async function showSearchResults(ctx, query, offset = 0) {
    const limit = 10;
    const [results, total] = await Promise.all([
      Database.searchUsers(query, limit + 1, offset),
      Database.countSearchUsers(query)
    ]);

    const hasMore = results.length > limit;
    const page    = results.slice(0, limit);

    // Siapkan reply_markup untuk kondisi kosong
    const emptyMarkup = {
      inline_keyboard: [
        [{ text: '🔍 Cari Lagi', callback_data: 'admin_search_user' }],
        [{ text: '🔙 Kembali',   callback_data: 'admin_users'        }]
      ]
    };

    if (page.length === 0) {
      const emptyText = `🔍 *Hasil Pencarian: "${query}"*\n\nTidak ada user ditemukan.`;
      
      // PERBAIKAN: Cek apakah request datang dari klik tombol atau teks biasa
      if (ctx.callbackQuery) {
        return ctx.editMessageText(emptyText, { parse_mode: 'Markdown', reply_markup: emptyMarkup });
      } else {
        return ctx.reply(emptyText, { parse_mode: 'Markdown', reply_markup: emptyMarkup });
      }
    }

    let text = `🔍 *Hasil: "${query}"* (${total} user)\n\n`;
    page.forEach((u) => {
      const uname  = u.username ? `@${u.username}` : '_no username_';
      const status = u.is_active ? '✅' : '🚫';
      text += `${status} \`${u.telegram_id}\` ${uname} — *${u.rank}*\n`;
    });

    const detailButtons = page.map(u => ([{
      text: `👤 ${u.telegram_id}${u.username ? ' @' + u.username : ''}`,
      callback_data: `admin_user_detail_${u.telegram_id}_search_${offset}`
    }]));

    const navButtons = [];
    if (offset > 0) navButtons.push({ text: '⬅️ Sebelumnya', callback_data: `admin_search_results_${offset - limit}` });
    if (hasMore)    navButtons.push({ text: '➡️ Selanjutnya', callback_data: `admin_search_results_${offset + limit}` });

    const finalMarkup = {
      inline_keyboard: [
        ...detailButtons,
        ...(navButtons.length ? [navButtons] : []),
        [{ text: '🔍 Cari Lagi', callback_data: 'admin_search_user' }],
        [{ text: '🔙 Kembali',   callback_data: 'admin_users'        }]
      ]
    };

    // PERBAIKAN: Cek apakah request datang dari klik tombol atau teks biasa
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: finalMarkup });
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: finalMarkup });
    }
  }

  // ─── User Banned (pagination) ─────────────────────────────────────────────────
  bot.action(/^admin_banned_users_(\d+)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const offset = parseInt(ctx.match[1]);
    const limit  = 10;

    const [users, totalBanned] = await Promise.all([
      Database.getBannedUsersPaginated(limit + 1, offset),
      Database.getBannedUsersCount()
    ]);

    const hasMore = users.length > limit;
    const page    = users.slice(0, limit);

    let text = `🚫 *User Banned* (total: ${totalBanned})\n\n`;
    if (page.length === 0) {
      text += 'Tidak ada user yang di-ban.';
    } else {
      page.forEach(u => {
        const uname = u.username ? `@${u.username}` : '_no username_';
        text += `\`${u.telegram_id}\` ${uname} — *${u.rank}*\n`;
      });
    }

    const detailButtons = page.map(u => ([{
      text: `👤 ${u.telegram_id}${u.username ? ' @' + u.username : ''}`,
      callback_data: `admin_user_detail_${u.telegram_id}_banned_${offset}`
    }]));

    const navButtons = [];
    if (offset > 0) navButtons.push({ text: '⬅️ Sebelumnya', callback_data: `admin_banned_users_${offset - limit}` });
    if (hasMore)    navButtons.push({ text: '➡️ Selanjutnya', callback_data: `admin_banned_users_${offset + limit}` });

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          ...detailButtons,
          ...(navButtons.length ? [navButtons] : []),
          [{ text: '🔙 Kembali', callback_data: 'admin_users' }]
        ]
      }
    });
  });

  // ─── User Baru ────────────────────────────────────────────────────────────────
  bot.action('admin_new_users', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const stats = await Database.countNewUsers();

    const text =
      `🆕 *Registrasi User Baru*\n\n` +
      `📅 24 jam terakhir : *${stats.day1}* user\n` +
      `📅 7 hari terakhir : *${stats.day7}* user\n` +
      `📅 30 hari terakhir: *${stats.day30}* user`;

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔄 Refresh', callback_data: 'admin_new_users' },
            { text: '🔙 Kembali', callback_data: 'admin_users'    }
          ]
        ]
      }
    });
  });

  // ─── User Stats ───────────────────────────────────────────────────────────────
  bot.action('admin_user_stats', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery('📊 Memuat stats...');

    const [topConfess, topHitme, topShowme] = await Promise.all([
      Database.getTopUsersByAction('confess', 5),
      Database.getTopUsersByAction('hitme',   5),
      Database.getTopUsersByAction('showme',  5)
    ]);

    function formatTop(arr) {
      if (!arr.length) return '_Belum ada data_\n';
      return arr.map((u, i) => {
        const uname = u.username ? `@${u.username}` : `\`${u.telegram_id}\``;
        return `${i + 1}. ${uname} — *${u.total}x*`;
      }).join('\n') + '\n';
    }

    const text =
      `📊 *User Stats*\n\n` +
      `📝 *Top Menfess:*\n${formatTop(topConfess)}\n` +
      `💘 *Top Hit Me:*\n${formatTop(topHitme)}\n` +
      `👁️ *Top Show Me:*\n${formatTop(topShowme)}\n` +
      `💬 *Top Komentar:*\n_Sistem komentar belum tersedia_\n`;

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔄 Refresh', callback_data: 'admin_user_stats' },
            { text: '🔙 Kembali', callback_data: 'admin_users'      }
          ]
        ]
      }
    });
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
              { text: '🚫 Ban User',       callback_data: 'admin_ban_user'      },
              { text: '✅ Unban User',      callback_data: 'admin_unban_user'    }
            ],
            [
              { text: '📋 Daftar Banned',  callback_data: 'admin_banned_users_0' },
              { text: '⏰ Temporary Ban',   callback_data: 'admin_tempban_user'  }
            ],
            [
              { text: '🔍 Cek Status Ban', callback_data: 'admin_check_ban'     }
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

  // ─── Ban User (dari menu admin_ban) ──────────────────────────────────────────

  bot.action('admin_ban_user', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    adminInputState.set(ctx.from.id, { action: 'ban_user_id', banType: 'permanent' });

    await ctx.editMessageText(
      `🚫 *Ban User (Permanent)*\n\n` +
      `Kirimkan Telegram ID user yang ingin di-ban.\n\n` +
      `_Ketik /cancel untuk membatalkan_`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Batal', callback_data: 'admin_ban' }]
          ]
        }
      }
    );
  });

  bot.action('admin_tempban_user', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    adminInputState.set(ctx.from.id, { action: 'ban_user_id', banType: 'temporary' });

    await ctx.editMessageText(
      `⏰ *Temporary Ban User*\n\n` +
      `Kirimkan Telegram ID user yang ingin di-ban sementara.\n\n` +
      `_Ketik /cancel untuk membatalkan_`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Batal', callback_data: 'admin_ban' }]
          ]
        }
      }
    );
  });

  bot.action('admin_unban_user', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    adminInputState.set(ctx.from.id, { action: 'unban_user_id' });

    await ctx.editMessageText(
      `✅ *Unban User*\n\n` +
      `Kirimkan Telegram ID user yang ingin di-unban.\n\n` +
      `_Ketik /cancel untuk membatalkan_`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Batal', callback_data: 'admin_ban' }]
          ]
        }
      }
    );
  });

  // Pilih durasi temporary ban
  bot.action(/^admin_tempban_duration_(\d+)_(.+)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const targetId = ctx.match[1];
    const hours    = parseInt(ctx.match[2]);

    adminInputState.set(ctx.from.id, {
      action:   'ban_reason',
      banType:  'temporary',
      targetId: parseInt(targetId),
      hours
    });

    const durationLabel = hours < 24
      ? `${hours} jam`
      : hours < 168
      ? `${hours / 24} hari`
      : `${hours / 168} minggu`;

    await ctx.editMessageText(
      `⏰ *Temporary Ban — ${durationLabel}*\n\n` +
      `Target: \`${targetId}\`\n\n` +
      `Kirimkan alasan ban, atau ketik \`-\` untuk skip.\n\n` +
      `_Ketik /cancel untuk membatalkan_`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '⏭️ Skip Alasan', callback_data: `admin_ban_skip_reason_${targetId}_temporary_${hours}` }],
            [{ text: '❌ Batal', callback_data: 'admin_ban' }]
          ]
        }
      }
    );
  });

  // Input durasi custom temporary ban
  bot.action(/^admin_tempban_custom_(\d+)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const targetId = ctx.match[1];
    adminInputState.set(ctx.from.id, { action: 'ban_duration_custom', banType: 'temporary', targetId: parseInt(targetId) });

    await ctx.editMessageText(
      `⏰ *Input Durasi Custom*\n\n` +
      `Target: \`${targetId}\`\n\n` +
      `Kirimkan durasi dalam jam. Contoh:\n` +
      `• \`2\` → 2 jam\n` +
      `• \`48\` → 2 hari\n` +
      `• \`168\` → 7 hari\n\n` +
      `_Ketik /cancel untuk membatalkan_`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Batal', callback_data: 'admin_ban' }]
          ]
        }
      }
    );
  });

  // Skip alasan ban → langsung ke konfirmasi
  bot.action(/^admin_ban_skip_reason_(\d+)_(permanent|temporary)_?(\d*)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const targetId = parseInt(ctx.match[1]);
    const banType  = ctx.match[2];
    const hours    = ctx.match[3] ? parseInt(ctx.match[3]) : null;

    await showBanConfirmation(ctx, targetId, banType, null, hours);
  });

  // Konfirmasi eksekusi ban
  bot.action(/^admin_ban_exec_(\d+)_(permanent|temporary)_?(\d*)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery('🚫 Memban...');
    const targetId = parseInt(ctx.match[1]);
    const banType  = ctx.match[2];
    const hours    = ctx.match[3] ? parseInt(ctx.match[3]) : null;
    const adminId  = ctx.from.id;

    const state   = adminInputState.get(adminId);
    const reason  = state?.pendingReason || null;
    adminInputState.delete(adminId);

    const expiresAt = (banType === 'temporary' && hours)
      ? new Date(Date.now() + hours * 60 * 60 * 1000)
      : null;

    await Database.createBan(targetId, banType, reason, expiresAt, adminId);

    // Restrict di discussion group
    const groupId = process.env.DISCUSSION_GROUP_ID;
    let restrictSuccess = false;
    if (groupId) {
      try {
        await ctx.telegram.restrictChatMember(groupId, targetId, {
          permissions: {
            can_send_messages         : false,
            can_send_audios           : false,
            can_send_documents        : false,
            can_send_photos           : false,
            can_send_videos           : false,
            can_send_video_notes      : false,
            can_send_voice_notes      : false,
            can_send_polls            : false,
            can_send_other_messages   : false,
            can_add_web_page_previews : false,
            can_change_info           : false,
            can_invite_users          : false,
            can_pin_messages          : false,
          },
          // Untuk temporary ban, set until_date agar Telegram auto-unrestrict
          ...(expiresAt ? { until_date: Math.floor(expiresAt.getTime() / 1000) } : {})
        });
        restrictSuccess = true;
      } catch (err) {
        console.error('⚠️ Gagal restrict di grup:', err.message);
      }
    }

    const durationText = banType === 'permanent'
      ? 'Permanent'
      : `${hours} jam (sampai ${expiresAt.toLocaleString('id-ID')})`;

    const groupStatus = !groupId
      ? '_DISCUSSION_GROUP_ID tidak di-set_'
      : restrictSuccess
      ? '✅ Berhasil di-restrict di grup'
      : '⚠️ Gagal restrict di grup (user mungkin belum pernah join)';

    await ctx.editMessageText(
      `✅ *User berhasil di-ban!*\n\n` +
      `🆔 Target: \`${targetId}\`\n` +
      `⛔ Tipe: *${banType}*\n` +
      `⏱️ Durasi: ${durationText}\n` +
      `📝 Alasan: ${reason || '-'}\n` +
      `💬 Grup: ${groupStatus}`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Kembali ke Ban Menu', callback_data: 'admin_ban' }]
          ]
        }
      }
    );
  });

  // Konfirmasi eksekusi unban
  bot.action(/^admin_unban_exec_(\d+)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery('✅ Unban...');
    const targetId = parseInt(ctx.match[1]);
    const adminId  = ctx.from.id;

    await Database.removeBan(targetId, adminId);

    // Restore permission di discussion group
    const groupId = process.env.DISCUSSION_GROUP_ID;
    let unrestrictSuccess = false;
    if (groupId) {
      try {
        await ctx.telegram.restrictChatMember(groupId, targetId, {
          permissions: {
            can_send_messages         : true,
            can_send_audios           : true,
            can_send_documents        : true,
            can_send_photos           : true,
            can_send_videos           : true,
            can_send_video_notes      : true,
            can_send_voice_notes      : true,
            can_send_polls            : true,
            can_send_other_messages   : true,
            can_add_web_page_previews : true,
            can_change_info           : false,
            can_invite_users          : true,
            can_pin_messages          : false,
          }
        });
        unrestrictSuccess = true;
      } catch (err) {
        console.error('⚠️ Gagal unrestrict di grup:', err.message);
      }
    }

    const groupStatus = !groupId
      ? '_DISCUSSION_GROUP_ID tidak di-set_'
      : unrestrictSuccess
      ? '✅ Permission grup dipulihkan'
      : '⚠️ Gagal unrestrict di grup (user mungkin belum pernah join)';

    await ctx.editMessageText(
      `✅ *User berhasil di-unban!*\n\n` +
      `🆔 Target: \`${targetId}\`\n` +
      `💬 Grup: ${groupStatus}`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Kembali ke Ban Menu', callback_data: 'admin_ban' }]
          ]
        }
      }
    );
  });

  // Cek status ban user
  bot.action('admin_check_ban', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    adminInputState.set(ctx.from.id, { action: 'check_ban_id' });

    await ctx.editMessageText(
      `🔍 *Cek Status Ban*\n\n` +
      `Kirimkan Telegram ID user yang ingin dicek.\n\n` +
      `_Ketik /cancel untuk membatalkan_`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Batal', callback_data: 'admin_ban' }]
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
      } else if (state.action === 'search_user') {
        if (text.length < 1 || text.length > 50) {
          return ctx.reply('❌ Query terlalu panjang atau kosong.');
        }
        // Simpan query ke state untuk dipakai saat pagination
        adminInputState.set(userId, { action: 'search_user_result', searchQuery: text });
        await showSearchResults(ctx, text, 0); 

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
      } else if (state.action === 'ban_user_id') {
        const targetId = parseInt(text, 10);
        if (isNaN(targetId)) return ctx.reply('❌ ID tidak valid. Masukkan angka.');

        const user = await Database.getUserById(targetId);
        if (!user) return ctx.reply('❌ User tidak ditemukan di database.');

        const activeBan = await Database.getActiveBan(targetId);
        const banStatus = activeBan
          ? `🚫 Sedang di-ban (${activeBan.ban_type})`
          : '✅ Tidak di-ban';

        const banType = state.banType;
        adminInputState.delete(userId);

        if (banType === 'temporary') {
          // Simpan dulu target, lanjut ke menu durasi
          adminInputState.set(userId, { action: 'ban_duration_select', banType: 'temporary', targetId });
          await ctx.reply(
            `👤 *Info User*\n\n` +
            `🆔 ID: \`${targetId}\`\n` +
            `📊 Rank: *${user.rank}*\n` +
            `🔰 Status Ban: ${banStatus}\n\n` +
            `Lanjut pilih durasi:`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '1 Jam',   callback_data: `admin_tempban_duration_${targetId}_1`   },
                    { text: '6 Jam',   callback_data: `admin_tempban_duration_${targetId}_6`   },
                    { text: '12 Jam',  callback_data: `admin_tempban_duration_${targetId}_12`  }
                  ],
                  [
                    { text: '1 Hari',  callback_data: `admin_tempban_duration_${targetId}_24`  },
                    { text: '3 Hari',  callback_data: `admin_tempban_duration_${targetId}_72`  },
                    { text: '7 Hari',  callback_data: `admin_tempban_duration_${targetId}_168` }
                  ],
                  [
                    { text: '30 Hari', callback_data: `admin_tempban_duration_${targetId}_720` },
                    { text: '✏️ Custom', callback_data: `admin_tempban_custom_${targetId}`     }
                  ],
                  [{ text: '❌ Batal', callback_data: 'admin_ban' }]
                ]
              }
            }
          );
        } else {
          // Permanent ban — lanjut ke input alasan
          adminInputState.set(userId, { action: 'ban_reason', banType: 'permanent', targetId });
          await ctx.reply(
            `👤 *Info User*\n\n` +
            `🆔 ID: \`${targetId}\`\n` +
            `📊 Rank: *${user.rank}*\n` +
            `🔰 Status Ban: ${banStatus}\n\n` +
            `Kirimkan alasan ban, atau ketik \`-\` untuk skip.\n\n` +
            `_Ketik /cancel untuk membatalkan_`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '⏭️ Skip Alasan', callback_data: `admin_ban_skip_reason_${targetId}_permanent` }],
                  [{ text: '❌ Batal', callback_data: 'admin_ban' }]
                ]
              }
            }
          );
        }

      } else if (state.action === 'ban_duration_custom') {
        const hours = parseFloat(text);
        if (isNaN(hours) || hours < 0.5 || hours > 8760) {
          return ctx.reply('❌ Masukkan angka jam antara 0.5 sampai 8760 (1 tahun).');
        }
        const targetId = state.targetId;
        adminInputState.set(userId, { action: 'ban_reason', banType: 'temporary', targetId, hours });

        await ctx.reply(
          `⏰ Durasi: *${hours} jam*\n\n` +
          `Kirimkan alasan ban, atau ketik \`-\` untuk skip.\n\n` +
          `_Ketik /cancel untuk membatalkan_`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '⏭️ Skip Alasan', callback_data: `admin_ban_skip_reason_${targetId}_temporary_${hours}` }],
                [{ text: '❌ Batal', callback_data: 'admin_ban' }]
              ]
            }
          }
        );

      } else if (state.action === 'ban_reason') {
        const reason  = text === '-' ? null : text;
        const { banType, targetId, hours } = state;

        // Simpan reason ke state sementara untuk diambil saat exec
        adminInputState.set(userId, { ...state, action: 'ban_pending', pendingReason: reason });

        await showBanConfirmation(ctx, targetId, banType, reason, hours || null);

      } else if (state.action === 'unban_user_id') {
        const targetId = parseInt(text, 10);
        if (isNaN(targetId)) return ctx.reply('❌ ID tidak valid. Masukkan angka.');

        const user = await Database.getUserById(targetId);
        if (!user) return ctx.reply('❌ User tidak ditemukan di database.');

        const activeBan = await Database.getActiveBan(targetId);
        adminInputState.delete(userId);

        if (!activeBan) {
          return ctx.reply(
            `ℹ️ User \`${targetId}\` tidak sedang dalam status ban.`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🔙 Kembali ke Ban Menu', callback_data: 'admin_ban' }]
                ]
              }
            }
          );
        }

        const expiredText = activeBan.expires_at
          ? `Sampai: ${new Date(activeBan.expires_at).toLocaleString('id-ID')}`
          : 'Permanent';

        await ctx.reply(
          `🔍 *Status Ban User*\n\n` +
          `🆔 ID: \`${targetId}\`\n` +
          `⛔ Tipe: *${activeBan.ban_type}*\n` +
          `⏱️ ${expiredText}\n` +
          `📝 Alasan: ${activeBan.reason || '-'}\n` +
          `📅 Di-ban: ${new Date(activeBan.banned_at).toLocaleString('id-ID')}\n\n` +
          `Lanjutkan unban?`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ Ya, Unban', callback_data: `admin_unban_exec_${targetId}` },
                  { text: '❌ Batal',     callback_data: 'admin_ban'                    }
                ]
              ]
            }
          }
        );

      } else if (state.action === 'check_ban_id') {
        const targetId = parseInt(text, 10);
        if (isNaN(targetId)) return ctx.reply('❌ ID tidak valid. Masukkan angka.');

        const activeBan  = await Database.getActiveBan(targetId);
        const banHistory = await Database.getBanHistory(targetId, 3);
        adminInputState.delete(userId);

        let statusText;
        if (!activeBan) {
          statusText = `✅ *Tidak di-ban*`;
        } else {
          const expText = activeBan.expires_at
            ? `Sampai: ${new Date(activeBan.expires_at).toLocaleString('id-ID')}`
            : 'Permanent';
          statusText =
            `🚫 *Sedang di-ban*\n` +
            `⛔ Tipe: ${activeBan.ban_type}\n` +
            `⏱️ ${expText}\n` +
            `📝 Alasan: ${activeBan.reason || '-'}\n` +
            `📅 Sejak: ${new Date(activeBan.banned_at).toLocaleString('id-ID')}`;
        }

        let historyText = '';
        if (banHistory.length > 0) {
          historyText = `\n\n📋 *Riwayat Ban (${banHistory.length} terakhir):*\n`;
          banHistory.forEach((b, i) => {
            const tipe = b.ban_type === 'permanent' ? '♾️' : '⏰';
            historyText += `${i + 1}. ${tipe} ${b.ban_type} — ${new Date(b.banned_at).toLocaleDateString('id-ID')} — ${b.is_active ? 'aktif' : 'selesai'}\n`;
          });
        }

        const buttons = [];
        if (activeBan) {
          buttons.push([{ text: '✅ Unban Sekarang', callback_data: `admin_unban_exec_${targetId}` }]);
        }
        buttons.push([{ text: '🔙 Kembali ke Ban Menu', callback_data: 'admin_ban' }]);

        await ctx.reply(
          `🔍 *Status Ban — \`${targetId}\`*\n\n${statusText}${historyText}`,
          {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: buttons }
          }
        );
      }

    } catch (error) {
      console.error('❌ Error saving config:', error);
      adminInputState.delete(userId);
      await ctx.reply('❌ Gagal menyimpan konfigurasi. Silakan coba lagi.');
    }
  });

  // ─── Helper: tampilkan menu durasi temporary ban ──────────────────────────────
  async function showTempBanDurationMenu(ctx, targetId) {
    await ctx.editMessageText(
      `⏰ *Pilih Durasi Temporary Ban*\n\nTarget: \`${targetId}\``,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '1 Jam',   callback_data: `admin_tempban_duration_${targetId}_1`   },
              { text: '6 Jam',   callback_data: `admin_tempban_duration_${targetId}_6`   },
              { text: '12 Jam',  callback_data: `admin_tempban_duration_${targetId}_12`  }
            ],
            [
              { text: '1 Hari',  callback_data: `admin_tempban_duration_${targetId}_24`  },
              { text: '3 Hari',  callback_data: `admin_tempban_duration_${targetId}_72`  },
              { text: '7 Hari',  callback_data: `admin_tempban_duration_${targetId}_168` }
            ],
            [
              { text: '30 Hari', callback_data: `admin_tempban_duration_${targetId}_720` },
              { text: '✏️ Custom', callback_data: `admin_tempban_custom_${targetId}`     }
            ],
            [{ text: '❌ Batal', callback_data: 'admin_ban' }]
          ]
        }
      }
    );
  }

  // ─── Helper: tampilkan konfirmasi ban ────────────────────────────────────────
  async function showBanConfirmation(ctx, targetId, banType, reason, hours = null) {
    const durationText = banType === 'permanent'
      ? '♾️ Permanent'
      : (() => {
          const exp = new Date(Date.now() + hours * 60 * 60 * 1000);
          const label = hours < 24
            ? `${hours} jam`
            : hours < 168
            ? `${hours / 24} hari`
            : `${hours / 168} minggu`;
          return `⏰ ${label} (sampai ${exp.toLocaleString('id-ID')})`;
        })();

    const execCb = banType === 'permanent'
      ? `admin_ban_exec_${targetId}_permanent`
      : `admin_ban_exec_${targetId}_temporary_${hours}`;

    const text =
      `⚠️ *Konfirmasi Ban*\n\n` +
      `🆔 Target: \`${targetId}\`\n` +
      `⛔ Tipe: *${banType}*\n` +
      `⏱️ Durasi: ${durationText}\n` +
      `📝 Alasan: ${reason || '-'}\n\n` +
      `_Tindakan ini akan langsung berlaku._`;

    const markup = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Ya, Ban', callback_data: execCb     },
            { text: '❌ Batal',   callback_data: 'admin_ban' }
          ]
        ]
      }
    };

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, markup);
    } else {
      await ctx.reply(text, markup);
    }
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