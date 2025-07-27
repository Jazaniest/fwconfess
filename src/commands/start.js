import { Markup } from 'telegraf';

/**
 * Handler untuk perintah /start: menampilkan panel pilihan dengan inline keyboard
 * @param {Telegraf} bot
 */
export default function startCommand(bot) {
  bot.start(async (ctx) => {
    const welcomeText = `Halo ${ctx.from.first_name}! 🤖\nPilih opsi di bawah ini:`;
    const buttons = [
      [Markup.button.callback('📣 Kirim Menfess', 'btn_confess')],
      [Markup.button.callback('👤 Lihat Profile', 'btn_profile')],
      [Markup.button.callback('📜 Lihat Menfess', 'btn_view')],
      [Markup.button.callback('ℹ️ Bantuan', 'btn_help')]
    ];
    await ctx.reply(welcomeText, Markup.inlineKeyboard(buttons));
  });

  // Handler untuk tombol 'Lihat Menfess'
  bot.action('btn_view', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('Berikut daftar menfess terbaru: ...');
  });

  // Handler untuk tombol 'Bantuan'
  bot.action('btn_help', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('Untuk memulai, pilih opsi yang tersedia. Jika ada kendala, hubungi admin. @SanzJzx');
  });
}