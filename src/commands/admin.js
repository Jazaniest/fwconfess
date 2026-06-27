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
  handleAdminPromoteUser, handleAdminDoPromote, handleAdminRankPrices, handleAdminRankEditPrice,
  handleAdminReferralSettings, handleAdminReferralToggle, handleAdminRefRewardsPublic,
  handleAdminRefEditPublicReward, handleAdminRefRewardCoFounder, handleAdminManageCoFounder,
  handleAdminAddCoFounder, handleAdminRemoveCoFounder,
  handleFeatureFlagsMenu, handleToggleMaintenance, handleToggleFeature,
  handleAdminAdSettings, handleAdminAdSetLimit,
} from '../handlers/admin/admin-settings.js';
import {
  handleAdminBroadcast, handleAdminBroadcastPreview,
  handleAdminBroadcastAll, handleAdminBroadcastWrite,
  handleAdminBcTargetAll, handleAdminBcTargetActive, handleAdminBcTargetBanned,
  handleAdminBcWriteAll, handleAdminBcWriteActive, handleAdminBcWriteBanned,
  handleAdminBroadcastText, handleAdminBroadcastConfirmYes,
  handleAdminBroadcastConfirmNo,
} from '../handlers/admin/admin-broadcast.js';

/**
 * Handler untuk Admin Panel
 * @param {Telegraf} bot
 */
export default function adminPanel(bot, targetChannelId) {
  console.log('👑 Admin panel initialized');

  const adminInputState = new Map();

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
  bot.action('admin_stats', adminMiddleware, (ctx) => handleAdminStats(ctx));
  bot.action('admin_reports', adminMiddleware, (ctx) => handleAdminReports(ctx));
  bot.action(/^admin_reports_filter_(\w+)_(\d+)$/, adminMiddleware, (ctx) => handleAdminReportsFilter(ctx, ctx.match[1], parseInt(ctx.match[2])));
  bot.action(/^admin_report_detail_(\d+)_(\w+)_(\d+)$/, adminMiddleware, (ctx) => handleAdminReportDetail(ctx, parseInt(ctx.match[1]), ctx.match[2], ctx.match[3]));
  bot.action(/^admin_report_status_(\d+)_(handled|rejected)_(\w+)_(\d+)$/, adminMiddleware, (ctx) => handleAdminReportStatus(ctx, parseInt(ctx.match[1]), ctx.match[2], ctx.match[3], ctx.match[4]));
  bot.action(/^admin_report_delete_(\d+)_(\w+)_(\d+)$/, adminMiddleware, (ctx) => handleAdminReportDelete(ctx, parseInt(ctx.match[1]), ctx.match[2], ctx.match[3]));
  bot.action(/^admin_report_delete_confirm_(\d+)_(\w+)_(\d+)$/, adminMiddleware, (ctx) => handleAdminReportDeleteConfirm(ctx, parseInt(ctx.match[1]), targetChannelId, ctx.match[2], ctx.match[3]));
  bot.action('admin_users', adminMiddleware, (ctx) => handleAdminUsers(ctx));
  bot.action(/^admin_list_users_(\d+)$/, adminMiddleware, (ctx) => handleAdminListUsers(ctx, parseInt(ctx.match[1])));
  bot.action(/^admin_user_detail_(\d+)_(\w+)_(\d+)$/, adminMiddleware, (ctx) => handleAdminUserDetail(ctx, parseInt(ctx.match[1]), ctx.match[2], ctx.match[3]));
  bot.action(/^admin_ban_confirm_(\d+)_(\w+)_(\d+)$/, adminMiddleware, (ctx) => handleAdminBanConfirm(ctx, ctx.match[1], ctx.match[2], ctx.match[3]));
  bot.action(/^admin_do_ban_(\d+)_(\w+)_(\d+)$/, adminMiddleware, (ctx) => handleAdminDoBan(ctx, parseInt(ctx.match[1]), ctx.match[2], ctx.match[3]));
  bot.action(/^admin_unban_confirm_(\d+)_(\w+)_(\d+)$/, adminMiddleware, (ctx) => handleAdminUnbanConfirm(ctx, ctx.match[1], ctx.match[2], ctx.match[3]));
  bot.action(/^admin_do_unban_(\d+)_(\w+)_(\d+)$/, adminMiddleware, (ctx) => handleAdminDoUnban(ctx, parseInt(ctx.match[1]), ctx.match[2], ctx.match[3]));
  bot.action('admin_search_user', adminMiddleware, (ctx) => handleAdminSearchUser(ctx, adminInputState));
  bot.action(/^admin_search_results_(\d+)$/, adminMiddleware, (ctx) => handleAdminSearchResults(ctx, adminInputState, parseInt(ctx.match[1])));
  bot.action(/^admin_banned_users_(\d+)$/, adminMiddleware, (ctx) => handleAdminBannedUsers(ctx, parseInt(ctx.match[1])));
  bot.action('admin_new_users', adminMiddleware, (ctx) => handleAdminNewUsers(ctx));
  bot.action('admin_user_stats', adminMiddleware, (ctx) => handleAdminUserStats(ctx));
  bot.action('admin_ban', adminMiddleware, (ctx) => handleAdminBanMenu(ctx));
  bot.action('admin_ban_user', adminMiddleware, (ctx) => handleAdminBanUser(ctx, adminInputState));
  bot.action('admin_tempban_user', adminMiddleware, (ctx) => handleAdminTempbanUser(ctx, adminInputState));
  bot.action('admin_unban_user', adminMiddleware, (ctx) => handleAdminUnbanUser(ctx, adminInputState));
  bot.action('admin_check_ban', adminMiddleware, (ctx) => handleAdminCheckBan(ctx, adminInputState));
  bot.action(/^admin_tempban_duration_(\d+)_(\d+)$/, adminMiddleware, (ctx) => handleAdminTempbanDuration(ctx, ctx.match[1], parseInt(ctx.match[2])));
  bot.action(/^admin_tempban_custom_(\d+)$/, adminMiddleware, (ctx) => handleAdminTempbanCustom(ctx, ctx.match[1], adminInputState));
  bot.action(/^admin_ban_skip_reason_(\d+)_(permanent|temporary)_?(\d*)$/, adminMiddleware, (ctx) => handleAdminBanSkipReason(ctx, parseInt(ctx.match[1]), ctx.match[2], ctx.match[3]));
  bot.action(/^admin_ban_exec_(\d+)_(permanent|temporary)_?(\d*)$/, adminMiddleware, (ctx) => handleAdminBanExec(ctx, parseInt(ctx.match[1]), ctx.match[2], ctx.match[3], adminInputState));
  bot.action(/^admin_unban_exec_(\d+)$/, adminMiddleware, (ctx) => handleAdminUnbanExec(ctx, parseInt(ctx.match[1])));
  bot.action('admin_broadcast', adminMiddleware, (ctx) => handleAdminBroadcast(ctx));
  bot.action('admin_broadcast_all', adminMiddleware, (ctx) => handleAdminBroadcastAll(ctx));
  bot.action('admin_broadcast_write', adminMiddleware, (ctx) => handleAdminBroadcastWrite(ctx));
  bot.action('admin_settings', adminMiddleware, (ctx) => handleAdminSettings(ctx));
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
  bot.action('admin_rank_settings', adminMiddleware, (ctx) => handleAdminRankSettings(ctx));
  bot.action('admin_rank_prices', adminMiddleware, (ctx) => handleAdminRankPrices(ctx));
  bot.action(/^admin_rank_price_edit_(.+)$/, adminMiddleware, (ctx) => handleAdminRankEditPrice(ctx, ctx.match[1], adminInputState));
  bot.action('admin_rank_toggle', adminMiddleware, (ctx) => handleAdminRankToggle(ctx));
  bot.action('admin_rank_limits', adminMiddleware, (ctx) => handleAdminRankLimits(ctx));
  bot.action(/^admin_rank_edit_(.+)$/, adminMiddleware, (ctx) => handleAdminRankEdit(ctx, ctx.match[1]));
  bot.action(/^admin_rank_toggle_(.+)$/, adminMiddleware, (ctx) => handleAdminRankToggleOne(ctx, ctx.match[1]));
  bot.action(/^admin_rank_setlimit_([^_]+)_(confess|hitme|showme)$/, adminMiddleware, (ctx) => handleAdminRankSetLimit(ctx, ctx.match[1], ctx.match[2], adminInputState));
  bot.action('admin_promote_user', adminMiddleware, (ctx) => handleAdminPromoteUser(ctx, adminInputState));
  bot.action(/^admin_do_promote_(\d+)_(.+)$/, adminMiddleware, (ctx) => handleAdminDoPromote(ctx, ctx.match[1], ctx.match[2]));
  bot.action('admin_referral_settings', adminMiddleware, (ctx) => handleAdminReferralSettings(ctx));
  bot.action('admin_ref_toggle_feature', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const key = 'feature_referral_enabled';
    const current = configService.get(key, '0');
    const newValue = current === '1' ? '0' : '1';
    await configService.set(key, newValue);
    await ctx.answerCbQuery(`Fitur referral ${newValue === '1' ? 'diaktifkan' : 'dinonaktifkan'}`);
    await handleAdminReferralSettings(ctx); // Refresh menu
  });
  bot.action('admin_ref_rewards_public', adminMiddleware, (ctx) => handleAdminRefRewardsPublic(ctx));
  bot.action(/^admin_ref_edit_public_(\d)$/, adminMiddleware, (ctx) => handleAdminRefEditPublicReward(ctx, parseInt(ctx.match[1]), adminInputState));
  bot.action('admin_ref_reward_cofounder', adminMiddleware, (ctx) => handleAdminRefRewardCoFounder(ctx, adminInputState));
  bot.action('admin_ref_manage_cofounder', adminMiddleware, (ctx) => handleAdminManageCoFounder(ctx));
  bot.action('admin_ref_add_cofounder', adminMiddleware, (ctx) => handleAdminAddCoFounder(ctx, adminInputState));
  bot.action('admin_ref_remove_cofounder', adminMiddleware, (ctx) => handleAdminRemoveCoFounder(ctx));
  bot.action(/^admin_ref_remove_confirm_(\d+)$/, adminMiddleware, async (ctx) => {
    const userId = parseInt(ctx.match[1], 10);
    await Database.setUserCoFounderStatus(userId, false);
    await ctx.answerCbQuery(`✅ User ${userId} dihapus dari co-founder.`);
    await handleAdminManageCoFounder(ctx);
  });

  // Watch Ad Settings
  bot.action('admin_ad_settings', adminMiddleware, (ctx) => handleAdminAdSettings(ctx));
  bot.action('admin_ad_set_limit', adminMiddleware, (ctx) => handleAdminAdSetLimit(ctx, adminInputState));
  bot.action('admin_ad_toggle_feature', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const key = 'feature_watch_ad_enabled';
    const current = configService.get(key, '0');
    const newValue = current === '1' ? '0' : '1';
    await configService.set(key, newValue);
    await ctx.answerCbQuery(`Fitur tonton iklan ${newValue === '1' ? 'diaktifkan' : 'dinonaktifkan'}.`);
    await handleAdminAdSettings(ctx); // Refresh menu
  });

  bot.action('back_to_admin', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery('👑 Kembali ke Admin Panel...');
    await showAdminMenu(ctx);
  });

  bot.on('text', async (ctx, next) => {
    const userId = ctx.from.id;
    if (!isAdmin(userId)) return next();
    if (!adminInputState.has(userId)) {
        const handled = await handleAdminBroadcastText(ctx);
        return handled ? null : next();
    };

    const text = ctx.message.text.trim();
    if (text === '/cancel') {
      adminInputState.delete(userId);
      return ctx.reply('❌ Dibatalkan.');
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
      } else if (state.action === 'set_rank_limit') {
        const val = parseInt(text, 10);
        if (isNaN(val) || val < 1 || val > 100) return ctx.reply('❌ Masukkan angka antara 1 sampai 100.');
        const ranks = await Database.getAllRankLimits();
        const rankData = ranks.find(r => r.rank === state.rank);
        await Database.updateRankLimit(state.rank, state.actionType, val, rankData.is_active);
        adminInputState.delete(userId);
        await ctx.reply(`✅ *Limit diperbarui*`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: `admin_rank_edit_${state.rank}` }]] } });
      } else if (state.action === 'set_rank_price') {
        const priceCoins = parseInt(text, 10);
        if (isNaN(priceCoins) || priceCoins < 0) return ctx.reply('❌ Masukkan angka koin yang valid.');
        const priceIdr = priceCoins * 1000;
        await Database.updateRankPrices(state.rank, priceCoins, priceIdr);
        adminInputState.delete(userId);
        await ctx.reply(`✅ *Harga rank diperbarui*`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'admin_rank_prices' }]] } });
      } else if (state.action === 'set_ref_reward_public') {
        const amount = parseFloat(text);
        if (isNaN(amount) || amount < 0) return ctx.reply('❌ Masukkan angka koin yang valid.');
        await Database.updateReferralReward(state.level, amount);
        adminInputState.delete(userId);
        await ctx.reply(`✅ *Reward referral diperbarui.*`, { parse_mode: 'Markdown' });
        await handleAdminRefRewardsPublic(ctx);
      } else if (state.action === 'set_ref_reward_cofounder') {
        const amount = parseFloat(text);
        if (isNaN(amount) || amount < 0) return ctx.reply('❌ Masukkan angka koin yang valid.');
        await Database.setConfig('referral_cofounder_reward', amount.toString());
        adminInputState.delete(userId);
        await ctx.reply(`✅ *Reward co-founder diperbarui.*`, { parse_mode: 'Markdown' });
        await handleAdminReferralSettings(ctx);
      } else if (state.action === 'add_cofounder') {
          const targetId = parseInt(text, 10);
          if (isNaN(targetId)) return ctx.reply('❌ ID tidak valid.');
          const user = await Database.getUserById(targetId);
          if (!user) return ctx.reply('❌ User tidak ditemukan.');
          await Database.setUserCoFounderStatus(targetId, true);
          adminInputState.delete(userId);
          await ctx.reply(`✅ User \`${targetId}\` telah dijadikan co-founder.`);
          await handleAdminManageCoFounder(ctx);
      } else if (state.action === 'set_ad_limit') {
        const val = parseInt(text, 10);
        if (isNaN(val) || val < 0 || val > 100) return ctx.reply('❌ Masukkan angka antara 0 sampai 100.');
        await Database.setConfig('ads_watch_daily_limit', val.toString());
        adminInputState.delete(userId);
        await ctx.reply(`✅ *Batas harian tonton iklan diperbarui: ${val} kali*`, { parse_mode: 'Markdown' });
        await handleAdminAdSettings(ctx);
      }
      // ... sisa text handler
    } catch (error) {
      console.error('❌ Error saving config:', error);
      adminInputState.delete(userId);
      await ctx.reply('❌ Gagal menyimpan konfigurasi. Silakan coba lagi.');
    }
  });

  return {
    showAdminMenu,
    adminMiddleware,
    isAdmin,
  };
}
