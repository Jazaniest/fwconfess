
import * as RankRepo from '../../repositories/rank.repo.js';

/**
 * Handles the admin rank management view.
 *
 * @param {import('telegraf').Context} ctx - The Telegraf context.
 */
export const handleAdminRankManagement = async (ctx) => {
  const ranks = await RankRepo.getActiveRanks();

  let message = ' Manajemen Rank\n\n';
  const inline_keyboard = [];

  ranks.forEach(rank => {
    message += `ID: ${rank.id}\n`;
    message += `Name: ${rank.name}\n`;
    message += `Type: ${rank.type}\n`;
    message += `Duration: ${rank.duration} days\n`;
    message += `Price: ${rank.price}\n`;
    message += `Active: ${rank.is_active ? 'Yes' : 'No'}\n\n`;

    inline_keyboard.push([
      { text: `Edit ${rank.name}`, callback_data: `admin_rank_edit_${rank.id}` },
      { text: `Delete ${rank.name}`, callback_data: `admin_rank_delete_${rank.id}` }
    ]);
  });

  // Add Create and Back buttons
  inline_keyboard.unshift([{ text: 'Buat Rank Baru', callback_data: 'admin_rank_create' }]);
  inline_keyboard.push([{ text: 'Kembali', callback_data: 'admin_settings' }]);

  await ctx.editMessageText(message, {
    reply_markup: {
      inline_keyboard
    }
  });
};

/**
 * Handles the creation of a new rank.
 *
 * @param {import('telegraf').Context} ctx - The Telegraf context.
 * @param {object} adminInputState - The state for admin input.
 */
export const handleAdminRankCreate = async (ctx, adminInputState) => {
  await ctx.answerCbQuery();
  adminInputState.set(ctx.from.id, { action: 'rank_create_name' });
  await ctx.editMessageText(
    '✏️ *Buat Rank Baru — Langkah 1: Nama Rank*\n\n' +
    'Kirimkan nama untuk rank baru (contoh: "Gold", "VIP").\n\n' +
    '_Ketik /cancel untuk membatalkan._',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '❌ Batal', callback_data: 'admin_rank_management' }]],
      },
    }
  );
};

/**
 * Handles the editing of an existing rank.
 *
 * @param {import('telegraf').Context} ctx - The Telegraf context.
 * @param {string} rankId - The ID of the rank to edit.
 */
export const handleAdminRankEdit = async (ctx, rankId) => {
    await ctx.answerCbQuery();
    const rank = await RankRepo.getRankById(rankId);
    if (!rank) {
        return ctx.editMessageText('❌ Rank tidak ditemukan.');
    }

    let text = `✏️ *Edit Rank: ${rank.name}*\n\n`;
    text += `*ID:* \`${rank.id}\`\n`;
    text += `*Tipe:* ${rank.type}\n`;
    text += `*Durasi:* ${rank.type === 'subscription' ? `${rank.duration_days} hari` : 'Permanen'}\n`;
    text += `*Harga Koin:* ${rank.price_coins} 🪙\n`;
    text += `*Harga Rupiah:* Rp ${rank.price_currency.toLocaleString('id-ID')}\n`;
    text += `*Limit Menfess:* ${rank.confession_limit}x\n`;
    text += `*Status:* ${rank.is_active ? '✅ Aktif' : '❌ Nonaktif'}\n\n`;
    text += `Pilih field yang ingin diubah:`;

    const buttons = [
        [{ text: '✏️ Ubah Nama', callback_data: `admin_rank_edit_field_${rankId}_name` }],
        [{ text: '🔄 Ubah Tipe & Durasi', callback_data: `admin_rank_edit_field_${rankId}_type` }],
        [{ text: '✏️ Ubah Harga (Koin)', callback_data: `admin_rank_edit_field_${rankId}_price_coins` }],
        [{ text: '✏️ Ubah Limit Menfess', callback_data: `admin_rank_edit_field_${rankId}_confession_limit` }],
        // Add more edit buttons for other fields as needed, e.g., duration, limit
        [{ text: rank.is_active ? '🔴 Nonaktifkan' : '🟢 Aktifkan', callback_data: `admin_rank_toggle_active_${rankId}` }],
        [{ text: '🔙 Kembali ke Daftar Rank', callback_data: 'admin_rank_management' }]
    ];

    await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
    });
};

/**
 * Handles the deletion of a rank.
 *
 * @param {import('telegraf').Context} ctx - The Telegraf context.
 * @param {string} rankId - The ID of the rank to delete.
 */
export const handleAdminRankDelete = async (ctx, rankId) => {
    await ctx.answerCbQuery();
    const rank = await RankRepo.getRankById(rankId);
    if (!rank) {
        return ctx.editMessageText('❌ Rank tidak ditemukan.');
    }

    const text = `🗑️ *Hapus Rank?*\n\nAnda yakin ingin menghapus rank *${rank.name}* (ID: ${rank.id})?\n\n⚠️ Peringatan: Aksi ini tidak dapat dibatalkan!`;
    const buttons = [
        [{ text: `✅ Ya, Hapus ${rank.name}`, callback_data: `admin_rank_delete_confirm_${rankId}` }],
        [{ text: '❌ Batal', callback_data: 'admin_rank_management' }]
    ];

    await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
    });
};

/**
 * Handles the confirmation of a rank deletion.
 *
 * @param {import('telegraf').Context} ctx - The Telegraf context.
 * @param {string} rankId - The ID of the rank to delete.
 */
export const handleAdminRankDeleteConfirm = async (ctx, rankId) => {
    await ctx.answerCbQuery('Menghapus...');
    try {
        await RankRepo.deleteRank(rankId);
        await ctx.answerCbQuery('✅ Rank berhasil dihapus!');
        // Refresh the list
        await handleAdminRankManagement(ctx);
    } catch (error) {
        console.error(`❌ Gagal menghapus rank ${rankId}:`, error);
        await ctx.editMessageText('❌ Terjadi kesalahan saat menghapus rank. Mungkin rank ini masih digunakan oleh user.');
    }
};

/**
 * Handles toggling the active status of a rank.
 *
 * @param {import('telegraf').Context} ctx - The Telegraf context.
 * @param {string} rankId - The ID of the rank to toggle.
 */
export const handleAdminRankToggleActive = async (ctx, rankId) => {
    await ctx.answerCbQuery('Memperbarui...');
    const rank = await RankRepo.getRankById(rankId);
    if (!rank) {
        return ctx.editMessageText('❌ Rank tidak ditemukan.');
    }
    try {
        const newStatus = !rank.is_active;
        await RankRepo.updateRank(rankId, { is_active: newStatus });
        await ctx.answerCbQuery(`✅ Status diubah menjadi ${newStatus ? 'Aktif' : 'Nonaktif'}`);
        // Refresh the edit menu
        await handleAdminRankEdit(ctx, rankId);
    } catch (error) {
        console.error(`❌ Gagal mengubah status rank ${rankId}:`, error);
        await ctx.editMessageText('❌ Terjadi kesalahan saat mengubah status rank.');
    }
};

/**
 * Handles the request to edit a specific field of a rank.
 *
 * @param {import('telegraf').Context} ctx - The Telegraf context.
 * @param {string} rankId - The ID of the rank.
 * @param {string} field - The field to edit.
 * @param {object} adminInputState - The state for admin input.
 */
export const handleAdminRankEditField = async (ctx, rankId, field, adminInputState) => {
    await ctx.answerCbQuery();
    const rank = await RankRepo.getRankById(rankId);
    if (!rank) {
        return ctx.editMessageText('❌ Rank tidak ditemukan.');
    }

    adminInputState.set(ctx.from.id, { action: 'rank_edit_field', rankId, field });

    await ctx.editMessageText(
        `✏️ *Ubah ${field} untuk Rank ${rank.name}*\n\n` +
        `Nilai saat ini: \`${rank[field]}\`\n\n` +
        `Kirimkan nilai baru.\n\n_Ketik /cancel untuk membatalkan_`,
        {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: `admin_rank_edit_${rankId}` }]] }
        }
    );
};

