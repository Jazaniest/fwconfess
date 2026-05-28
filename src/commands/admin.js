import { adminMiddleware }       from '../middleware/admin-auth.js';
import { setupAdminStats }       from '../handlers/admin/admin-stats.js';
import { setupAdminUsers }       from '../handlers/admin/admin-users.js';
import { setupAdminReports }     from '../handlers/admin/admin-reports.js';
import { setupAdminBan,
         showBanConfirmation,
         showTempBanDurationMenu } from '../handlers/admin/admin-ban.js';
import { setupAdminSettings }   from '../handlers/admin/admin-settings.js';
import { setupAdminBroadcast }  from '../handlers/admin/admin-broadcast.js';
import { isAdminUser }           from '../middleware/admin-auth.js';

/**
 * Admin command entry-point.
 *
 * Tanggung jawab file ini:
 *   1. Menginisiasi shared state (adminInputState)
 *   2. Memanggil semua setup* dari handlers/admin/
 *   3. Mendaftarkan /admin command dan menu utama admin
 *   4. Menangani text input multi-step (ban, settings, users) yang butuh shared state
 *
 * @param {import('telegraf').Telegraf} bot
 * @param {string|number} targetChannelId
 */
export default function adminPanel(bot, targetChannelId) {
  /**
   * Shared state untuk alur input teks admin yang multi-step.
   * Key  : adminUserId (number)
   * Value: { action: string, ...contextData }
   *
   * Dilewatkan ke sub-handler yang butuh menerima input teks.
   */
  const adminInputState = new Map();

  // ─── Setup semua sub-handler ─────────────────────────────────────────────

  setupAdminStats(bot, adminMiddleware);
  setupAdminUsers(bot, adminMiddleware, adminInputState);
  setupAdminReports(bot, adminMiddleware, targetChannelId);
  setupAdminBan(bot, adminMiddleware, adminInputState);
  setupAdminSettings(bot, adminMiddleware, adminInputState);
  setupAdminBroadcast(bot, adminMiddleware);

  // ─── /admin command — entry point panel admin ────────────────────────────

  bot.command('admin', adminMiddleware, async (ctx) => {
    await showAdminMenu(ctx);
  });

  // ─── Tombol "Kembali ke Admin" ───────────────────────────────────────────

  bot.action('back_to_admin', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    try {
      await ctx.editMessageText(buildAdminMenuText(), buildAdminMenuMarkup());
    } catch {
      await ctx.reply(buildAdminMenuText(), buildAdminMenuMarkup());
    }
  });

  // ─── /cancel command (khusus di konteks admin input) ────────────────────

  bot.command('cancel', async (ctx) => {
    const userId = ctx.from.id;
    if (!isAdminUser(userId)) return; // biarkan handler lain menangani

    if (adminInputState.has(userId)) {
      adminInputState.delete(userId);
      await ctx.reply(
        '❌ Operasi dibatalkan.',
        { reply_markup: { inline_keyboard: [[{ text: '🏠 Menu Admin', callback_data: 'back_to_admin' }]] } }
      );
    }
  });

  // ─── Text handler: tangani input multi-step admin ────────────────────────
  //
  // Dipanggil dari bot.on('text') di bot.js, SEBELUM handler lain.
  // Return true jika pesan sudah diproses di sini (agar bot.js skip handler lain).

  async function handleAdminText(ctx) {
    const userId = ctx.from.id;
    if (!isAdminUser(userId)) return false;

    const state = adminInputState.get(userId);
    if (!state) return false;

    const text = ctx.message.text.trim();

    // /cancel sudah ditangani oleh bot.command('cancel') di atas
    if (text.startsWith('/')) return false;

    try {
      return await routeAdminInput(ctx, userId, state, text);
    } catch (error) {
      console.error('❌ Error handling admin text input:', error);
      await ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi.');
      adminInputState.delete(userId);
      return true;
    }
  }

  // ─── Router input teks admin ─────────────────────────────────────────────

  async function routeAdminInput(ctx, userId, state, text) {
    switch (state.action) {

      // ── Ban flow ──────────────────────────────────────────────────────────

      case 'ban_user_id': {
        const targetId = parseInt(text);
        if (isNaN(targetId)) {
          await ctx.reply('❌ ID tidak valid. Kirim angka Telegram ID.', {
            reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'admin_ban' }]] }
          });
          return true;
        }

        if (state.banType === 'temporary') {
          adminInputState.set(userId, { ...state, action: 'noop', targetId });
          await showTempBanDurationMenu(ctx, targetId);
        } else {
          adminInputState.set(userId, { ...state, action: 'ban_reason', targetId });
          await ctx.reply(
            `🚫 *Ban Permanent — Konfirmasi*\n\nTarget: \`${targetId}\`\n\nKirimkan alasan ban, atau ketik \`-\` untuk skip.`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '⏭️ Skip Alasan', callback_data: `admin_ban_skip_reason_${targetId}_permanent` }],
                  [{ text: '❌ Batal',        callback_data: 'admin_ban' }],
                ]
              }
            }
          );
        }
        return true;
      }

      case 'ban_reason': {
        const reason   = text === '-' ? null : text;
        const targetId = state.targetId;
        const banType  = state.banType;
        const hours    = state.hours || null;

        adminInputState.set(userId, { ...state, action: 'noop', pendingReason: reason });
        await showBanConfirmation(ctx, targetId, banType, reason, hours);
        return true;
      }

      case 'ban_duration_custom': {
        const hours = parseInt(text);
        if (isNaN(hours) || hours <= 0) {
          await ctx.reply('❌ Durasi tidak valid. Masukkan angka jam (contoh: 24).', {
            reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'admin_ban' }]] }
          });
          return true;
        }
        const targetId = state.targetId;
        adminInputState.set(userId, { ...state, action: 'ban_reason', hours });
        await ctx.reply(
          `⏰ *Durasi: ${hours} jam*\n\nTarget: \`${targetId}\`\n\nKirimkan alasan ban, atau ketik \`-\` untuk skip.`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '⏭️ Skip Alasan', callback_data: `admin_ban_skip_reason_${targetId}_temporary_${hours}` }],
                [{ text: '❌ Batal',        callback_data: 'admin_ban' }],
              ]
            }
          }
        );
        return true;
      }

      // ── Unban flow ────────────────────────────────────────────────────────

      case 'unban_user_id': {
        const targetId = parseInt(text);
        if (isNaN(targetId)) {
          await ctx.reply('❌ ID tidak valid.', {
            reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'admin_ban' }]] }
          });
          return true;
        }
        adminInputState.delete(userId);
        await ctx.reply(
          `✅ *Konfirmasi Unban*\n\nTarget: \`${targetId}\`\n\nApakah kamu yakin?`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: '✅ Ya, Unban', callback_data: `admin_unban_exec_${targetId}` },
                { text: '❌ Batal',     callback_data: 'admin_ban' },
              ]]
            }
          }
        );
        return true;
      }

      // ── Cek ban ───────────────────────────────────────────────────────────

      case 'check_ban_id': {
        const targetId = parseInt(text);
        if (isNaN(targetId)) {
          await ctx.reply('❌ ID tidak valid.', {
            reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'admin_ban' }]] }
          });
          return true;
        }
        adminInputState.delete(userId);

        const { getActiveBan } = await import('../repositories/ban.repo.js');
        const ban = await getActiveBan(targetId);

        if (!ban) {
          await ctx.reply(`✅ User \`${targetId}\` tidak sedang di-ban.`, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'admin_ban' }]] }
          });
        } else {
          const exp = ban.ban_type === 'permanent'
            ? 'Permanent'
            : `Sampai ${new Date(ban.expires_at).toLocaleString('id-ID')}`;
          await ctx.reply(
            `🚫 *User \`${targetId}\` sedang di-ban*\n\n⛔ Tipe: ${ban.ban_type}\n⏱️ ${exp}\n📝 Alasan: ${ban.reason || '-'}`,
            {
              parse_mode: 'Markdown',
              reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'admin_ban' }]] }
            }
          );
        }
        return true;
      }

      // ── Settings flow ─────────────────────────────────────────────────────

      case 'set_config': {
        const { setConfig } = await import('../repositories/config.repo.js');
        await setConfig(state.configKey, text);
        adminInputState.delete(userId);
        await ctx.reply(
          `✅ *Pengaturan disimpan!*\n\n\`${state.configKey}\` = \`${text}\``,
          {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali ke Pengaturan', callback_data: 'admin_settings' }]] }
          }
        );
        return true;
      }

      // ── Search user ───────────────────────────────────────────────────────

      case 'search_user': {
        adminInputState.delete(userId);
        const { searchUsers } = await import('../repositories/user.repo.js');
        const results = await searchUsers(text, 10);

        if (results.length === 0) {
          await ctx.reply('🔍 Tidak ada user yang ditemukan.', {
            reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'admin_users' }]] }
          });
          return true;
        }

        let msg = `🔍 *Hasil Pencarian: "${text}"*\n\n`;
        results.forEach((u) => {
          const uname = u.username ? `@${u.username}` : '_no username_';
          msg += `\`${u.telegram_id}\` ${uname} — ${u.rank}\n`;
        });

        const buttons = results.map(u => ([{
          text         : `👤 ${u.telegram_id}${u.username ? ' @' + u.username : ''}`,
          callback_data: `admin_user_detail_${u.telegram_id}_search_0`,
        }]));
        buttons.push([{ text: '🔙 Kembali', callback_data: 'admin_users' }]);

        await ctx.reply(msg, {
          parse_mode  : 'Markdown',
          reply_markup: { inline_keyboard: buttons },
        });
        return true;
      }

      case 'set_max': {
        const val = parseInt(text);
        if (isNaN(val) || val <= 0) {
          await ctx.reply('❌ Nilai tidak valid. Masukkan angka positif.', {
            reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'admin_set_ratelimit' }]] }
          });
          return true;
        }
        const { setConfig } = await import('../repositories/config.repo.js');
        await setConfig('confession_max_per_window', String(val));
        adminInputState.delete(userId);
        await ctx.reply(`✅ Maksimal menfess diubah ke *${val}x*.`, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali ke Rate Limit', callback_data: 'admin_set_ratelimit' }]] }
        });
        return true;
      }

      case 'set_hours': {
        const val = parseInt(text);
        if (isNaN(val) || val <= 0) {
          await ctx.reply('❌ Nilai tidak valid. Masukkan angka jam positif.', {
            reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'admin_set_ratelimit' }]] }
          });
          return true;
        }
        const { setConfig } = await import('../repositories/config.repo.js');
        await setConfig('confession_window_hours', String(val));
        adminInputState.delete(userId);
        await ctx.reply(`✅ Jangka waktu window diubah ke *${val} jam*.`, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali ke Rate Limit', callback_data: 'admin_set_ratelimit' }]] }
        });
        return true;
      }

      case 'set_msg_hit': {
        const { setConfig } = await import('../repositories/config.repo.js');
        await setConfig('ratelimit_msg_hit', text);
        adminInputState.delete(userId);
        await ctx.reply(`✅ Pesan rate limit berhasil diperbarui.`, {
          reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali ke Rate Limit', callback_data: 'admin_set_ratelimit' }]] }
        });
        return true;
      }

      case 'set_msg_success': {
        const { setConfig } = await import('../repositories/config.repo.js');
        await setConfig('ratelimit_msg_success', text);
        adminInputState.delete(userId);
        await ctx.reply(`✅ Pesan sukses menfess berhasil diperbarui.`, {
          reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali ke Rate Limit', callback_data: 'admin_set_ratelimit' }]] }
        });
        return true;
      }

      case 'set_rank_limit': {
        const val = parseInt(text);
        if (isNaN(val) || val <= 0) {
          await ctx.reply('❌ Nilai tidak valid. Masukkan angka positif.', {
            reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: `admin_rank_edit_${state.rank}` }]] }
          });
          return true;
        }
        const { getAllRankLimits, updateRankLimit } = await import('../repositories/confession.repo.js');
        const ranks    = await getAllRankLimits();
        const rankData = ranks.find(r => r.rank === state.rank);
        await updateRankLimit(state.rank, state.actionType, val, rankData?.is_active ?? 1);
        adminInputState.delete(userId);
        const actionLabel = { confess: 'Confess', hitme: 'Hit Me', showme: 'Show Me' }[state.actionType];
        await ctx.reply(`✅ Limit *${actionLabel}* rank *${state.rank}* diubah ke *${val}x*.`, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali ke Edit Rank', callback_data: `admin_rank_edit_${state.rank}` }]] }
        });
        return true;
      }

      case 'promote_user_step1': {
        const targetId = parseInt(text);
        if (isNaN(targetId)) {
          await ctx.reply('❌ ID tidak valid. Kirim angka Telegram ID.', {
            reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'admin_rank_settings' }]] }
          });
          return true;
        }
        const { getAllRankLimits } = await import('../repositories/confession.repo.js');
        const ranks = await getAllRankLimits();
        const activeRanks = ranks.filter(r => r.is_active && r.rank !== 'member');

        if (activeRanks.length === 0) {
          adminInputState.delete(userId);
          await ctx.reply('❌ Tidak ada rank aktif selain member.', {
            reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'admin_rank_settings' }]] }
          });
          return true;
        }

        adminInputState.set(userId, { ...state, action: 'noop', targetId });
        const buttons = activeRanks.map(r => ([{
          text: `👑 ${r.rank}`,
          callback_data: `admin_do_promote_${targetId}_${r.rank}`
        }]));
        buttons.push([{ text: '❌ Batal', callback_data: 'admin_rank_settings' }]);

        await ctx.reply(
          `👑 *Promote User \`${targetId}\`*\n\nPilih rank tujuan:`,
          { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }
        );
        return true;
      }

      default:
        return false;
    }
  }

  return { handleAdminText };
}

// ─── Menu admin helpers ──────────────────────────────────────────────────────

async function showAdminMenu(ctx) {
  await ctx.reply(buildAdminMenuText(), buildAdminMenuMarkup());
}

function buildAdminMenuText() {
  return (
    '🔧 *Admin Panel*\n\n' +
    'Selamat datang di panel admin\\. Pilih menu di bawah ini:'
  );
}

function buildAdminMenuMarkup() {
  return {
    parse_mode  : 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📊 Statistik',  callback_data: 'admin_stats'     },
          { text: '👥 Kelola User', callback_data: 'admin_users'    },
        ],
        [
          { text: '📋 Laporan',    callback_data: 'admin_reports'   },
          { text: '🚫 Ban/Unban',  callback_data: 'admin_ban'       },
        ],
        [
          { text: '⚙️ Pengaturan', callback_data: 'admin_settings'  },
          { text: '📢 Broadcast',  callback_data: 'admin_broadcast' },
        ],
      ],
    },
  };
}