/**
 * Profile command — entry point, hanya registrasi handler ke bot.
 * Business logic ada di handlers/profile.handler.js
 */
import { Markup } from 'telegraf';
import { Database } from './database.js';
import { isAdmin } from '../middleware/admin-auth.js';
import { checkMembership, showJoinRequirement } from '../middleware/membership.js';
import {
  showProfile,
  showEditProfile,
  showGenderOptions,
  setGender,
  askOrigin,
  cancelEditOrigin,
  showPrivacyMenu,
  togglePrivacy,
  handleOriginText,
} from '../handlers/profile.handler.js';

export default function profileCommand(bot) {

  // ─── Membership middleware untuk profile handlers ───────────────────────────
  async function membershipMiddleware(ctx, next) {
    const userId = ctx.from.id;

    if (isAdmin(userId)) return next();

    const membershipStatus = await checkMembership(ctx, userId);
    if (!membershipStatus.isChannelMember || !membershipStatus.isGroupMember) {
      await showJoinRequirement(ctx, membershipStatus);
      return;
    }

    return next();
  }

  // ─── Lihat Profile via button ─────────────────────────────────────────────
  bot.action('btn_profile', async (ctx) => {
    await ctx.answerCbQuery('📋 Memuat profile...');
    try {
      await showProfile(ctx, true); // true = edit message
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

  // ─── Lihat Profile via /profile ───────────────────────────────────────────
  bot.command('profile', async (ctx) => {
    const msg = await ctx.reply('⏳ Memuat profile...');

    try {
      const userId = ctx.from.id;
      await Database.updateUsername(userId, ctx.from.username);

      const userProfile = await Database.getUserFullProfile(userId);

      if (!userProfile) {
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null,
          '❌ Profile tidak ditemukan!\n\nSeperti kamu belum terdaftar.',
          Markup.inlineKeyboard([
            [Markup.button.callback('📝 Daftar Sekarang', 'btn_register')]
          ])
        );
        return;
      }

      // We leverage showProfile but need editMessageText specific to /profile flow
      const totalConfessions = await Database.getTotalUserConfessions(userId);
      const privacy = await Database.getPrivacySettings(userId);

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
  bot.action('edit_profile', membershipMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    await showEditProfile(ctx);
  });

  // ─── Edit Gender ──────────────────────────────────────────────────────────
  bot.action('edit_gender', membershipMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    await showGenderOptions(ctx);
  });

  bot.action(/^set_gender_(.+)$/, membershipMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const gender = ctx.match[1];
    await setGender(ctx, gender);
  });

  // ─── Edit Origin ──────────────────────────────────────────────────────────
  bot.action('edit_origin', membershipMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    await askOrigin(ctx);
  });

  bot.action('cancel_edit_origin', async (ctx) => {
    await cancelEditOrigin(ctx);
  });

  // ─── Privacy Settings ─────────────────────────────────────────────────────
  bot.action('privacy_settings', membershipMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const privacy = await Database.getPrivacySettings(ctx.from.id);
    await showPrivacyMenu(ctx, privacy, false);
  });

  bot.action(/^toggle_hide_(username|gender|origin)$/, membershipMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const field = `hide_${ctx.match[1]}`;
    await togglePrivacy(ctx, field);
  });

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

  // ─── Upgrade Rank ─────────────────────────────────────────────────────────
  bot.action('btn_upgrade_rank', membershipMiddleware, async (ctx) => {
    await ctx.answerCbQuery();

    const activeRanks = await Database.getActiveRanks();

    if (activeRanks.length === 0) {
      return ctx.reply('⏳ Belum ada rank yang tersedia untuk upgrade saat ini.');
    }

    let text = `🏆 *Upgrade Rank*\n\nPilih rank yang ingin kamu upgrade:\n\n`;
    activeRanks.forEach(r => {
      text += `• *${r.rank}* — bisa menfess ${r.max_count}x per window\n`;
    });
    text += `\n_Fitur pembayaran akan segera tersedia._`;

    const buttons = activeRanks.map(r => ([
      Markup.button.callback(`⬆️ ${r.rank} (${r.max_count}x)`, `upgrade_to_${r.rank}`)
    ]));
    buttons.push([Markup.button.callback('🏠 Menu Utama', 'back_to_main')]);

    await ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons }
    });
  });

  bot.action(/^upgrade_to_(.+)$/, membershipMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const rank = ctx.match[1];

    await ctx.reply(
      `⏳ *Upgrade ke rank ${rank}*\n\nFitur pembayaran sedang dalam pengembangan.\nHubungi admin untuk upgrade manual: @jzxty`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.url('📞 Hubungi Admin', 'https://t.me/jzxty')],
            [Markup.button.callback('🔙 Kembali', 'btn_upgrade_rank')]
          ]
        }
      }
    );
  });

  return { handleProfileText: handleOriginText };
}
