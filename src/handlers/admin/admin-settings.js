import { Database } from '../../commands/database.js';

/**
 * Setup handler pengaturan bot (rate limit, rank system, promote user)
 * @param {Telegraf} bot
 * @param {Function} adminMiddleware
 * @param {Map} adminInputState - shared state map dari admin.js
 */
export function setupAdminSettings(bot, adminMiddleware, adminInputState) {

  // ─── Menu Pengaturan ──────────────────────────────────────────────────────

  bot.action('admin_settings', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      '⚙️ *Pengaturan Bot*\n\nPilih pengaturan yang ingin diubah:',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '⏰ Rate Limit',      callback_data: 'admin_set_ratelimit' },
              { text: '📝 Max Length',       callback_data: 'admin_set_maxlength' }
            ],
            [
              { text: '🔧 Maintenance',     callback_data: 'admin_maintenance'   },
              { text: '📊 Logs',             callback_data: 'admin_logs'          }
            ],
            [
              { text: '🎯 Auto Mod',         callback_data: 'admin_automod'       },
              { text: '📢 Announcements',    callback_data: 'admin_announcements' }
            ],
            [
              { text: '🏆 Pengaturan Rank', callback_data: 'admin_rank_settings' },
              { text: '🏠 Kembali',          callback_data: 'back_to_admin'       }
            ]
          ]
        }
      }
    );
  });

  // ─── Rate Limit ───────────────────────────────────────────────────────────

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
                { text: `✏️ Ubah Maks (${maxCount}x)`,      callback_data: 'admin_rl_set_max'       },
                { text: `✏️ Ubah Jangka (${windowHours}j)`, callback_data: 'admin_rl_set_hours'     }
              ],
              [
                { text: '📝 Ubah Pesan Rate Limit',          callback_data: 'admin_rl_set_msg_hit'     },
                { text: '📝 Ubah Pesan Sukses',               callback_data: 'admin_rl_set_msg_success' }
              ],
              [{ text: '🔄 Reset ke Default', callback_data: 'admin_rl_reset' }],
              [{ text: '🏠 Kembali',          callback_data: 'admin_settings' }]
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
        reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'admin_rl_cancel' }]] }
      }
    );
  });

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
        reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'admin_rl_cancel' }]] }
      }
    );
  });

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
        reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'admin_rl_cancel' }]] }
      }
    );
  });

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
        reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'admin_rl_cancel' }]] }
      }
    );
  });

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
          inline_keyboard: [[
            { text: '✅ Ya, Reset', callback_data: 'admin_rl_reset_confirm' },
            { text: '❌ Batal',     callback_data: 'admin_set_ratelimit'    }
          ]]
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
          reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali ke Rate Limit', callback_data: 'admin_set_ratelimit' }]] }
        }
      );
    } catch (error) {
      console.error('❌ Error resetting ratelimit:', error);
      await ctx.reply('❌ Gagal reset. Silakan coba lagi.');
    }
  });

  bot.action('admin_rl_cancel', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery('❌ Dibatalkan');
    adminInputState.delete(ctx.from.id);

    const cfg = await Database.getConfigs([
      'confession_max_per_window',
      'confession_window_hours',
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
              { text: `✏️ Ubah Maks (${maxCount}x)`,      callback_data: 'admin_rl_set_max'         },
              { text: `✏️ Ubah Jangka (${windowHours}j)`, callback_data: 'admin_rl_set_hours'       }
            ],
            [
              { text: '📝 Ubah Pesan Rate Limit',          callback_data: 'admin_rl_set_msg_hit'     },
              { text: '📝 Ubah Pesan Sukses',               callback_data: 'admin_rl_set_msg_success' }
            ],
            [{ text: '🔄 Reset ke Default', callback_data: 'admin_rl_reset'    }],
            [{ text: '🏠 Kembali',          callback_data: 'admin_settings'    }]
          ]
        }
      }
    );
  });

  // ─── Rank Settings ────────────────────────────────────────────────────────

  bot.action('admin_rank_settings', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const rankEnabled = await Database.getConfig('rank_system_enabled', '0');
    const isEnabled   = rankEnabled === '1';

    await ctx.editMessageText(
      `🏆 *Pengaturan Sistem Rank*\n\n` +
      `Status: ${isEnabled ? '✅ Aktif' : '❌ Nonaktif'}\n\n` +
      `${isEnabled
        ? 'Sistem rank sedang berjalan. User bisa upgrade rank.'
        : 'Sistem rank dimatikan. Semua user menggunakan limit rank Member.'}`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: isEnabled ? '🔴 Nonaktifkan Rank' : '🟢 Aktifkan Rank', callback_data: 'admin_rank_toggle' }],
            [{ text: '⚙️ Atur Limit per Rank', callback_data: 'admin_rank_limits'  }],
            [{ text: '👑 Promote User',         callback_data: 'admin_promote_user' }],
            [{ text: '🏠 Kembali',               callback_data: 'admin_settings'    }]
          ]
        }
      }
    );
  });

  bot.action('admin_rank_toggle', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const current = await Database.getConfig('rank_system_enabled', '0');
    const newVal  = current === '1' ? '0' : '1';
    await Database.setConfig('rank_system_enabled', newVal);

    await ctx.editMessageText(
      `✅ Sistem rank berhasil *${newVal === '1' ? 'diaktifkan' : 'dinonaktifkan'}*.\n\n` +
      `${newVal === '0'
        ? 'Semua user sementara menggunakan limit rank Member.'
        : 'User kini menggunakan limit sesuai rank masing-masing.'}`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali ke Rank Settings', callback_data: 'admin_rank_settings' }]] }
      }
    );
  });

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

  bot.action(/^admin_rank_edit_(.+)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const rank     = ctx.match[1];
    const ranks    = await Database.getAllRankLimits();
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
            [{ text: '✏️ Limit Confess', callback_data: `admin_rank_setlimit_${rank}_confess` }],
            [{ text: '✏️ Limit Hit Me',  callback_data: `admin_rank_setlimit_${rank}_hitme`   }],
            [{ text: '✏️ Limit Show Me', callback_data: `admin_rank_setlimit_${rank}_showme`  }],
            [{ text: '🔙 Kembali',       callback_data: 'admin_rank_limits'                   }]
          ]
        }
      }
    );
  });

  bot.action(/^admin_rank_toggle_(.+)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const rank = ctx.match[1];
    if (rank === 'member') return ctx.answerCbQuery('❌ Rank member tidak bisa dinonaktifkan.');

    const ranks    = await Database.getAllRankLimits();
    const rankData = ranks.find(r => r.rank === rank);
    const newActive = rankData.is_active ? 0 : 1;

    await Database.updateRankLimit(rank, 'confess', rankData.max_count, newActive);

    await ctx.editMessageText(
      `✅ Rank *${rank}* berhasil *${newActive ? 'diaktifkan' : 'dinonaktifkan'}*.\n` +
      `${newActive
        ? 'Rank ini sekarang tampil di pilihan upgrade user.'
        : 'Rank ini tidak akan tampil di pilihan upgrade user.'}`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'admin_rank_limits' }]] }
      }
    );
  });

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
        reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: `admin_rank_edit_${rank}` }]] }
      }
    );
  });

  // ─── Promote User ─────────────────────────────────────────────────────────

  bot.action('admin_promote_user', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    adminInputState.set(ctx.from.id, { action: 'promote_user_step1' });

    await ctx.editMessageText(
      `👑 *Promote User*\n\n` +
      `Kirimkan ID Telegram user yang ingin di-promote.\n\n` +
      `_Fitur ini akan terhubung ke sistem pembayaran di masa mendatang._\n\n` +
      `_Ketik /cancel untuk membatalkan_`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'admin_rank_settings' }]] }
      }
    );
  });

  bot.action(/^admin_do_promote_(\d+)_(.+)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const targetId = ctx.match[1];
    const newRank  = ctx.match[2];
    adminInputState.delete(ctx.from.id);

    await Database.updateUserRank(parseInt(targetId), newRank);

    await ctx.editMessageText(
      `✅ User \`${targetId}\` berhasil di-promote ke rank *${newRank}*.`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'admin_rank_settings' }]] }
      }
    );
  });
}