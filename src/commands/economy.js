import { Markup } from 'telegraf';
import * as EconomyRepo from '../repositories/economy.repo.js';
import { privateChatOnly } from '../middleware/private-chat-only.js';

export default function economyCommand(bot) {
  bot.command('saldo', privateChatOnly(), async (ctx) => {
    try {
      const wallet = await EconomyRepo.getWallet(ctx.from.id);
      await ctx.reply(
        `💰 *Saldoku*\n\nSaldo koin kamu saat ini adalah: *${wallet.balance} koin*.\n\n` +
        `Gunakan koin untuk fitur-fitur spesial di masa depan!`,
        {
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('➕ Top Up Koin', 'topup')]
          ]).reply_markup
        }
      );
    } catch (error) {
      console.error('❌ Gagal mengambil saldo:', error);
      await ctx.reply('❌ Terjadi kesalahan saat memeriksa saldo.');
    }
  });

  const topupHandler = async (ctx) => {
    // Untuk saat ini, hanya pesan statis.
    // Nanti bisa diintegrasikan dengan payment gateway.
    const message = `
*➕ Top Up Koin*\n\n
Untuk saat ini, top up koin dilakukan secara manual.\n
Silakan hubungi admin untuk melakukan pembelian koin.
Daftar harga:
- 10 Koin: Rp 10.000
- 50 Koin: Rp 45.000
- 100 Koin: Rp 80.000

Setelah melakukan pembayaran, konfirmasi ke admin dengan menyertakan bukti transfer.
    `;
    await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
            [Markup.button.url('📞 Hubungi Admin', `https://t.me/${process.env.ADMIN_USERNAME || 'jzxty'}`)],
            [Markup.button.callback('Kembali', 'saldo_back')]
        ]).reply_markup
    });
  };

  bot.command('topup', privateChatOnly(), topupHandler);
  bot.action('topup', privateChatOnly(), async (ctx) => {
      await ctx.answerCbQuery();
      await topupHandler(ctx);
  });

  bot.action('saldo_back', privateChatOnly(), async (ctx) => {
      await ctx.answerCbQuery();
      const wallet = await EconomyRepo.getWallet(ctx.from.id);
      await ctx.editMessageText(
        `💰 *Saldoku*\n\nSaldo koin kamu saat ini adalah: *${wallet.balance} koin*.\n\n` +
        `Gunakan koin untuk fitur-fitur spesial di masa depan!`,
        {
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('➕ Top Up Koin', 'topup')]
          ]).reply_markup
        }
      );
  });
}
