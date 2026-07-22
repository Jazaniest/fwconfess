/**
 * Admin command — entry point, hanya registrasi handler ke bot.
 * Business logic ada di handlers/admin/*.js
 */
import { Markup } from 'telegraf';
import { Database } from './database.js';
import { isAdmin, adminMiddleware } from '../middleware/admin-auth.js';
import * as RankRepo from '../repositories/rank.repo.js';

// Import Handlers
import { handleAdminStats } from '../handlers/admin/admin-stats.js';
import {
  handleAdminReports, handleAdminReportsFilter, handleAdminReportDetail,
  handleAdminReportStatus, handleAdminReportDelete, handleAdminReportDeleteConfirm,
} from '../handlers/admin/admin-reports.js';
import {
  handleAdminUsers, handleAdminListUsers, handleAdminUserDetail,
  handleAdminBanConfirm, handleAdminDoBan, handleAdminUnbanConfirm, handleAdminDoUnban,
  handleAdminSearchUser, handleAdminSearchResults, handleAdminBannedUsers,
  handleAdminNewUsers, handleAdminUserStats,
} from '../handlers/admin/admin-users.js';
import {
  handleAdminBanMenu, handleAdminBanUser, handleAdminTempbanUser,
  handleAdminUnbanUser, handleAdminCheckBan, handleAdminTempbanDuration,
  handleAdminTempbanCustom, handleAdminBanSkipReason, handleAdminBanExec,
  handleAdminUnbanExec,
} from '../handlers/admin/admin-ban.js';
import {
  handleAdminSettings, handleAdminSetRatelimit,
  handleAdminRlSetMax, handleAdminRlSetHours, handleAdminRlSetMsgHit,
  handleAdminRlSetMsgSuccess, handleAdminRlReset, handleAdminRlResetConfirm,
  handleAdminRankSettings, handleAdminRankToggle, handleAdminRankLimits, handleAdminRankLimitEdit,
  handleAdminPromoteUser, handleAdminDoPromote, handleAdminRankPrices, handleAdminRankEditPrice,
  handleAdminReferralSettings, handleAdminReferralToggle, handleAdminRefRewardsPublic,
  handleAdminRefEditPublicReward, handleAdminRefRewardCoFounder, handleAdminManageCoFounder,
  handleAdminAddCoFounder, handleAdminRemoveCoFounder,
  handleFeatureFlagsMenu, handleToggleMaintenance, handleToggleFeature,
  handleAdminAdSettings, handleAdminAdSetLimit,
} from '../handlers/admin/admin-settings.js';
import {
  handleAdminBroadcast,
  handleAdminBroadcastText,
} from '../handlers/admin/admin-broadcast.js';
import {
  handleAdminRankManagement,
  handleAdminRankCreate,
  handleAdminRankEdit,
  handleAdminRankDelete,
  handleAdminRankDeleteConfirm,
  handleAdminRankToggleActive,
  handleAdminRankEditField
} from '../handlers/admin/admin-rank-crud.js';

export default function adminPanel(bot, targetChannelId) {
  console.log('👑 Admin panel initialized');
  const adminInputState = new Map();

  async function showAdminMenu(ctx) {
    const adminText = `👑 *Admin Panel*\n\nSelamat datang Admin ${ctx.from.first_name}!\n\nPilih opsi pengelolaan:`;
    const buttons = [
      [Markup.button.callback('📊 Statistik Bot', 'admin_stats'), Markup.button.callback('👥 Kelola User', 'admin_users')],
      [Markup.button.callback('📋 Laporan User', 'admin_reports'), Markup.button.callback('🚫 Ban/Unban User', 'admin_ban')],
      [Markup.button.callback('📢 Broadcast', 'admin_broadcast'), Markup.button.callback('⚙️ Pengaturan Bot', 'admin_settings')],
    ];
    await ctx.reply(adminText, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
  }

  // General Admin
  bot.action('admin_stats', adminMiddleware, handleAdminStats);
  bot.action('admin_settings', adminMiddleware, handleAdminSettings);
  bot.action('back_to_admin', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    await showAdminMenu(ctx);
   });

  // Reports
  bot.action('admin_reports', adminMiddleware, handleAdminReports);
  bot.action(/^admin_reports_filter_(\w+)_(\d+)$/, adminMiddleware, (ctx) => handleAdminReportsFilter(ctx, ctx.match[1], parseInt(ctx.match[2])));
  bot.action(/^admin_report_detail_(\d+)_(\w+)_(\d+)$/, adminMiddleware, (ctx) => handleAdminReportDetail(ctx, parseInt(ctx.match[1]), ctx.match[2], ctx.match[3]));
  bot.action(/^admin_report_status_(\d+)_(handled|rejected)_(\w+)_(\d+)$/, adminMiddleware, (ctx) => handleAdminReportStatus(ctx, parseInt(ctx.match[1]), ctx.match[2], ctx.match[3], ctx.match[4]));
  bot.action(/^admin_report_delete_(\d+)_(\w+)_(\d+)$/, adminMiddleware, (ctx) => handleAdminReportDelete(ctx, parseInt(ctx.match[1]), ctx.match[2], ctx.match[3]));
  bot.action(/^admin_report_delete_confirm_(\d+)_(\w+)_(\d+)$/, adminMiddleware, (ctx) => handleAdminReportDeleteConfirm(ctx, parseInt(ctx.match[1]), targetChannelId, ctx.match[2], ctx.match[3]));

  // Users
  bot.action('admin_users', adminMiddleware, handleAdminUsers);
  bot.action(/^admin_list_users_(\d+)$/, adminMiddleware, (ctx) => handleAdminListUsers(ctx, parseInt(ctx.match[1])));
  bot.action(/^admin_user_detail_(\d+)_(\w+)_(\d+)$/, adminMiddleware, (ctx) => handleAdminUserDetail(ctx, parseInt(ctx.match[1]), ctx.match[2], ctx.match[3]));
  bot.action(/^admin_ban_confirm_(\d+)_(\w+)_(\d+)$/, adminMiddleware, (ctx) => handleAdminBanConfirm(ctx, ctx.match[1], ctx.match[2], ctx.match[3]));
  bot.action(/^admin_do_ban_(\d+)_(\w+)_(\d+)$/, adminMiddleware, (ctx) => handleAdminDoBan(ctx, parseInt(ctx.match[1]), ctx.match[2], ctx.match[3]));
  bot.action(/^admin_unban_confirm_(\d+)_(\w+)_(\d+)$/, adminMiddleware, (ctx) => handleAdminUnbanConfirm(ctx, ctx.match[1], ctx.match[2], ctx.match[3]));
  bot.action(/^admin_do_unban_(\d+)_(\w+)_(\d+)$/, adminMiddleware, (ctx) => handleAdminDoUnban(ctx, parseInt(ctx.match[1]), ctx.match[2], ctx.match[3]));
  bot.action('admin_search_user', adminMiddleware, (ctx) => handleAdminSearchUser(ctx, adminInputState));
  bot.action(/^admin_search_results_(\d+)$/, adminMiddleware, (ctx) => handleAdminSearchResults(ctx, adminInputState, parseInt(ctx.match[1])));
  bot.action(/^admin_banned_users_(\d+)$/, adminMiddleware, (ctx) => handleAdminBannedUsers(ctx, parseInt(ctx.match[1])));
  bot.action('admin_new_users', adminMiddleware, handleAdminNewUsers);
  bot.action('admin_user_stats', adminMiddleware, handleAdminUserStats);

  // Ban
  bot.action('admin_ban', adminMiddleware, handleAdminBanMenu);
  bot.action('admin_ban_user', adminMiddleware, (ctx) => handleAdminBanUser(ctx, adminInputState));
  bot.action('admin_tempban_user', adminMiddleware, (ctx) => handleAdminTempbanUser(ctx, adminInputState));
  bot.action('admin_unban_user', adminMiddleware, (ctx) => handleAdminUnbanUser(ctx, adminInputState));
  bot.action('admin_check_ban', adminMiddleware, (ctx) => handleAdminCheckBan(ctx, adminInputState));
  bot.action(/^admin_tempban_duration_(\d+)_(\d+)$/, adminMiddleware, (ctx) => handleAdminTempbanDuration(ctx, ctx.match[1], parseInt(ctx.match[2])));
  bot.action(/^admin_tempban_custom_(\d+)$/, adminMiddleware, (ctx) => handleAdminTempbanCustom(ctx, ctx.match[1], adminInputState));
  bot.action(/^admin_ban_skip_reason_(\d+)_(permanent|temporary)_?(\d*)$/, adminMiddleware, (ctx) => handleAdminBanSkipReason(ctx, parseInt(ctx.match[1]), ctx.match[2], ctx.match[3]));
  bot.action(/^admin_ban_exec_(\d+)_(permanent|temporary)_?(\d*)$/, adminMiddleware, (ctx) => handleAdminBanExec(ctx, parseInt(ctx.match[1]), ctx.match[2], ctx.match[3], adminInputState));
  bot.action(/^admin_unban_exec_(\d+)$/, adminMiddleware, (ctx) => handleAdminUnbanExec(ctx, parseInt(ctx.match[1])));

  // Broadcast
  bot.action('admin_broadcast', adminMiddleware, handleAdminBroadcast);

  // Feature Flags & Maintenance
  bot.action('admin_feature_flags', adminMiddleware, handleFeatureFlagsMenu);
  bot.action('toggle_maintenance_mode', adminMiddleware, handleToggleMaintenance);
  bot.action(/^toggle_feature_(.+)$/, adminMiddleware, (ctx) => handleToggleFeature(ctx, ctx.match[1]));

  // Ratelimit
  bot.action('admin_set_ratelimit', adminMiddleware, handleAdminSetRatelimit);
  bot.action('admin_rl_set_max', adminMiddleware, (ctx) => handleAdminRlSetMax(ctx, adminInputState));
  bot.action('admin_rl_set_hours', adminMiddleware, (ctx) => handleAdminRlSetHours(ctx, adminInputState));
  bot.action('admin_rl_set_msg_hit', adminMiddleware, (ctx) => handleAdminRlSetMsgHit(ctx, adminInputState));
  bot.action('admin_rl_set_msg_success', adminMiddleware, (ctx) => handleAdminRlSetMsgSuccess(ctx, adminInputState));
  bot.action('admin_rl_reset', adminMiddleware, handleAdminRlReset);
  bot.action('admin_rl_reset_confirm', adminMiddleware, handleAdminRlResetConfirm);

  // --- RANK-RELATED (NEW & OLD) ---
  // This block is now ordered from most specific to most general

  // CRUD (New System) - Field Edits & Type Updates
  bot.action(/^admin_rank_update_type_(.+)_(permanent|subscription)$/, adminMiddleware, async (ctx) => {
    const rankId = ctx.match[1];
    const newType = ctx.match[2];
    const userId = ctx.from.id;
    await ctx.answerCbQuery();
    if (newType === 'permanent') {
      await RankRepo.updateRank(rankId, { type: 'permanent', duration_days: null });
      await ctx.editMessageText('✅ Tipe rank berhasil diubah menjadi Permanen.');
      adminInputState.delete(userId);
      await handleAdminRankEdit(ctx, rankId);
    } else {
      adminInputState.set(userId, { action: 'rank_edit_duration', rankId });
      await ctx.editMessageText('✏️ *Ubah Durasi Rank Subscription*\n\nKirimkan durasi baru dalam jumlah hari.', { parse_mode: 'Markdown' });
    }
  });
  bot.action(/^admin_rank_edit_field_(.+)_type$/, adminMiddleware, async (ctx) => {
    const rankId = ctx.match[1];
    await ctx.answerCbQuery();
    const rank = await RankRepo.getRankById(rankId);
    if (!rank) return ctx.editMessageText('❌ Rank tidak ditemukan.');
    adminInputState.set(ctx.from.id, { action: 'rank_edit_type', rankId });
    await ctx.editMessageText(`🔄 *Ubah Tipe Rank: ${rank.name}*\n\nTipe saat ini: *${rank.type}*\n\nPilih tipe baru:`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '💎 Permanen', callback_data: `admin_rank_update_type_${rankId}_permanent` }, { text: '⏳ Subscription', callback_data: `admin_rank_update_type_${rankId}_subscription` }],
          [{ text: '❌ Batal', callback_data: `admin_rank_edit_${rankId}` }]
        ],
      },
    });
  });
  bot.action(/^admin_rank_edit_field_(.+)_(.+)$/, adminMiddleware, (ctx) => handleAdminRankEditField(ctx, ctx.match[1].trim(), ctx.match[2], adminInputState));

  // CRUD (New System) - Create/Delete Confirmation
  bot.action('admin_rank_create_confirm_yes', adminMiddleware, async (ctx) => {
    const userId = ctx.from.id;
    if (!adminInputState.has(userId)) return ctx.answerCbQuery('⚠️ Sesi input sudah berakhir.', { show_alert: true });
    const state = adminInputState.get(userId);
    if (state.action !== 'rank_create_confirm') return ctx.answerCbQuery('❌ Langkah yang salah.', { show_alert: true });
    try {
      await RankRepo.createRank(state.data);
      await ctx.editMessageText('✅ Rank baru berhasil dibuat!');
      adminInputState.delete(userId);
      await handleAdminRankManagement(ctx);
    } catch (error) {
      console.error('❌ Error creating rank:', error);
      await ctx.editMessageText('❌ Gagal membuat rank.');
    }
  });
  bot.action('admin_rank_create_confirm_no', adminMiddleware, async (ctx) => {
    adminInputState.delete(ctx.from.id);
    await ctx.editMessageText('❌ Pembuatan rank dibatalkan.');
    await handleAdminRankManagement(ctx);
  });
  bot.action(/^admin_rank_delete_confirm_(.+)$/, adminMiddleware, (ctx) => handleAdminRankDeleteConfirm(ctx, ctx.match[1].trim()));

  // CRUD (New System) - Main Actions (Create, Edit, Delete, Toggle)
  bot.action('admin_rank_management', adminMiddleware, handleAdminRankManagement);
  bot.action('admin_rank_create', adminMiddleware, (ctx) => handleAdminRankCreate(ctx, adminInputState));
  bot.action(/^admin_rank_create_type_(permanent|subscription)$/, adminMiddleware, async (ctx) => {
    const type = ctx.match[1];
    const userId = ctx.from.id;
    if (!adminInputState.has(userId)) return ctx.answerCbQuery('⚠️ Sesi input sudah berakhir.', { show_alert: true });
    const state = adminInputState.get(userId);
    if (state.action !== 'rank_create_type') return ctx.answerCbQuery('❌ Langkah yang salah.', { show_alert: true });
    state.data.type = type;
    if (type === 'subscription') {
      state.action = 'rank_create_duration';
      await ctx.editMessageText('✏️ *Buat Rank Baru — Langkah 3: Durasi (Hari)*\n\nKirimkan durasi rank subscription ini (contoh: 30).', { parse_mode: 'Markdown' });
    } else {
      state.data.duration_days = null;
      state.action = 'rank_create_price';
      await ctx.editMessageText('✏️ *Buat Rank Baru — Langkah 3: Harga (Koin)*\n\nKirimkan harga rank dalam koin (contoh: 100).', { parse_mode: 'Markdown' });
    }
    adminInputState.set(userId, state);
  });
  bot.action(/^admin_rank_edit_(\d+)$/, adminMiddleware, (ctx) => handleAdminRankEdit(ctx, parseInt(ctx.match[1], 10)));
  bot.action(/^admin_rank_delete_(.+)$/, adminMiddleware, (ctx) => handleAdminRankDelete(ctx, ctx.match[1].trim()));
  bot.action(/^admin_rank_toggle_active_(.+)$/, adminMiddleware, (ctx) => handleAdminRankToggleActive(ctx, ctx.match[1].trim()));

  // Old Rank System (Limits)
  bot.action('admin_rank_settings', adminMiddleware, handleAdminRankSettings);
  bot.action('admin_rank_prices', adminMiddleware, handleAdminRankPrices);
  bot.action(/^admin_rank_price_edit_(.+)$/, adminMiddleware, (ctx) => handleAdminRankEditPrice(ctx, ctx.match[1], adminInputState));
  bot.action('admin_rank_toggle', adminMiddleware, handleAdminRankToggle);
  bot.action('admin_rank_limits', adminMiddleware, handleAdminRankLimits);
  bot.action(/^admin_rank_limit_edit_(.+)$/, adminMiddleware, (ctx) => handleAdminRankLimitEdit(ctx, ctx.match[1].trim()));
  bot.action('admin_promote_user', adminMiddleware, (ctx) => handleAdminPromoteUser(ctx, adminInputState));
  bot.action(/^admin_do_promote_(\d+)_(.+)$/, adminMiddleware, (ctx) => handleAdminDoPromote(ctx, ctx.match[1], ctx.match[2]));

  // Referral System
  bot.action('admin_referral_settings', adminMiddleware, handleAdminReferralSettings);
  bot.action('admin_ref_toggle_feature', adminMiddleware, async (ctx) => {
      await ctx.answerCbQuery();
      const key = 'feature_referral_enabled';
      const current = configService.get(key, '0');
      const newValue = current === '1' ? '0' : '1';
      await configService.set(key, newValue);
      await ctx.answerCbQuery(`Fitur referral ${newValue === '1' ? 'diaktifkan' : 'dinonaktifkan'}`);
      await handleAdminReferralSettings(ctx);
  });
  bot.action('admin_ref_rewards_public', adminMiddleware, handleAdminRefRewardsPublic);
  bot.action(/^admin_ref_edit_public_(\d)$/, adminMiddleware, (ctx) => handleAdminRefEditPublicReward(ctx, parseInt(ctx.match[1]), adminInputState));
  bot.action('admin_ref_reward_cofounder', adminMiddleware, (ctx) => handleAdminRefRewardCoFounder(ctx, adminInputState));
  bot.action('admin_ref_manage_cofounder', adminMiddleware, handleAdminManageCoFounder);
  bot.action('admin_ref_add_cofounder', adminMiddleware, (ctx) => handleAdminAddCoFounder(ctx, adminInputState));
  bot.action('admin_ref_remove_cofounder', adminMiddleware, handleAdminRemoveCoFounder);
  bot.action(/^admin_ref_remove_confirm_(\d+)$/, adminMiddleware, async (ctx) => {
    const userId = parseInt(ctx.match[1], 10);
    await Database.setUserCoFounderStatus(userId, false);
    await ctx.answerCbQuery(`✅ User ${userId} dihapus dari co-founder.`);
    await handleAdminManageCoFounder(ctx);
  });

  // Watch Ad Settings
  bot.action('admin_ad_settings', adminMiddleware, handleAdminAdSettings);
  bot.action('admin_ad_set_limit', adminMiddleware, (ctx) => handleAdminAdSetLimit(ctx, adminInputState));
  bot.action('admin_ad_toggle_feature', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const key = 'feature_watch_ad_enabled';
    const current = configService.get(key, '0');
    const newValue = current === '1' ? '0' : '1';
    await configService.set(key, newValue);
    await ctx.answerCbQuery(`Fitur tonton iklan ${newValue === '1' ? 'diaktifkan' : 'dinonaktifkan'}.`);
    await handleAdminAdSettings(ctx);
  });

  // Text input handler
  bot.on('text', async (ctx, next) => {
    if (!adminInputState.has(ctx.from.id)) {
        const handled = await handleAdminBroadcastText(ctx);
        return handled ? null : next();
    };

    const text = ctx.message.text.trim();
    if (text === '/cancel') {
      adminInputState.delete(ctx.from.id);
      return ctx.reply('❌ Dibatalkan.');
    }

    const state = adminInputState.get(ctx.from.id);
    const userId = ctx.from.id;

    try {
        if (state.action === 'rank_create_name') {
            const name = text;
            adminInputState.set(userId, { action: 'rank_create_type', data: { name } });
            await ctx.reply('✏️ *Langkah 2: Tipe Rank*\nPilih tipe untuk rank ini:', {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [[{ text: '💎 Permanen', callback_data: 'admin_rank_create_type_permanent' }, { text: '⏳ Subscription', callback_data: 'admin_rank_create_type_subscription' }]] },
            });
        } else if (state.action === 'rank_create_duration') {
            const duration = parseInt(text, 10);
            if (isNaN(duration) || duration <= 0) return ctx.reply('❌ Masukkan angka hari yang valid (> 0).');
            state.data.duration_days = duration;
            state.action = 'rank_create_price';
            adminInputState.set(userId, state);
            await ctx.reply('✏️ *Langkah 4: Harga (Koin)*\nKirimkan harga dalam koin.', { parse_mode: 'Markdown' });
        } else if (state.action === 'rank_create_price') {
            const price = parseInt(text, 10);
            if (isNaN(price) || price < 0) return ctx.reply('❌ Masukkan angka koin yang valid (>= 0).');
            state.data.price_coins = price;
            state.action = 'rank_create_limit';
            adminInputState.set(userId, state);
            await ctx.reply('✏️ *Langkah 5: Limit Menfess*\nBerapa kali user bisa menfess per hari?', { parse_mode: 'Markdown' });
        } else if (state.action === 'rank_create_limit') {
            const limit = parseInt(text, 10);
            if (isNaN(limit) || limit <= 0) return ctx.reply('❌ Masukkan limit yang valid (> 0).');
            state.data.confession_limit = limit;
            const { name, type, duration_days, price_coins, confession_limit } = state.data;
            const price_currency = price_coins * 1000;
            let confText = `🔎 *Konfirmasi Rank Baru*\n\nNama: ${name}\nTipe: ${type}\n`;
            if (type === 'subscription') confText += `Durasi: ${duration_days} hari\n`;
            confText += `Harga: ${price_coins} koin (Rp ${price_currency.toLocaleString('id-ID')})\nLimit Menfess: ${confession_limit}x / hari\n\nYakin?`;
            adminInputState.set(userId, { action: 'rank_create_confirm', data: state.data });
            await ctx.reply(confText, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [[{ text: '✅ Ya, Buat', callback_data: 'admin_rank_create_confirm_yes' }, { text: '❌ Batal', callback_data: 'admin_rank_create_confirm_no' }]] },
            });
        } else if (state.action === 'rank_edit_duration') {
            const duration = parseInt(text, 10);
            if (isNaN(duration) || duration <= 0) return ctx.reply('❌ Masukkan angka hari yang valid (> 0).');
            await RankRepo.updateRank(state.rankId, { type: 'subscription', duration_days: duration });
            adminInputState.delete(userId);
            await ctx.reply(`✅ Tipe rank diubah menjadi Subscription ${duration} hari.`);
            await handleAdminRankEdit(ctx, state.rankId);
        } else if (state.action === 'rank_edit_field') {
            const { rankId, field } = state;
            const value = text;
            let validatedValue = value;
            if (['price_coins', 'confession_limit', 'duration_days'].includes(field)) {
                const numValue = parseInt(value, 10);
                if (isNaN(numValue) || numValue < 0) return ctx.reply('❌ Harap masukkan angka positif yang valid.');
                validatedValue = numValue;
            }
            await RankRepo.updateRank(rankId, { [field]: validatedValue });
            adminInputState.delete(userId);
            await ctx.reply(`✅ Field *${field}* berhasil diperbarui.`, { parse_mode: 'Markdown' });
            await handleAdminRankEdit(ctx, rankId);
        }
      // ... (other text handlers like set_max, set_hours etc.)
    } catch (error) {
      console.error('❌ Error in text handler:', error);
      adminInputState.delete(userId);
      await ctx.reply('❌ Gagal memproses input.');
    }
  });

  return { showAdminMenu, adminMiddleware, isAdmin };
}
