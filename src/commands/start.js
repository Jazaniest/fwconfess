import { Markup }                  from 'telegraf';
import { checkMembership,
         showJoinRequirement,
         createMembershipMiddleware } from '../middleware/membership.js';
import { isAdminUser }               from '../middleware/admin-auth.js';

/**
 * /start command — sambutan + cek keanggotaan channel & grup.
 *
 * Entry-point tipis: semua logika membership sudah di middleware/membership.js.
 * File ini hanya registrasi handler ke bot.
 *
 * @param {import('telegraf').Telegraf} bot
 * @returns {{ membershipMiddleware: Function }}
 */
export default function startCommand(bot) {
  const { membershipMiddleware } = createMembershipMiddleware();

  // ─── /start ────────────────────────────────────────────────────────────────

  bot.start(async (ctx) => {
    const userId = ctx.from.id;

    // Admin langsung ke menu utama
    if (isAdminUser(userId)) {
      return showMainMenu(ctx);
    }

    // Cek keanggotaan
    const status = await checkMembership(ctx, userId);
    if (!status.isChannelMember || !status.isGroupMember) {
      return showJoinRequirement(ctx, status);
    }

    return showMainMenu(ctx);
  });

  // ─── Cek ulang keanggotaan (tombol "Cek Keanggotaan") ─────────────────────

  bot.action('check_membership', async (ctx) => {
    await ctx.answerCbQuery('🔄 Mengecek keanggotaan...');
    const userId = ctx.from.id;

    const status = await checkMembership(ctx, userId);

    if (!status.isChannelMember || !status.isGroupMember) {
      return showJoinRequirement(ctx, status);
    }

    // Semua sudah join → tampilkan menu utama
    try {
      await ctx.editMessageText(
        buildWelcomeText(ctx.from),
        buildMainMenuMarkup()
      );
    } catch {
      await ctx.reply(buildWelcomeText(ctx.from), buildMainMenuMarkup());
    }
  });

  // ─── Kembali ke menu utama ─────────────────────────────────────────────────
  // (dipakai juga oleh handler lain via callback_data 'btn_back_to_start')

  bot.action('btn_back_to_start', async (ctx) => {
    await ctx.answerCbQuery();
    try {
      await ctx.editMessageText(buildWelcomeText(ctx.from), buildMainMenuMarkup());
    } catch {
      await ctx.reply(buildWelcomeText(ctx.from), buildMainMenuMarkup());
    }
  });

  // ─── Helper: tampilkan menu utama ─────────────────────────────────────────

  async function showMainMenu(ctx) {
    await ctx.reply(buildWelcomeText(ctx.from), buildMainMenuMarkup());
  }

  return { membershipMiddleware };
}

// ─── Pure helpers (tidak butuh ctx langsung) ────────────────────────────────

function buildWelcomeText(from) {
  return `Halo ${from.first_name}! 🤖\nPilih opsi di bawah ini:`;
}

function buildMainMenuMarkup() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📣 Kirim Menfess', 'btn_confess')],
    [Markup.button.callback('👤 Lihat Profile',  'btn_profile')],
    [Markup.button.callback('ℹ️ Bantuan',         'btn_help')],
  ]);
}