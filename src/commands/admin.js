/**
 * Admin command — entry point, hanya registrasi handler ke bot.
 * Business logic ada di handlers/admin/*.js
 */
import { Markup } from 'telegraf';
import { Database } from './database.js';
import { isAdmin, adminMiddleware } from '../middleware/admin-auth.js';
import { handleAdminStats } from '../handlers/admin/admin-stats.js';
import {
  handleAdminReports, handleAdminReportsFilter, handleAdminReportDetail,
  handleAdminReportStatus, handleAdminReportDelete, handleAdminReportDeleteConfirm,
} from '../handlers/admin/admin-reports.js';
import {
  handleAdminUsers, handleAdminListUsers, handleAdminUserDetail,
  handleAdminBanConfirm, handleAdminDoBan, handleAdminUnbanConfirm, handleAdminDoUnban,
  handleAdminSearchUser, handleAdminSearchResults, handleAdminBannedUsers,
  handleAdminNewUsers, handleAdminUserStats, showSearchResults,
} from '../handlers/admin/admin-users.js';
import {
  handleAdminBanMenu, handleAdminBanUser, handleAdminTempbanUser,
  handleAdminUnbanUser, handleAdminCheckBan, handleAdminTempbanDuration,
  handleAdminTempbanCustom, handleAdminBanSkipReason, handleAdminBanExec,
  handleAdminUnbanExec, showBanConfirmation, showTempBanDurationMenu,
} from '../handlers/admin/admin-ban.js';
import {
  handleAdminSettings, handleAdminSetRatelimit,
  handleAdminRlSetMax, handleAdminRlSetHours, handleAdminRlSetMsgHit,
  handleAdminRlSetMsgSuccess, handleAdminRlReset, handleAdminRlResetConfirm,
  handleAdminRankSettings, handleAdminRankToggle, handleAdminRankLimits,
  handleAdminRankEdit, handleAdminRankToggleOne, handleAdminRankSetLimit,
  handleAdminPromoteUser, handleAdminDoPromote,
} from '../handlers/admin/admin-settings.js';
import {
  handleAdminBroadcast, handleAdminBroadcastPreview,
  handleAdminBroadcastAll, handleAdminBroadcastWrite,
  handleAdminBcTargetAll, handleAdminBcTargetActive, handleAdminBcTargetBanned,
  handleAdminBcWriteAll, handleAdminBcWriteActive, handleAdminBcWriteBanned,
  handleAdminBroadcastText, handleAdminBroadcastConfirmYes,
  handleAdminBroadcastConfirmNo,
} from '../handlers/admin/admin-broadcast.js';
import {
    handleFeatureFlagsMenu, handleToggleMaintenance, handleToggleFeature
} from '../handlers/admin/admin-settings.js';

/**
 * Handler untuk Admin Panel
 * @param {Telegraf} bot
 */
export default function adminPanel(bot, targetChannelId) {
  console.log('👑 Admin panel initialized');

  const adminInputState = new Map();

  /**
   * Fungsi untuk menampilkan menu admin
   */
  async function showAdminMenu(ctx) {
    const adminText = `👑 *Admin Panel*\n\nSelamat datang Admin ${ctx.from.first_name}!\n\nPilih opsi pengelolaan:`;
    const buttons = [
      [Markup.button.callback('👤 Profile', 'btn_profile'), Markup.button.callback('📊 Statistik Bot', 'admin_stats')],
      [Markup.button.callback('👥 Kelola User', 'admin_users'), Markup.button.callback('📋 Laporan User', 'admin_reports')],
      [Markup.button.callback('🚫 Ban/Unban User', 'admin_ban'), Markup.button.callback('📢 Broadcast', 'admin_broadcast')],
      [Markup.button.callback('⚙️ Pengaturan Bot', 'admin_settings'), Markup.button.callback('ℹ️ Bantuan', 'btn_help')],
    ];
    await ctx.reply(adminText, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons }
    });
  }

  // === ADMIN MENU HANDLERS ===

  // ─── Stats ────────────────────────────────────────────────────────────────
  bot.action('admin_stats', adminMiddleware, (ctx) => handleAdminStats(ctx));
  bot.action('admin_detailed_stats', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      '📈 *Detail Statistik*\n\nFitur ini akan dikembangkan lebih lanjut.',
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'admin_stats' }]] } }
    );
  });

  // ─── Reports ──────────────────────────────────────────────────────────────
  bot.action('admin_reports', adminMiddleware, (ctx) => handleAdminReports(ctx));
  bot.action(/^admin_reports_filter_(\w+)_(\d+)$/, adminMiddleware, (ctx) => {
    handleAdminReportsFilter(ctx, ctx.match[1], parseInt(ctx.match[2]));
  });
  bot.action(/^admin_report_detail_(\d+)_(\w+)_(\d+)$/, adminMiddleware, (ctx) => {
    handleAdminReportDetail(ctx, parseInt(ctx.match[1]), ctx.match[2], ctx.match[3]);
  });
  bot.action(/^admin_report_status_(\d+)_(handled|rejected)_(\w+)_(\d+)$/, adminMiddleware, (ctx) => {
    handleAdminReportStatus(ctx, parseInt(ctx.match[1]), ctx.match[2], ctx.match[3], ctx.match[4]);
  });
  bot.action(/^admin_report_delete_(\d+)_(\w+)_(\d+)$/, adminMiddleware, (ctx) => {
    handleAdminReportDelete(ctx, parseInt(ctx.match[1]), ctx.match[2], ctx.match[3]);
  });
  bot.action(/^admin_report_delete_confirm_(\d+)_(\w+)_(\d+)$/, adminMiddleware, (ctx) => {
    handleAdminReportDeleteConfirm(ctx, parseInt(ctx.match[1]), targetChannelId, ctx.match[2], ctx.match[3]);
  });

  // ─── Users ────────────────────────────────────────────────────────────────
  bot.action('admin_users', adminMiddleware, (ctx) => handleAdminUsers(ctx));
  bot.action(/^admin_list_users_(\d+)$/, adminMiddleware, (ctx) => {
    handleAdminListUsers(ctx, parseInt(ctx.match[1]));
  });
  bot.action(/^admin_user_detail_(\d+)_(\w+)_(\d+)$/, adminMiddleware, (ctx) => {
    handleAdminUserDetail(ctx, parseInt(ctx.match[1]), ctx.match[2], ctx.match[3]);
  });
  bot.action(/^admin_ban_confirm_(\d+)_(\w+)_(\d+)$/, adminMiddleware, (ctx) => {
    handleAdminBanConfirm(ctx, ctx.match[1], ctx.match[2], ctx.match[3]);
  });
  bot.action(/^admin_do_ban_(\d+)_(\w+)_(\d+)$/, adminMiddleware, (ctx) => {
    handleAdminDoBan(ctx, parseInt(ctx.match[1]), ctx.match[2], ctx.match[3]);
  });
  bot.action(/^admin_unban_confirm_(\d+)_(\w+)_(\d+)$/, adminMiddleware, (ctx) => {
    handleAdminUnbanConfirm(ctx, ctx.match[1], ctx.match[2], ctx.match[3]);
  });
  bot.action(/^admin_do_unban_(\d+)_(\w+)_(\d+)$/, adminMiddleware, (ctx) => {
    handleAdminDoUnban(ctx, parseInt(ctx.match[1]), ctx.match[2], ctx.match[3]);
  });
  bot.action('admin_search_user', adminMiddleware, (ctx) => handleAdminSearchUser(ctx, adminInputState));
  bot.action(/^admin_search_results_(\d+)$/, adminMiddleware, (ctx) => {
    handleAdminSearchResults(ctx, adminInputState, parseInt(ctx.match[1]));
  });
  bot.action(/^admin_banned_users_(\d+)$/, adminMiddleware, (ctx) => {
    handleAdminBannedUsers(ctx, parseInt(ctx.match[1]));
  });
  bot.action('admin_new_users', adminMiddleware, (ctx) => handleAdminNewUsers(ctx));
  bot.action('admin_user_stats', adminMiddleware, (ctx) => handleAdminUserStats(ctx));

  // ─── Ban / Unban Menu ─────────────────────────────────────────────────────
  bot.action('admin_ban', adminMiddleware, (ctx) => handleAdminBanMenu(ctx));
  bot.action('admin_ban_user', adminMiddleware, (ctx) => handleAdminBanUser(ctx, adminInputState));
  bot.action('admin_tempban_user', adminMiddleware, (ctx) => handleAdminTempbanUser(ctx, adminInputState));
  bot.action('admin_unban_user', adminMiddleware, (ctx) => handleAdminUnbanUser(ctx, adminInputState));
  bot.action('admin_check_ban', adminMiddleware, (ctx) => handleAdminCheckBan(ctx, adminInputState));

  bot.action(/^admin_tempban_duration_(\d+)_(\d+)$/, adminMiddleware, (ctx) => {
    handleAdminTempbanDuration(ctx, ctx.match[1], parseInt(ctx.match[2]));
  });
  bot.action(/^admin_tempban_custom_(\d+)$/, adminMiddleware, (ctx) => {
    handleAdminTempbanCustom(ctx, ctx.match[1], adminInputState);
  });
  bot.action(/^admin_ban_skip_reason_(\d+)_(permanent|temporary)_?(\d*)$/, adminMiddleware, (ctx) => {
    handleAdminBanSkipReason(ctx, parseInt(ctx.match[1]), ctx.match[2], ctx.match[3]);
  });
  bot.action(/^admin_ban_exec_(\d+)_(permanent|temporary)_?(\d*)$/, adminMiddleware, (ctx) => {
    handleAdminBanExec(ctx, parseInt(ctx.match[1]), ctx.match[2], ctx.match[3], adminInputState);
  });
  bot.action(/^admin_unban_exec_(\d+)$/, adminMiddleware, (ctx) => {
    handleAdminUnbanExec(ctx, parseInt(ctx.match[1]));
  });

  // ─── Broadcast ────────────────────────────────────────────────────────────
  bot.action('admin_broadcast', adminMiddleware, (ctx) => handleAdminBroadcast(ctx));
  bot.action('admin_broadcast_preview', adminMiddleware, (ctx) => handleAdminBroadcastPreview(ctx));
  bot.action('admin_broadcast_all', adminMiddleware, (ctx) => handleAdminBroadcastAll(ctx));
  bot.action('admin_bc_target_all', adminMiddleware, (ctx) => handleAdminBcTargetAll(ctx));
  bot.action('admin_bc_target_active', adminMiddleware, (ctx) => handleAdminBcTargetActive(ctx));
  bot.action('admin_bc_target_banned', adminMiddleware, (ctx) => handleAdminBcTargetBanned(ctx));
  bot.action('admin_broadcast_write', adminMiddleware, (ctx) => handleAdminBroadcastWrite(ctx));
  bot.action('admin_bc_write_all', adminMiddleware, (ctx) => handleAdminBcWriteAll(ctx));
  bot.action('admin_bc_write_active', adminMiddleware, (ctx) => handleAdminBcWriteActive(ctx));
  bot.action('admin_bc_write_banned', adminMiddleware, (ctx) => handleAdminBcWriteBanned(ctx));
  bot.action('admin_bc_confirm_yes', adminMiddleware, (ctx) => handleAdminBroadcastConfirmYes(ctx));
  bot.action('admin_bc_confirm_no', adminMiddleware, (ctx) => handleAdminBroadcastConfirmNo(ctx));

  // ─── Settings ─────────────────────────────────────────────────────────────
  bot.action('admin_settings', adminMiddleware, (ctx) => handleAdminSettings(ctx));

  // Feature Flags & Maintenance
  bot.action('admin_feature_flags', adminMiddleware, (ctx) => handleFeatureFlagsMenu(ctx));
  bot.action('toggle_maintenance_mode', adminMiddleware, (ctx) => handleToggleMaintenance(ctx));
  bot.action(/^toggle_feature_(.+)$/, adminMiddleware, (ctx) => handleToggleFeature(ctx, ctx.match[1]));

  bot.action('admin_set_ratelimit', adminMiddleware, (ctx) => handleAdminSetRatelimit(ctx));
  bot.action('admin_rl_set_max', adminMiddleware, (ctx) => handleAdminRlSetMax(ctx, adminInputState));
  bot.action('admin_rl_set_hours', adminMiddleware, (ctx) => handleAdminRlSetHours(ctx, adminInputState));
  bot.action('admin_rl_set_msg_hit', adminMiddleware, (ctx) => handleAdminRlSetMsgHit(ctx, adminInputState));
  bot.action('admin_rl_set_msg_success', adminMiddleware, (ctx) => handleAdminRlSetMsgSuccess(ctx, adminInputState));
  bot.action('admin_rl_reset', adminMiddleware, (ctx) => handleAdminRlReset(ctx));
  bot.action('admin_rl_reset_confirm', adminMiddleware, (ctx) => handleAdminRlResetConfirm(ctx));
  bot.action('admin_rl_cancel', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery('❌ Dibatalkan');
    adminInputState.delete(ctx.from.id);
    await ctx.editMessageText('❌ Dibatalkan.', {
      reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali ke Rate Limit', callback_data: 'admin_set_ratelimit' }]] }
    });
  });

  // Rank settings
  bot.action('admin_rank_settings', adminMiddleware, (ctx) => handleAdminRankSettings(ctx));
  bot.action('admin_rank_toggle', adminMiddleware, (ctx) => handleAdminRankToggle(ctx));
  bot.action('admin_rank_limits', adminMiddleware, (ctx) => handleAdminRankLimits(ctx));
  bot.action(/^admin_rank_edit_(.+)$/, adminMiddleware, (ctx) => {
    handleAdminRankEdit(ctx, ctx.match[1]);
  });
  bot.action(/^admin_rank_toggle_(.+)$/, adminMiddleware, (ctx) => {
    handleAdminRankToggleOne(ctx, ctx.match[1]);
  });
  bot.action(/^admin_rank_setlimit_([^_]+)_(confess|hitme|showme)$/, adminMiddleware, (ctx) => {
    handleAdminRankSetLimit(ctx, ctx.match[1], ctx.match[2], adminInputState);
  });
  bot.action('admin_promote_user', adminMiddleware, (ctx) => handleAdminPromoteUser(ctx, adminInputState));
  bot.action(/^admin_do_promote_(\d+)_(.+)$/, adminMiddleware, (ctx) => {
    handleAdminDoPromote(ctx, ctx.match[1], ctx.match[2]);
  });

  // ─── Back to Admin ────────────────────────────────────────────────────────
  bot.action('back_to_admin', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery('👑 Kembali ke Admin Panel...');
    await showAdminMenu(ctx);
  });

  // ─── Text Input Handler ───────────────────────────────────────────────────
  bot.on('text', async (ctx, next) => {
    const userId = ctx.from.id;

    if (!isAdmin(userId)) return next();

    // Cek apakah admin dalam alur broadcast
    const handled = await handleAdminBroadcastText(ctx);
    if (handled) return;

    if (!adminInputState.has(userId)) return next();

    const text = ctx.message.text.trim();

    if (text === '/cancel') {
      adminInputState.delete(userId);
      return ctx.reply('❌ Dibatalkan.', {
        reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali ke Rate Limit', callback_data: 'admin_set_ratelimit' }]] }
      });
    }

    const state = adminInputState.get(userId);

    try {
      if (state.action === 'set_max') {
        const val = parseInt(text, 10);
        if (isNaN(val) || val < 1 || val > 100) return ctx.reply('❌ Masukkan angka antara 1 sampai 100.');
        await Database.setConfig('confession_max_per_window', val.toString());
        adminInputState.delete(userId);
        await ctx.reply(`✅ *Maksimal menfess diperbarui: ${val}x per window*`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali ke Rate Limit', callback_data: 'admin_set_ratelimit' }]] } });

      } else if (state.action === 'set_hours') {
        const val = parseFloat(text);
        if (isNaN(val) || val < 0.1 || val > 720) return ctx.reply('❌ Masukkan angka jam antara 0.1 sampai 720.');
        await Database.setConfig('confession_window_hours', val.toString());
        adminInputState.delete(userId);
        await ctx.reply(`✅ *Jangka waktu diperbarui: ${val} jam*`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali ke Rate Limit', callback_data: 'admin_set_ratelimit' }]] } });

      } else if (state.action === 'set_msg_hit') {
        if (text.length < 10 || text.length > 500) return ctx.reply('❌ Pesan harus antara 10 sampai 500 karakter.');
        await Database.setConfig('ratelimit_msg_hit', text);
        adminInputState.delete(userId);
        await ctx.reply(`✅ *Pesan rate limit diperbarui!*\n\nPreview:\n${text}`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali ke Rate Limit', callback_data: 'admin_set_ratelimit' }]] } });

      } else if (state.action === 'set_msg_success') {
        if (text.length < 10 || text.length > 500) return ctx.reply('❌ Pesan harus antara 10 sampai 500 karakter.');
        await Database.setConfig('ratelimit_msg_success', text);
        adminInputState.delete(userId);
        await ctx.reply(`✅ *Pesan sukses diperbarui!*\n\nPreview:\n${text}`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali ke Rate Limit', callback_data: 'admin_set_ratelimit' }]] } });

      } else if (state.action === 'set_rank_limit') {
        const val = parseInt(text, 10);
        if (isNaN(val) || val < 1 || val > 100) return ctx.reply('❌ Masukkan angka antara 1 sampai 100.');
        const ranks = await Database.getAllRankLimits();
        const rankData = ranks.find(r => r.rank === state.rank);
        const actionLabel = { confess: 'Confess', hitme: 'Hit Me', showme: 'Show Me' }[state.actionType];
        await Database.updateRankLimit(state.rank, state.actionType, val, rankData.is_active);
        adminInputState.delete(userId);
        await ctx.reply(`✅ *Limit ${actionLabel} rank ${state.rank} diperbarui: ${val}x per window*`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali ke Rank', callback_data: `admin_rank_edit_${state.rank}` }]] } });

      } else if (state.action === 'search_user') {
        if (text.length < 1 || text.length > 50) return ctx.reply('❌ Query terlalu panjang atau kosong.');
        adminInputState.set(userId, { action: 'search_user_result', searchQuery: text });
        await showSearchResults(ctx, adminInputState, text, 0);

      } else if (state.action === 'promote_user_step1') {
        const targetId = parseInt(text, 10);
        if (isNaN(targetId)) return ctx.reply('❌ ID tidak valid.');
        const user = await Database.getUserById(targetId);
        if (!user) return ctx.reply('❌ User tidak ditemukan.');
        adminInputState.set(userId, { action: 'promote_user_step2', targetId });
        const ranks = await Database.getAllRankLimits();
        const buttons = ranks.filter(r => r.rank !== 'member').map(r => ([{ text: r.rank, callback_data: `admin_do_promote_${targetId}_${r.rank}` }]));
        buttons.push([{ text: '❌ Batal', callback_data: 'admin_rank_settings' }]);
        await ctx.reply(`👤 User ditemukan: \`${targetId}\` (rank: *${user.rank}*)\n\nPilih rank tujuan:`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });

      } else if (state.action === 'ban_user_id') {
        const targetId = parseInt(text, 10);
        if (isNaN(targetId)) return ctx.reply('❌ ID tidak valid.');
        const user = await Database.getUserById(targetId);
        if (!user) return ctx.reply('❌ User tidak ditemukan.');
        const activeBan = await Database.getActiveBan(targetId);
        const banStatus = activeBan ? `🚫 Sedang di-ban (${activeBan.ban_type})` : '✅ Tidak di-ban';
        const banType = state.banType;
        adminInputState.delete(userId);

        if (banType === 'temporary') {
          adminInputState.set(userId, { action: 'ban_duration_select', banType: 'temporary', targetId });
          await ctx.reply(`👤 *Info User*\n\n🆔 ID: \`${targetId}\`\n📊 Rank: *${user.rank}*\n🔰 Status Ban: ${banStatus}\n\nLanjut pilih durasi:`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '1 Jam', callback_data: `admin_tempban_duration_${targetId}_1` }, { text: '6 Jam', callback_data: `admin_tempban_duration_${targetId}_6` }, { text: '12 Jam', callback_data: `admin_tempban_duration_${targetId}_12` }], [{ text: '1 Hari', callback_data: `admin_tempban_duration_${targetId}_24` }, { text: '3 Hari', callback_data: `admin_tempban_duration_${targetId}_72` }, { text: '7 Hari', callback_data: `admin_tempban_duration_${targetId}_168` }], [{ text: '30 Hari', callback_data: `admin_tempban_duration_${targetId}_720` }, { text: '✏️ Custom', callback_data: `admin_tempban_custom_${targetId}` }], [{ text: '❌ Batal', callback_data: 'admin_ban' }]] } });
        } else {
          adminInputState.set(userId, { action: 'ban_reason', banType: 'permanent', targetId });
          await ctx.reply(`👤 *Info User*\n\n🆔 ID: \`${targetId}\`\n📊 Rank: *${user.rank}*\n🔰 Status Ban: ${banStatus}\n\nKirimkan alasan ban, atau ketik \`-\` untuk skip.\n\n_Ketik /cancel untuk membatalkan_`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '⏭️ Skip Alasan', callback_data: `admin_ban_skip_reason_${targetId}_permanent` }], [{ text: '❌ Batal', callback_data: 'admin_ban' }]] } });
        }

      } else if (state.action === 'ban_duration_custom') {
        const hours = parseFloat(text);
        if (isNaN(hours) || hours < 0.5 || hours > 8760) return ctx.reply('❌ Masukkan angka jam antara 0.5 sampai 8760.');
        const targetId = state.targetId;
        adminInputState.set(userId, { action: 'ban_reason', banType: 'temporary', targetId, hours });
        await ctx.reply(`⏰ Durasi: *${hours} jam*\n\nKirimkan alasan ban, atau ketik \`-\` untuk skip.\n\n_Ketik /cancel untuk membatalkan_`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '⏭️ Skip Alasan', callback_data: `admin_ban_skip_reason_${targetId}_temporary_${hours}` }], [{ text: '❌ Batal', callback_data: 'admin_ban' }]] } });

      } else if (state.action === 'ban_reason') {
        const reason = text === '-' ? null : text;
        const { banType, targetId, hours } = state;
        adminInputState.set(userId, { ...state, action: 'ban_pending', pendingReason: reason });
        await showBanConfirmation(ctx, targetId, banType, reason, hours || null);

      } else if (state.action === 'unban_user_id') {
        const targetId = parseInt(text, 10);
        if (isNaN(targetId)) return ctx.reply('❌ ID tidak valid.');
        const user = await Database.getUserById(targetId);
        if (!user) return ctx.reply('❌ User tidak ditemukan.');
        const activeBan = await Database.getActiveBan(targetId);
        adminInputState.delete(userId);
        if (!activeBan) return ctx.reply(`ℹ️ User \`${targetId}\` tidak sedang dalam status ban.`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'admin_ban' }]] } });
        const expiredText = activeBan.expires_at ? `Sampai: ${new Date(activeBan.expires_at).toLocaleString('id-ID')}` : 'Permanent';
        await ctx.reply(`🔍 *Status Ban User*\n\n🆔 ID: \`${targetId}\`\n⛔ Tipe: *${activeBan.ban_type}*\n⏱️ ${expiredText}\n📝 Alasan: ${activeBan.reason || '-'}\n📅 Di-ban: ${new Date(activeBan.banned_at).toLocaleString('id-ID')}\n\nLanjutkan unban?`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '✅ Ya, Unban', callback_data: `admin_unban_exec_${targetId}` }, { text: '❌ Batal', callback_data: 'admin_ban' }]] } });

      } else if (state.action === 'check_ban_id') {
        const targetId = parseInt(text, 10);
        if (isNaN(targetId)) return ctx.reply('❌ ID tidak valid.');
        const activeBan = await Database.getActiveBan(targetId);
        const banHistory = await Database.getBanHistory(targetId, 3);
        adminInputState.delete(userId);
        let statusText = activeBan ? `🚫 *Sedang di-ban*\n⛔ Tipe: ${activeBan.ban_type}\n⏱️ ${activeBan.expires_at ? `Sampai: ${new Date(activeBan.expires_at).toLocaleString('id-ID')}` : 'Permanent'}\n📝 Alasan: ${activeBan.reason || '-'}\n📅 Sejak: ${new Date(activeBan.banned_at).toLocaleString('id-ID')}` : `✅ *Tidak di-ban*`;
        let historyText = banHistory.length > 0 ? `\n\n📋 *Riwayat Ban:*\n` + banHistory.map((b, i) => `${i + 1}. ${b.ban_type === 'permanent' ? '♾️' : '⏰'} ${b.ban_type} — ${new Date(b.banned_at).toLocaleDateString('id-ID')} — ${b.is_active ? 'aktif' : 'selesai'}\n`).join('') : '';
        const buttons = activeBan ? [[{ text: '✅ Unban Sekarang', callback_data: `admin_unban_exec_${targetId}` }]] : [];
        buttons.push([{ text: '🔙 Kembali ke Ban Menu', callback_data: 'admin_ban' }]);
        await ctx.reply(`🔍 *Status Ban — \`${targetId}\`*\n\n${statusText}${historyText}`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
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
  };
}
