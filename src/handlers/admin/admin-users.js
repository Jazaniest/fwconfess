import { Database } from '../../commands/database.js';

/**
 * Setup handler pengelolaan user (list, detail, search, stats, banned, promote)
 * @param {Telegraf} bot
 * @param {Function} adminMiddleware
 * @param {Map} adminInputState - shared state map dari admin.js
 */
export function setupAdminUsers(bot, adminMiddleware, adminInputState) {

  // ─── Menu Kelola User ─────────────────────────────────────────────────────

  bot.action('admin_users', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      '👥 *Kelola User*\n\nPilih opsi pengelolaan user:',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📋 Daftar User', callback_data: 'admin_list_users_0'},
              { text: '🔍 Cari User',   callback_data: 'admin_search_user'}
            ],
            [
              { text: '📊 User Stats',  callback_data: 'admin_user_stats'},
              { text: '🚫 User Banned', callback_data: 'admin_banned_users_0'}
            ],
            [{ text: '🆕 User Baru',   callback_data: 'admin_new_users'}],
            [{ text: '🏠 Kembali',     callback_data: 'back_to_admin'}]
          ]
        }
      }
    );
  });

  // ─── Daftar User (pagination) ─────────────────────────────────────────────

  bot.action(/^admin_list_users_(\d+)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const offset = parseInt(ctx.match[1]);
    const limit  = 10;

    const [users, total] = await Promise.all([
      Database.getUsersPaginated(limit + 1, offset),
      Database.countAllUsers()
    ]);

    const hasMore    = users.length > limit;
    const page       = users.slice(0, limit);
    const pageNum    = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    let text = `📋 *Daftar User* (hal. ${pageNum}/${totalPages}, total: ${total})\n\n`;
    page.forEach((u) => {
      const uname  = u.username ? `@${u.username}` : '_no username_';
      const status = u.is_active ? '✅' : '🚫';
      text += `${status} \`${u.telegram_id}\` ${uname}\n`;
      text += `   Rank: *${u.rank}* | Gender: ${u.gender || '-'} | Menfess: ${u.total_confessions}\n`;
      text += `   Daftar: ${new Date(u.registered_at).toLocaleDateString('id-ID')}\n\n`;
    });

    const navButtons = [];
    if (offset > 0) navButtons.push({ text: '⬅️ Sebelumnya', callback_data: `admin_list_users_${offset - limit}` });
    if (hasMore)    navButtons.push({ text: '➡️ Selanjutnya', callback_data: `admin_list_users_${offset + limit}` });

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

  // ─── Detail satu user ─────────────────────────────────────────────────────

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

  // ─── Konfirmasi Ban / Unban dari detail user ──────────────────────────────

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
          inline_keyboard: [[
            { text: '✅ Ya, Ban', callback_data: `admin_do_ban_${targetId}_${backSource}_${backOffset}` },
            { text: '❌ Batal',   callback_data: `admin_user_detail_${targetId}_${backSource}_${backOffset}` }
          ]]
        }
      }
    );
  });

  bot.action(/^admin_do_ban_(\d+)_(\w+)_(\d+)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery('🚫 Memban...');
    const targetId   = parseInt(ctx.match[1]);
    const backSource = ctx.match[2];
    const backOffset = ctx.match[3];

    await Database.createBan(targetId, 'permanent', 'Banned via admin panel (user detail)', null, ctx.from.id);

    await ctx.editMessageText(
      `✅ User \`${targetId}\` berhasil di-ban.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '🔙 Kembali ke Detail', callback_data: `admin_user_detail_${targetId}_${backSource}_${backOffset}` }
          ]]
        }
      }
    );
  });

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
          inline_keyboard: [[
            { text: '✅ Ya, Unban', callback_data: `admin_do_unban_${targetId}_${backSource}_${backOffset}` },
            { text: '❌ Batal',     callback_data: `admin_user_detail_${targetId}_${backSource}_${backOffset}` }
          ]]
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
          inline_keyboard: [[
            { text: '🔙 Kembali ke Detail', callback_data: `admin_user_detail_${targetId}_${backSource}_${backOffset}` }
          ]]
        }
      }
    );
  });

  // ─── Cari User ────────────────────────────────────────────────────────────

  bot.action('admin_search_user', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    adminInputState.set(ctx.from.id, { action: 'search_user' });

    await ctx.editMessageText(
      `🔍 *Cari User*\n\nKirimkan Telegram ID (angka) atau username (tanpa @).\n\n_Ketik /cancel untuk membatalkan_`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '❌ Batal', callback_data: 'admin_users' }]]
        }
      }
    );
  });

  // Pagination hasil pencarian (dari tombol navigasi)
  bot.action(/^admin_search_results_(\d+)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const offset = parseInt(ctx.match[1]);
    const state  = adminInputState.get(ctx.from.id);
    if (!state?.searchQuery) return ctx.editMessageText('❌ Sesi pencarian habis. Silakan cari ulang.');

    await showSearchResults(ctx, state.searchQuery, offset);
  });

  // ─── User Baru ────────────────────────────────────────────────────────────

  bot.action('admin_new_users', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const stats = await Database.countNewUsers();

    await ctx.editMessageText(
      `🆕 *Registrasi User Baru*\n\n` +
      `📅 24 jam terakhir : *${stats.day1}* user\n` +
      `📅 7 hari terakhir : *${stats.day7}* user\n` +
      `📅 30 hari terakhir: *${stats.day30}* user`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '🔄 Refresh', callback_data: 'admin_new_users' },
            { text: '🔙 Kembali', callback_data: 'admin_users'     }
          ]]
        }
      }
    );
  });

  // ─── User Stats ───────────────────────────────────────────────────────────

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
        inline_keyboard: [[
          { text: '🔄 Refresh', callback_data: 'admin_user_stats' },
          { text: '🔙 Kembali', callback_data: 'admin_users'      }
        ]]
      }
    });
  });

  // ─── User Banned (pagination) ─────────────────────────────────────────────

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
}

// ─── Shared helper (dipakai juga oleh text handler di admin.js) ───────────────

export async function showSearchResults(ctx, query, offset = 0) {
  const limit = 10;
  const [results, total] = await Promise.all([
    Database.searchUsers(query, limit + 1, offset),
    Database.countSearchUsers(query)
  ]);

  const hasMore = results.length > limit;
  const page    = results.slice(0, limit);

  const emptyMarkup = {
    inline_keyboard: [
      [{ text: '🔍 Cari Lagi', callback_data: 'admin_search_user' }],
      [{ text: '🔙 Kembali',   callback_data: 'admin_users'        }]
    ]
  };

  if (page.length === 0) {
    const emptyText = `🔍 *Hasil Pencarian: "${query}"*\n\nTidak ada user ditemukan.`;
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

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: finalMarkup });
  } else {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: finalMarkup });
  }
}