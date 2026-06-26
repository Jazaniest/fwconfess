/**
 * Admin settings handler — business logic untuk pengaturan bot, rate limit, rank.
 */
import { Database } from '../../commands/database.js';
import { db } from '../../services/db.js';
import { configService } from '../../services/config.service.js';

export async function handleAdminSettings(ctx) {
  await ctx.editMessageText(
    '⚙️ *Pengaturan Bot*\n\nPilih pengaturan yang ingin diubah:',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⏰ Rate Limit', callback_data: 'admin_set_ratelimit' },
            { text: '🔧 Maintenance', callback_data: 'admin_maintenance' }
          ],
          [
            { text: '🏆 Pengaturan Rank', callback_data: 'admin_rank_settings' },
            { text: '💡 Toggle Fitur', callback_data: 'admin_feature_flags' }
          ],
          [
            { text: '🤝 Referral', callback_data: 'admin_referral_settings' }
          ],
          [
            { text: '🏠 Kembali', callback_data: 'back_to_admin' }
          ]
        ]
      }
    }
  );
}

// ─── Feature Flags & Maintenance ──────────────────────────────────────────

async function getFeatureFlagMenu(ctx) {
    const keys = [
        'maintenance_mode_enabled', 'feature_leaderboard_enabled',
        'feature_achievements_enabled', 'feature_superhit_enabled',
        'feature_rank_purchase_enabled', 'feature_tagging_enabled',
        'feature_referral_enabled',
    ];

    let text = '💡 *Toggle Fitur & Mode Pemeliharaan*\n\nKlik tombol untuk mengaktifkan/menonaktifkan.\n\n';
    const buttons = [];

    // Maintenance Mode
    const isMaintenance = configService.isMaintenanceMode();
    text += `🔧 Mode Pemeliharaan: *${isMaintenance ? '✅ AKTIF' : '❌ NONAKTIF'}*\n`;
    buttons.push([{ text: `${isMaintenance ? '🔴 Matikan' : '🟢 Nyalakan'} Maintenance`, callback_data: 'toggle_maintenance_mode' }]);

    // Feature Flags
    text += '\n*Fitur Individual:*\n';
    keys.filter(k => k.startsWith('feature_')).forEach(key => {
        const featureName = key.replace('feature_', '').replace('_enabled', '');
        const isEnabled = configService.get(key) === '1';
        text += `• ${featureName.replace(/_/g, ' ')}: *${isEnabled ? '✅' : '❌'}*\n`;
        buttons.push([{ text: `${isEnabled ? '🔴' : '🟢'} ${featureName}`, callback_data: `toggle_feature_${featureName}` }]);
    });

    buttons.push([{ text: '🏠 Kembali ke Pengaturan', callback_data: 'admin_settings' }]);

    return { text, buttons };
}

export async function handleFeatureFlagsMenu(ctx) {
    await ctx.answerCbQuery();
    const { text, buttons } = await getFeatureFlagMenu(ctx);
    await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
    });
}

export async function handleToggleMaintenance(ctx) {
    await ctx.answerCbQuery();
    const currentStatus = configService.isMaintenanceMode();
    await configService.set('maintenance_mode_enabled', currentStatus ? '0' : '1');
    const { text, buttons } = await getFeatureFlagMenu(ctx);
    await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
    });
}

export async function handleToggleFeature(ctx, featureName) {
    await ctx.answerCbQuery();
    const key = `feature_${featureName}_enabled`;
    const currentStatus = configService.get(key) === '1';
    await configService.set(key, currentStatus ? '0' : '1');
    const { text, buttons } = await getFeatureFlagMenu(ctx);
    await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
    });
}

// ─── Rate Limit ─────────────────────────────────────────────────────────────

export async function handleAdminSetRatelimit(ctx) {
  try {
    const cfg = await Database.getConfigs([
      'confession_max_per_window',
      'confession_window_hours',
      'ratelimit_msg_hit',
      'ratelimit_msg_success'
    ]);

    const maxCount = cfg['confession_max_per_window'] || '1';
    const windowHours = cfg['confession_window_hours'] || '8';

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
              { text: `✏️ Ubah Maks (${maxCount}x)`, callback_data: 'admin_rl_set_max' },
              { text: `✏️ Ubah Jangka (${windowHours}j)`, callback_data: 'admin_rl_set_hours' }
            ],
            [
              { text: '📝 Ubah Pesan Rate Limit', callback_data: 'admin_rl_set_msg_hit' },
              { text: '📝 Ubah Pesan Sukses', callback_data: 'admin_rl_set_msg_success' }
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
}

export async function handleAdminRlSetMax(ctx, adminInputState) {
  await ctx.answerCbQuery();
  adminInputState.set(ctx.from.id, { action: 'set_max' });
  await ctx.editMessageText(
    `✏️ *Ubah Maksimal Menfess*\n\nKirimkan angka baru untuk maksimal menfess per jangka waktu.\n\nContoh: \`3\` → user bisa kirim 3 menfess per window\n\n_Ketik /cancel untuk membatalkan_`,
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'admin_rl_cancel' }]] }
    }
  );
}

export async function handleAdminRlSetHours(ctx, adminInputState) {
  await ctx.answerCbQuery();
  adminInputState.set(ctx.from.id, { action: 'set_hours' });
  await ctx.editMessageText(
    `✏️ *Ubah Jangka Waktu Window*\n\nKirimkan angka jam baru untuk jangka waktu rate limit.\n\nContoh: \`24\` → reset setiap 24 jam\n\n_Ketik /cancel untuk membatalkan_`,
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'admin_rl_cancel' }]] }
    }
  );
}

export async function handleAdminRlSetMsgHit(ctx, adminInputState) {
  await ctx.answerCbQuery();
  adminInputState.set(ctx.from.id, { action: 'set_msg_hit' });
  await ctx.editMessageText(
    `✏️ *Ubah Pesan Rate Limit*\n\nKirimkan teks pesan baru. Placeholder: \`{count}\`, \`{hours}\`, \`{next_time}\`\n\n_Ketik /cancel untuk membatalkan_`,
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'admin_rl_cancel' }]] }
    }
  );
}

export async function handleAdminRlSetMsgSuccess(ctx, adminInputState) {
  await ctx.answerCbQuery();
  adminInputState.set(ctx.from.id, { action: 'set_msg_success' });
  await ctx.editMessageText(
    `✏️ *Ubah Pesan Sukses Menfess*\n\nKirimkan teks pesan baru.\n\n_Ketik /cancel untuk membatalkan_`,
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'admin_rl_cancel' }]] }
    }
  );
}

export async function handleAdminRlReset(ctx) {
  await ctx.editMessageText(
    `🔄 *Reset Rate Limit ke Default?*\n\nIni akan mengatur ulang ke:\n• Maksimal: *1x*\n• Jangka waktu: *8 jam*\n\nYakin?`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Ya, Reset', callback_data: 'admin_rl_reset_confirm' }, { text: '❌ Batal', callback_data: 'admin_set_ratelimit' }]
        ]
      }
    }
  );
}

export async function handleAdminRlResetConfirm(ctx) {
  await Database.setConfig('confession_max_per_window', '1');
  await Database.setConfig('confession_window_hours', '8');
  await Database.setConfig('ratelimit_msg_hit',
    '⏰ Kamu sudah menfess {count}x dalam {hours} jam terakhir.\n\nCoba lagi setelah: *{next_time}*');
  await Database.setConfig('ratelimit_msg_success',
    '🎉 *Menfess berhasil dipublish!*\n\n⏰ Kamu bisa menfess lagi dalam {hours} jam');

  await ctx.editMessageText('✅ *Rate limit berhasil direset ke default!*', {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali ke Rate Limit', callback_data: 'admin_set_ratelimit' }]] }
  });
}

// ─── Rank Settings ──────────────────────────────────────────────────────────

export async function handleAdminRankSettings(ctx) {
  const rankEnabled = await Database.getConfig('rank_system_enabled', '0');
  const isEnabled = rankEnabled === '1';

  await ctx.editMessageText(
    `🏆 *Pengaturan Sistem Rank*\n\nStatus: ${isEnabled ? '✅ Aktif' : '❌ Nonaktif'}\n\n${isEnabled ? 'Sistem rank sedang berjalan.' : 'Sistem rank dimatikan.'}`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: isEnabled ? '🔴 Nonaktifkan Rank' : '🟢 Aktifkan Rank', callback_data: 'admin_rank_toggle' }],
          [{ text: '⚙️ Atur Limit per Rank', callback_data: 'admin_rank_limits' }],
          [{ text: '💰 Ubah Harga Rank', callback_data: 'admin_rank_prices' }],
          [{ text: '👑 Promote User', callback_data: 'admin_promote_user' }],
          [{ text: '🏠 Kembali', callback_data: 'admin_settings' }]
        ]
      }
    }
  );
}

export async function handleAdminRankToggle(ctx) {
  const current = await Database.getConfig('rank_system_enabled', '0');
  const newVal = current === '1' ? '0' : '1';
  await Database.setConfig('rank_system_enabled', newVal);

  await ctx.editMessageText(
    `✅ Sistem rank berhasil *${newVal === '1' ? 'diaktifkan' : 'dinonaktifkan'}*.`,
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali ke Rank Settings', callback_data: 'admin_rank_settings' }]] }
    }
  );
}

export async function handleAdminRankLimits(ctx) {
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
}

export async function handleAdminRankEdit(ctx, rank) {
  const ranks = await Database.getAllRankLimits();
  const rankData = ranks.find(r => r.rank === rank);
  if (!rankData) return ctx.reply('❌ Rank tidak ditemukan.');

  await ctx.editMessageText(
    `✏️ *Edit Rank: ${rank}*\n\nStatus: ${rankData.is_active ? '✅ Aktif' : '❌ Nonaktif'}\n\n📊 *Limit saat ini:*\n• Confess: *${rankData.max_count}x*\n• Hit Me: *${rankData.hitme_max_count}x*\n• Show Me: *${rankData.showme_max_count}x*\n\nPilih aksi:`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: rankData.is_active ? '🔴 Nonaktifkan' : '🟢 Aktifkan', callback_data: `admin_rank_toggle_${rank}` }],
          [{ text: '✏️ Limit Confess', callback_data: `admin_rank_setlimit_${rank}_confess` }],
          [{ text: '✏️ Limit Hit Me', callback_data: `admin_rank_setlimit_${rank}_hitme` }],
          [{ text: '✏️ Limit Show Me', callback_data: `admin_rank_setlimit_${rank}_showme` }],
          [{ text: '🔙 Kembali', callback_data: 'admin_rank_settings' }]
        ]
      }
    }
  );
}

export async function handleAdminRankPrices(ctx) {
  const ranks = await Database.getAllRankLimits();
  let text = `💰 *Harga Rank*\n\n`;
  ranks.forEach(r => {
    if (r.price_coins > 0) {
      text += `*${r.rank}*: ${r.price_coins} 🪙 (Rp ${r.price_idr.toLocaleString('id-ID')})\n`;
    }
  });
  text += `\n_Pilih rank untuk mengubah harga:_`;

  const buttons = ranks
    .filter(r => r.price_coins > 0)
    .map(r => ([{
      text: `✏️ Ubah ${r.rank}`,
      callback_data: `admin_rank_price_edit_${r.rank}`
  }]));
  buttons.push([{ text: '🏠 Kembali', callback_data: 'admin_rank_settings' }]);

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: buttons }
  });
}

export async function handleAdminRankEditPrice(ctx, rank, adminInputState) {
  adminInputState.set(ctx.from.id, { action: 'set_rank_price', rank });

  await ctx.editMessageText(
    `✏️ *Ubah Harga — Rank: ${rank}*\n\nKirimkan harga baru dalam *koin*.\nContoh: \`100\`\n\n_Harga dalam Rupiah akan diatur otomatis (koin x 1000)._\n\n_Ketik /cancel untuk membatalkan_`,
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: `admin_rank_prices` }]] }
    }
  );
}

export async function handleAdminRankToggleOne(ctx, rank) {
  if (rank === 'member') return ctx.answerCbQuery('❌ Rank member tidak bisa dinonaktifkan.');
  const ranks = await Database.getAllRankLimits();
  const rankData = ranks.find(r => r.rank === rank);
  const newActive = rankData.is_active ? 0 : 1;
  await Database.updateRankLimit(rank, 'confess', rankData.max_count, newActive);

  await ctx.editMessageText(
    `✅ Rank *${rank}* berhasil *${newActive ? 'diaktifkan' : 'dinonaktifkan'}*.`,
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'admin_rank_limits' }]] }
    }
  );
}

export async function handleAdminRankSetLimit(ctx, rank, actionType, adminInputState) {
  const actionLabel = { confess: 'Confess', hitme: 'Hit Me', showme: 'Show Me' }[actionType];
  adminInputState.set(ctx.from.id, { action: 'set_rank_limit', rank, actionType });

  await ctx.editMessageText(
    `✏️ *Ubah Limit ${actionLabel} — Rank: ${rank}*\n\nKirimkan angka baru.\n\n_Ketik /cancel untuk membatalkan_`,
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: `admin_rank_edit_${rank}` }]] }
    }
  );
}

export async function handleAdminPromoteUser(ctx, adminInputState) {
  await ctx.editMessageText(
    `👑 *Promote User*\n\nKirimkan ID Telegram user yang ingin di-promote.\n\n_Ketik /cancel untuk membatalkan_`,
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'admin_rank_settings' }]] }
    }
  );
  adminInputState.set(ctx.from.id, { action: 'promote_user_step1' });
}

export async function handleAdminDoPromote(ctx, targetId, newRank) {
  await db.query('UPDATE `users` SET `rank` = ? WHERE `telegram_id` = ?', [newRank, targetId]);
  await ctx.editMessageText(
    `✅ User \`${targetId}\` berhasil di-promote ke rank *${newRank}*.`,
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'admin_rank_settings' }]] }
    }
  );
}

// ─── Referral Settings ──────────────────────────────────────────────────────

export async function handleAdminReferralSettings(ctx) {
  const isEnabled = await Database.getConfig('feature_referral_enabled', '0') === '1';

  const text = `🤝 *Pengaturan Referral*\n\nStatus saat ini: *${isEnabled ? '✅ AKTIF' : '❌ NONAKTIF'}*`;
  const buttons = [
    [{ text: isEnabled ? '🔴 Nonaktifkan Fitur' : '🟢 Aktifkan Fitur', callback_data: 'admin_ref_toggle_feature' }],
    [{ text: '💰 Ubah Reward Publik', callback_data: 'admin_ref_rewards_public' }],
    [{ text: '👑 Ubah Reward Co-founder', callback_data: 'admin_ref_reward_cofounder' }],
    [{ text: '👥 Kelola Co-founder', callback_data: 'admin_ref_manage_cofounder' }],
    [{ text: '🏠 Kembali', callback_data: 'admin_settings' }]
  ];

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: buttons }
  });
}

export async function handleAdminReferralToggle(ctx) {
  await ctx.answerCbQuery();
  const current = await Database.getConfig('feature_referral_enabled', '0');
  const newValue = current === '1' ? '0' : '1';
  await Database.setConfig('feature_referral_enabled', newValue);
  await ctx.answerCbQuery(`Fitur referral ${newValue === '1' ? 'diaktifkan' : 'dinonaktifkan'}`);
  await handleAdminReferralSettings(ctx); // Refresh menu
}

export async function handleAdminRefRewardsPublic(ctx) {
  await ctx.answerCbQuery();
  const rewards = await Database.getAllReferralRewards();
  let text = '💰 *Ubah Reward Referral Publik*\n\n';
  rewards.sort((a,b) => a.level - b.level).forEach(r => {
    text += `Level ${r.level}: *${r.reward_amount} koin*\n`;
  });
  text += '\n_Pilih level untuk diubah:_';

  const buttons = rewards.map(r => ([{
    text: `✏️ Level ${r.level} (${r.reward_amount} koin)`,
    callback_data: `admin_ref_edit_public_${r.level}`
  }]));
  buttons.push([{ text: '🔙 Kembali', callback_data: 'admin_referral_settings' }]);

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: buttons }
  });
}

export async function handleAdminRefEditPublicReward(ctx, level, adminInputState) {
  await ctx.answerCbQuery();
  adminInputState.set(ctx.from.id, { action: 'set_ref_reward_public', level });
  await ctx.editMessageText(
    `✏️ *Ubah Reward Level ${level}*\n\nKirimkan jumlah koin baru.\nContoh: \`0.5\`\n\n_Ketik /cancel untuk membatalkan_`,
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'admin_ref_rewards_public' }]] }
    }
  );
}

export async function handleAdminRefRewardCoFounder(ctx, adminInputState) {
  await ctx.answerCbQuery();
  const currentReward = await Database.getConfig('referral_cofounder_reward', '1');
  adminInputState.set(ctx.from.id, { action: 'set_ref_reward_cofounder' });
  await ctx.editMessageText(
    `👑 *Ubah Reward Co-founder*\n\nReward saat ini: *${currentReward} koin* per pendaftaran baru di bawahnya.\n\nKirimkan jumlah koin baru.\nContoh: \`1.5\`\n\n_Ketik /cancel untuk membatalkan_`,
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'admin_referral_settings' }]] }
    }
  );
}

export async function handleAdminManageCoFounder(ctx) {
    await ctx.answerCbQuery();
    const cofounders = await Database.getCoFounders();
    let text = '👥 *Kelola Co-founder*\n\nDaftar co-founder saat ini:\n';
    if (cofounders.length > 0) {
        cofounders.forEach(cf => {
            text += `• \`${cf.telegram_id}\` (${cf.username || 'tanpa username'})\n`;
        });
    } else {
        text += '_Tidak ada co-founder yang terdaftar._\n';
    }

    const buttons = [
        [{ text: '➕ Tambah Co-founder', callback_data: 'admin_ref_add_cofounder' }],
        [{ text: '➖ Hapus Co-founder', callback_data: 'admin_ref_remove_cofounder' }],
        [{ text: '🔙 Kembali', callback_data: 'admin_referral_settings' }]
    ];

    await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
    });
}

export async function handleAdminAddCoFounder(ctx, adminInputState) {
    await ctx.answerCbQuery();
    adminInputState.set(ctx.from.id, { action: 'add_cofounder' });
    await ctx.editMessageText(
        '➕ *Tambah Co-founder*\n\nKirimkan ID Telegram user yang ingin dijadikan co-founder.',
        {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'admin_ref_manage_cofounder' }]] }
        }
    );
}

export async function handleAdminRemoveCoFounder(ctx) {
    await ctx.answerCbQuery();
    const cofounders = await Database.getCoFounders();
    if (cofounders.length === 0) {
        return ctx.editMessageText(
            'ℹ️ Tidak ada co-founder untuk dihapus.',
            { reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'admin_ref_manage_cofounder' }]] } }
        );
    }
    let text = '➖ *Hapus Co-founder*\n\nPilih co-founder yang ingin dihapus statusnya:';
    const buttons = cofounders.map(cf => ([{
        text: `🗑️ ${cf.username || cf.telegram_id}`,
        callback_data: `admin_ref_remove_confirm_${cf.telegram_id}`
    }]));
    buttons.push([{ text: '🔙 Kembali', callback_data: 'admin_ref_manage_cofounder' }]);

    await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
    });
}
