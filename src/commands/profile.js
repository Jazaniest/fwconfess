import { Markup } from 'telegraf';
import { Database } from './database.js';

const pendingOriginEdit = new Map();

export default function profileCommand(bot) {

  // ─── Lihat Profile ────────────────────────────────────────────────────────

  bot.action('btn_profile', async (ctx) => {
    await ctx.answerCbQuery('📋 Memuat profile...');

    try {
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
        `👤 Username: ${ctx.from.username ? `@${ctx.from.username}` : '_Tidak ada_'}\n` +
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

      await ctx.editMessageText(profileText, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✏️ Edit Profile', callback_data: 'edit_profile' },
              { text: '🔒 Atur Privacy', callback_data: 'privacy_settings' }
            ],
            [{ text: '🏠 Menu Utama', callback_data: 'back_to_main' }]
          ]
        }
      });

    } catch (error) {
      console.error('Error showing profile:', error);
      await ctx.editMessageText(
        '❌ Error memuat profile. Silakan coba lagi.',
        Markup.inlineKeyboard([
          [{ text: '🔄 Coba Lagi', callback_data: 'btn_profile' }],
          [{ text: '🏠 Menu Utama', callback_data: 'back_to_main' }]
        ])
      );
    }
  });

  // Command /profile akses langsung
  bot.command('profile', async (ctx) => {
    // Kirim pesan dulu agar bisa di-edit (sama seperti flow dari menu)
    const msg = await ctx.reply('⏳ Memuat profile...');

    try {
      const userId = ctx.from.id;

      await Database.updateUsername(userId, ctx.from.username);

      const userProfile = await Database.getUserFullProfile(userId);
      const totalConfessions = await Database.getTotalUserConfessions(userId);
      const privacy = await Database.getPrivacySettings(userId);

      if (!userProfile) {
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null,
          '❌ Profile tidak ditemukan!\n\nSeperti kamu belum terdaftar.',
          Markup.inlineKeyboard([
            [Markup.button.callback('📝 Daftar Sekarang', 'btn_register')]
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
        `👤 Username: ${ctx.from.username ? `@${ctx.from.username}` : '_Tidak ada_'}\n` +
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

      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null,
        profileText,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✏️ Edit Profile', callback_data: 'edit_profile' },
                { text: '🔒 Atur Privacy', callback_data: 'privacy_settings' }
              ],
              [{ text: '🏠 Menu Utama', callback_data: 'back_to_main' }]
            ]
          }
        }
      );

    } catch (error) {
      console.error('Error loading profile via command:', error);
      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null,
        '❌ Terjadi kesalahan saat memuat profile.'
      );
    }
  });

  // ─── Edit Profile ─────────────────────────────────────────────────────────

  bot.action('edit_profile', async (ctx) => {
    await ctx.answerCbQuery();

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
  });

  // ─── Edit Gender ──────────────────────────────────────────────────────────

  bot.action('edit_gender', async (ctx) => {
    await ctx.answerCbQuery();

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
  });

  bot.action(/^set_gender_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const gender = ctx.match[1]; // male / female / other

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
  });

  // ─── Edit Origin ──────────────────────────────────────────────────────────

  bot.action('edit_origin', async (ctx) => {
    await ctx.answerCbQuery();
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
  });

  bot.action('cancel_edit_origin', async (ctx) => {
    await ctx.answerCbQuery();
    pendingOriginEdit.delete(ctx.from.id);

    await ctx.editMessageText('❌ Edit origin dibatalkan.', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Kembali ke Profile', callback_data: 'btn_profile' }]
        ]
      }
    });
  });

  // ─── Privacy Settings ─────────────────────────────────────────────────────

  bot.action('privacy_settings', async (ctx) => {
    await ctx.answerCbQuery();
    const privacy = await Database.getPrivacySettings(ctx.from.id);
    await showPrivacyMenu(ctx, privacy, false);
  });

  bot.action(/^toggle_hide_(username|gender|origin)$/, async (ctx) => {
    await ctx.answerCbQuery();

    const field = `hide_${ctx.match[1]}`;
    const privacy = await Database.getPrivacySettings(ctx.from.id);
    const newValue = privacy[field] ? 0 : 1;

    await Database.setPrivacyField(ctx.from.id, field, newValue);

    const updated = await Database.getPrivacySettings(ctx.from.id);
    await showPrivacyMenu(ctx, updated, true);
  });

  // ─── Handler teks untuk edit origin ──────────────────────────────────────
  // PENTING: daftarkan ini sebelum handleConfessText di file utama

  async function handleProfileText(ctx, next) {
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

  // ─── Kembali ke Menu ──────────────────────────────────────────────────────

  bot.action('btn_back_to_start', async (ctx) => {
    await ctx.answerCbQuery();
    const welcomeText = `Halo ${ctx.from.first_name}! 🤖\nPilih opsi di bawah ini:`;
    const buttons = [
      [Markup.button.callback('📣 Kirim Menfess', 'btn_confess')],
      [Markup.button.callback('👤 Lihat Profile', 'btn_profile')],
      [Markup.button.callback('📜 Lihat Menfess', 'btn_view')],
      [Markup.button.callback('ℹ️ Bantuan', 'btn_help')]
    ];
    try {
      await ctx.editMessageText(welcomeText, Markup.inlineKeyboard(buttons));
    } catch {
      await ctx.reply(welcomeText, Markup.inlineKeyboard(buttons));
    }
  });

  return { handleProfileText };
}

// ─── Helper render privacy menu ───────────────────────────────────────────────

async function showPrivacyMenu(ctx, privacy, isEdit) {
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