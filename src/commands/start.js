import { Markup } from 'telegraf';
import adminPanel from './admin.js';
import { checkMembership, showJoinRequirement } from '../middleware/membership.js';
import { showMainMenu } from '../handlers/start.handler.js';
import { privateChatOnly } from '../middleware/private-chat-only.js';
import * as UserRepo from '../repositories/user.repo.js';

// --- Teks Bantuan ---
const HELP_MESSAGES = {
    main: 'ℹ️ *Bantuan FWB Confess Bot*\n\n' +
        'Pilih salah satu topik di bawah ini untuk melihat detailnya.',
    menfess: '📝 *Cara Mengirim Menfess*\n\n' +
        '1. Klik tombol "📣 Kirim Menfess" di menu utama.\n' +
        '2. Tulis dan kirim confession kamu langsung di chat ini.\n' +
        '3. Kamu bisa menyertakan hingga 3 tagar (contoh: `#curhat`).\n' +
        '4. Bot akan memproses dan mengirimnya ke channel secara anonim.',
    chat: '💬 *Fitur Chat & Interaksi*\n\n' +
        '• *Hit Me*: Tombol ini memungkinkan pengguna lain untuk memulai obrolan anonim denganmu.\n' +
        '• *Super Hit*: Gunakan koin untuk melewati antrian "Hit Me".\n' +
        '• *Show Me*: Memungkinkan pengguna lain meminta untuk melihat profilmu (membutuhkan persetujuanmu).\n' +
        '• *Reveal*: Saat dalam obrolan, kedua pihak bisa setuju untuk membuka identitas masing-masing.',
    rules: '📜 *Peraturan Penting*\n\n' +
        '• Gunakan bahasa yang sopan dan tidak menyinggung SARA.\n' +
        '• Jangan melakukan spam atau flooding.\n' +
        '• Dilarang keras membagikan informasi pribadi.\n' +
        '• Dilarang mengirim konten ilegal, pornografi, atau kekerasan.',
    commands: '🤖 *Daftar Perintah*\n\n' +
        '• `/start` - Menampilkan menu utama.\n' +
        '• `/menfess` - Memulai proses pengiriman menfess.\n' +
        '• `/profile` - Melihat profil, rank, dan statistik.\n' +
        '• `/leaderboard` - Menampilkan papan peringkat.\n' +
        '• `/rank` - Melihat dan membeli rank.\n' +
        '• `/cancel` - Membatalkan proses pengiriman menfess.'
};

// --- Keyboard Bantuan ---
const HELP_KEYBOARDS = {
    main: Markup.inlineKeyboard([
        [Markup.button.callback('📝 Cara Kirim Menfess', 'help_menfess')],
        [Markup.button.callback('💬 Fitur Chat', 'help_chat')],
        [Markup.button.callback('📜 Peraturan', 'help_rules'), Markup.button.callback('🤖 Perintah', 'help_commands')],
        [Markup.button.callback('🏠 Kembali ke Menu', 'back_to_main')]
    ]),
    back: Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Kembali ke Bantuan', 'btn_help')]
    ])
};


/**
 * Handler untuk perintah /start dan menu utama
 * @param {Telegraf} bot
 */
export default function startCommand(bot) {
  const adminSystem = adminPanel(bot, process.env.TARGET_CHANNEL_ID);

  async function membershipMiddleware(ctx, next) {
    // ... (kode membership tetap sama)
    const userId = ctx.from.id;
    if (adminSystem.isAdmin(userId)) return next();
    const membershipStatus = await checkMembership(ctx, userId);
    if (!membershipStatus.isChannelMember || !membershipStatus.isGroupMember) {
      await showJoinRequirement(ctx, membershipStatus);
      return;
    }
    return next();
  }

  bot.start(async (ctx) => {
    // ... (kode start tetap sama)
    const userId = ctx.from.id;
    const payload = ctx.startPayload;
    if (payload) {
      const referrerId = parseInt(payload.trim(), 10);
      if (!isNaN(referrerId) && referrerId !== userId) {
        ctx.session.referrerId = referrerId;
      }
    }
    if (adminSystem.isAdmin(userId)) {
      return adminSystem.showAdminMenu(ctx);
    }
    const membershipStatus = await checkMembership(ctx, userId);
    if (!membershipStatus.isChannelMember || !membershipStatus.isGroupMember) {
      return showJoinRequirement(ctx, membershipStatus);
    }
    await showMainMenu(ctx);
  });

  bot.command('menfess', privateChatOnly('Gunakan perintah /menfess di chat pribadi dengan bot.'), membershipMiddleware, async (ctx) => {
    await ctx.reply('📣 *Kirim Menfess*...', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[Markup.button.callback('✍️ Tulis Menfess', 'btn_confess')]] }
    });
  });

  bot.action('check_membership', async (ctx) => {
    // ... (kode check_membership tetap sama)
    await ctx.answerCbQuery('Mengecek keanggotaan...');
    const userId = ctx.from.id;
    const membershipStatus = await checkMembership(ctx, userId);
    if (!membershipStatus.isChannelMember || !membershipStatus.isGroupMember) {
      await ctx.editMessageText('❌ Anda masih belum bergabung.', Markup.inlineKeyboard([[Markup.button.callback('🔄 Cek Lagi', 'check_membership')]])).catch(() => {});
      return;
    }
    await ctx.editMessageText('✅ Keanggotaan berhasil diverifikasi!').catch(() => {});
    setTimeout(() => showMainMenu(ctx), 1500);
  });

  // === USER MENU HANDLERS ===
  // ... (handler lain seperti btn_view tetap sama)

  // --- [BARU] HANDLER BANTUAN INTERAKTIF ---

  bot.action('btn_help', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(HELP_MESSAGES.main, {
        parse_mode: 'Markdown',
        reply_markup: HELP_KEYBOARDS.main.reply_markup
    });
  });

  bot.action('help_menfess', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.editMessageText(HELP_MESSAGES.menfess, {
          parse_mode: 'Markdown',
          reply_markup: HELP_KEYBOARDS.back.reply_markup
      });
  });

  bot.action('help_chat', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.editMessageText(HELP_MESSAGES.chat, {
          parse_mode: 'Markdown',
          reply_markup: HELP_KEYBOARDS.back.reply_markup
      });
  });

  bot.action('help_rules', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.editMessageText(HELP_MESSAGES.rules, {
          parse_mode: 'Markdown',
          reply_markup: HELP_KEYBOARDS.back.reply_markup
      });
  });

  bot.action('help_commands', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.editMessageText(HELP_MESSAGES.commands, {
          parse_mode: 'Markdown',
          reply_markup: HELP_KEYBOARDS.back.reply_markup
      });
  });


  bot.action('back_to_main', async (ctx) => {
    await ctx.answerCbQuery();
    await showMainMenu(ctx);
  });

  return {
    membershipMiddleware,
    checkMembership,
    showJoinRequirement,
    showMainMenu,
    adminSystem
  };
}
