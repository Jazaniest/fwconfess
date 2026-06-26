/**
 * Profile handler — business logic untuk profile, edit, privacy.
 * Dipanggil dari commands/profile.js (registrasi handler ke bot).
 */
import { Markup } from 'telegraf';
import { Database } from '../commands/database.js';

const pendingOriginEdit = new Map();

// ─── Public API ─────────────────────────────────────────────────────────────

export { pendingOriginEdit };

/**
 * Tampilkan profile user.
 */
export async function showProfile(ctx, isEdit = false) {
  const userId = ctx.from.id;

  // Sync username dari Telegram ke DB
  await Database.updateUsername(userId, ctx.from.username);

  const userProfile = await Database.getUserFullProfile(userId);
  const totalConfessions = await Database.getTotalUserConfessions(userId);
  const privacy = await Database.getPrivacySettings(userId);

  if (!userProfile) {
    await ctx.reply(
      '❌ Profile tidak ditemukan!\n\nSeperti kamu belum terdaftar. Silakan daftar terlebih dahulu.',
      Markup.inlineKeyboard([
        [Markup.button.callback('📝 Daftar Sekarang', 'btn_register')],
        [Markup.button.callback('🏠 Kembali ke Menu', 'back_to_main')]
      ])
    );
    return;
  }

  const joinDate = userProfile.registered_at
    ? new Date(userProfile.registered_at).toLocaleDateString('id-ID', {
      year: 'numeric', month: 'long', day: 'numeric'
    })
    : 'Tidak diketahui';

  const memberStatus = userProfile.is_active === 1 ? '✅ Active' : '❌ Inactive';

  const profileText =
    `👤 *Profile Anda*\n\n` +
    `🆔 User ID: \`${userId}\`\n` +
    `👤 Username: ${ctx.from.username ? `@${ctx.from.username.replace(/_/g, '\\_')}` : '_Tidak ada_'}\n` +
    `📅 Bergabung: ${joinDate}\n` +
    `📝 Total Menfess: *${totalConfessions}*\n` +
    `🎯 Status: ${memberStatus}\n` +
    `📍 Origin: ${userProfile.origin || 'Tidak diisi'}\n` +
    `👥 Gender: ${userProfile.gender || 'Tidak diisi'}\n` +
    `🏆 Rank: ${userProfile.rank || 'Member'}\n\n` +
    `🔒 *Privacy:*\n` +
    `• Username : ${privacy.hide_username ? '🙈 Tersembunyi' : '👁 Terlihat'}\n` +
    `• Gender   : ${privacy.hide_gender ? '🙈 Tersembunyi' : '👁 Terlihat'}\n` +
    `• Origin   : ${privacy.hide_origin ? '🙈 Tersembunyi' : '👁 Terlihat'}`;

  const opts = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✏️ Edit Profile', callback_data: 'edit_profile' },
          { text: '🔒 Atur Privacy', callback_data: 'privacy_settings' }
        ],
        [
          { text: '🏆 Upgrade Rank', callback_data: 'show_rank_menu' }
        ],
        [{ text: '🏠 Menu Utama', callback_data: 'back_to_main' }]
      ]
    }
  };

  if (isEdit) {
    await ctx.editMessageText(profileText, opts);
  } else {
    await ctx.reply(profileText, opts);
  }
}

/**
 * Tampilkan menu edit profile (gender / origin).
 */
export async function showEditProfile(ctx) {
  await ctx.reply('✏️ *Edit Profile*\n\nPilih data yang ingin diubah:', {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '👥 Ubah Gender', callback_data: 'edit_gender' },
          { text: '📍 Ubah Origin', callback_data: 'edit_origin' }
        ],
        [{ text: '🔙 Kembali ke Profile', callback_data: 'btn_profile' }]
      ]
    }
  });
}

/**
 * Tampilkan pilihan gender.
 */
export async function showGenderOptions(ctx) {
  await ctx.reply('👥 *Ubah Gender*\n\nPilih gender kamu:', {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Laki-laki', callback_data: 'set_gender_male' },
          { text: 'Perempuan', callback_data: 'set_gender_female' }
        ],
        [{ text: 'Lainnya', callback_data: 'set_gender_other' }],
        [{ text: '🔙 Kembali', callback_data: 'edit_profile' }]
      ]
    }
  });
}

/**
 * Set gender user.
 */
export async function setGender(ctx, gender) {
  await Database.updateGender(ctx.from.id, gender);

  await ctx.editMessageText(
    `✅ Gender berhasil diubah ke *${gender}*.`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Kembali ke Profile', callback_data: 'btn_profile' }]
        ]
      }
    }
  );
}

/**
 * Minta input origin baru.
 */
export async function askOrigin(ctx) {
  pendingOriginEdit.set(ctx.from.id, true);

  await ctx.reply(
    '📍 *Ubah Origin*\n\nKetik asal kamu yang baru.\nKetik `-` jika ingin mengosongkan.',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ Batal', callback_data: 'cancel_edit_origin' }]
        ]
      }
    }
  );
}

/**
 * Handle input text untuk edit origin.
 * Return true jika teks diproses, false jika lanjut ke handler berikutnya.
 */
export async function handleOriginText(ctx, next) {
  const userId = ctx.from.id;

  if (!pendingOriginEdit.has(userId)) return next();

  const input = ctx.message.text.trim();
  const origin = input === '-' ? null : input;

  pendingOriginEdit.delete(userId);
  await Database.updateOrigin(userId, origin);

  await ctx.reply(
    `✅ Origin berhasil diubah ke *${origin || 'kosong'}*.`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Kembali ke Profile', callback_data: 'btn_profile' }]
        ]
      }
    }
  );
}

/**
 * Cancel edit origin.
 */
export async function cancelEditOrigin(ctx) {
  await ctx.answerCbQuery();
  pendingOriginEdit.delete(ctx.from.id);

  await ctx.editMessageText('❌ Edit origin dibatalkan.', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔙 Kembali ke Profile', callback_data: 'btn_profile' }]
      ]
    }
  });
}

/**
 * Tampilkan menu privacy settings.
 */
export async function showPrivacyMenu(ctx, privacy, isEdit) {
  const text =
    `🔒 *Pengaturan Privacy*\n\n` +
    `Pilih field yang ingin kamu sembunyikan atau tampilkan di confession.\n\n` +
    `• Username : ${privacy.hide_username ? '🙈 Tersembunyi' : '👁 Terlihat'}\n` +
    `• Gender   : ${privacy.hide_gender ? '🙈 Tersembunyi' : '👁 Terlihat'}\n` +
    `• Origin   : ${privacy.hide_origin ? '🙈 Tersembunyi' : '👁 Terlihat'}`;

  const keyboard = {
    inline_keyboard: [
      [{ text: `${privacy.hide_username ? '👁 Tampilkan' : '🙈 Sembunyikan'} Username`, callback_data: 'toggle_hide_username' }],
      [{ text: `${privacy.hide_gender ? '👁 Tampilkan' : '🙈 Sembunyikan'} Gender`, callback_data: 'toggle_hide_gender' }],
      [{ text: `${privacy.hide_origin ? '👁 Tampilkan' : '🙈 Sembunyikan'} Origin`, callback_data: 'toggle_hide_origin' }],
      [{ text: '🔙 Kembali ke Profile', callback_data: 'btn_profile' }]
    ]
  };

  const opts = { parse_mode: 'Markdown', reply_markup: keyboard };

  if (isEdit) {
    await ctx.editMessageText(text, opts);
  } else {
    await ctx.reply(text, opts);
  }
}

/**
 * Toggle privacy field.
 */
export async function togglePrivacy(ctx, field) {
  const privacy = await Database.getPrivacySettings(ctx.from.id);
  const newValue = privacy[field] ? 0 : 1;

  await Database.setPrivacyField(ctx.from.id, field, newValue);

  const updated = await Database.getPrivacySettings(ctx.from.id);
  await showPrivacyMenu(ctx, updated, true);
}
