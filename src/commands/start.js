import { Markup } from 'telegraf';
import adminPanel from './admin.js';
import { Database } from './database.js';
import { checkMembership, showJoinRequirement } from '../middleware/membership.js';
import { showMainMenu } from '../handlers/start.handler.js';

/**
 * Handler untuk perintah /start
 * @param {Telegraf} bot
 */
export default function startCommand(bot) {
  const adminSystem = adminPanel(bot, process.env.TARGET_CHANNEL_ID);

  async function membershipMiddleware(ctx, next) {
    const userId = ctx.from.id;

    // Admin bypass membership check
    if (adminSystem.isAdmin(userId)) {
      console.log('👑 Admin bypassing membership check:', userId);
      return next();
    }

    const membershipStatus = await checkMembership(ctx, userId);

    if (!membershipStatus.isChannelMember || !membershipStatus.isGroupMember) {
      await showJoinRequirement(ctx, membershipStatus);
      return;
    }

    return next();
  }

  // Handler untuk perintah /start dengan deteksi admin
  bot.start(async (ctx) => {
    const userId = ctx.from.id;
    console.log(`🚀 Start command from user: ${userId} (${ctx.from.first_name})`);

    if (adminSystem.isAdmin(userId)) {
      console.log('👑 Admin detected, showing admin menu');
      await adminSystem.showAdminMenu(ctx);
      return;
    }

    const membershipStatus = await checkMembership(ctx, userId);

    if (!membershipStatus.isChannelMember || !membershipStatus.isGroupMember) {
      await showJoinRequirement(ctx, membershipStatus);
      return;
    }

    await showMainMenu(ctx);
  });

  bot.command('menfess', membershipMiddleware, async (ctx) => {
    const userId = ctx.from.id;
    console.log(`📣 Menfess command from user: ${userId}`);

    await ctx.reply('📣 *Kirim Menfess*\n\nKlik tombol di bawah untuk mulai menulis confession kamu:', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [Markup.button.callback('✍️ Tulis Menfess', 'btn_confess')]
        ]
      }
    });
  });

  // Handler untuk tombol cek keanggotaan
  bot.action('check_membership', async (ctx) => {
    await ctx.answerCbQuery('Mengecek keanggotaan...');

    const userId = ctx.from.id;
    const membershipStatus = await checkMembership(ctx, userId);

    if (!membershipStatus.isChannelMember || !membershipStatus.isGroupMember) {
      const currentText = ctx.callbackQuery?.message?.text || '';
      const newText = '❌ Anda masih belum bergabung di semua channel/grup yang direkomendasikan. Silakan bergabung terlebih dahulu.';

      if (currentText !== newText) {
        await ctx.editMessageText(
          newText,
          Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Cek Lagi', 'check_membership')]
          ])
        ).catch(() => { });
      }
      return;
    }

    await ctx.editMessageText('✅ Keanggotaan berhasil diverifikasi! Selamat datang!').catch(() => { });
    setTimeout(async () => {
      await showMainMenu(ctx);
    }, 1500);
  });

  // === USER MENU HANDLERS ===

  bot.action('btn_view', membershipMiddleware, async (ctx) => {
    await ctx.answerCbQuery();

    try {
      const telegramId = ctx.from.id;
      const confessions = await Database.getConfessionsByUserId(telegramId, 5);

      let listText = '';

      if (confessions.length === 0) {
        listText = `_Kamu belum pernah mengirim menfess atau data tidak ditemukan._\n\n`;
      } else {
        confessions.forEach((cf, index) => {
          const shortText = cf.message_text.length > 60
            ? cf.message_text.substring(0, 60) + '...'
            : cf.message_text;

          listText += `${index + 1}. *ID:* #${cf.id}\n` +
            `📝 "${shortText}"\n` +
            `🔗 [Lihat di Channel](https://t.me/fwb_confess/${cf.channel_message_id})\n\n`;
        });
      }

      const viewText = `📜 *Menfess Terbaru Anda*\n\n` +
        `${listText}` +
        `💡 Gunakan tombol di bawah untuk menyegarkan halaman atau kembali ke menu.`;

      await ctx.reply(viewText, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📣 Ke Channel', url: 'https://t.me/fwb_confess' },
              { text: '💬 Ke Grup', url: 'https://t.me/fwb_confesschat' }
            ],
            [
              { text: '🔄 Refresh', callback_data: 'btn_view' },
              { text: '🏠 Menu Utama', callback_data: 'back_to_main' }
            ]
          ]
        }
      });

    } catch (error) {
      console.error('Error showing menfess list:', error);
      await ctx.reply('❌ Error memuat daftar menfess. Silakan coba lagi.');
    }
  });

  bot.action('btn_help', async (ctx) => {
    await ctx.answerCbQuery();

    const isUserAdmin = adminSystem.isAdmin(ctx.from.id);

    const helpText = `ℹ️ *Bantuan FWB Confess Bot*\n\n` +
      `🔹 *Cara Menggunakan:*\n` +
      `1. Klik "Kirim Menfess" untuk membuat confession\n` +
      `2. Tulis confession dengan tag #fwconfess\n` +
      `3. Confession akan dipublish secara anonymous\n\n` +
      `🔹 *Fitur Utama:*\n` +
      `• Anonymous confession dengan gender & rank\n` +
      `• Hit Me untuk chat anonymous dengan pembuat menfess\n` +
      `• Sistem komentar di grup diskusi\n` +
      `• Profile dan statistik personal\n\n` +
      `🔹 *Aturan Penting:*\n` +
      `• Gunakan bahasa yang sopan dan tidak menyinggung\n` +
      `• Jangan spam atau flood confession\n` +
      `• Patuhi peraturan channel dan grup\n` +
      `• Dilarang share informasi pribadi\n` +
      `• Jangan membuat confession yang melanggar hukum\n\n` +
      `📞 *Kontak:*\n` +
      `Admin: @jzxty\n` +
      `Channel: @fwb_confess\n` +
      `Grup: @fwb_confesschat`;

    const backButton = isUserAdmin ? 'back_to_admin' : 'back_to_main';
    const backText = isUserAdmin ? '👑 Admin Panel' : '🏠 Menu Utama';

    await ctx.reply(helpText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📣 Channel', url: 'https://t.me/fwb_confess' },
            { text: '💬 Grup', url: 'https://t.me/fwb_confesschat' }
          ],
          [
            { text: '📞 Kontak Admin', url: 'https://t.me/jzxty' },
            { text: '📋 FAQ', callback_data: 'show_faq' }
          ],
          [{ text: backText, callback_data: backButton }]
        ]
      }
    });
  });

  bot.action('show_faq', async (ctx) => {
    await ctx.answerCbQuery();

    const faqText = `❓ *Frequently Asked Questions*\n\n` +
      `*Q: Bagaimana cara kirim menfess?*\n` +
      `A: Klik "Kirim Menfess", tulis confession dengan tag #fwconfess\n\n` +
      `*Q: Kenapa menfess saya tidak muncul?*\n` +
      `A: Pastikan sudah include tag #fwconfess dan tidak melanggar aturan\n\n` +
      `*Q: Berapa lama cooldown untuk kirim menfess lagi?*\n` +
      `A: 8 jam setelah menfess terakhir berhasil dipublish\n\n` +
      `*Q: Bagaimana cara menggunakan fitur "Hit Me"?*\n` +
      `A: Klik tombol "Hit Me" di menfess yang menarik\n\n` +
      `*Q: Data saya aman tidak?*\n` +
      `A: Ya, semua confession bersifat anonymous\n\n` +
      `*Q: Bagaimana cara melaporkan menfess yang tidak pantas?*\n` +
      `A: Hubungi admin melalui @jzxty`;

    const isUserAdmin = adminSystem.isAdmin(ctx.from.id);
    const backButton = isUserAdmin ? 'back_to_admin' : 'btn_help';

    await ctx.reply(faqText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Kembali ke Bantuan', callback_data: backButton }]
        ]
      }
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
