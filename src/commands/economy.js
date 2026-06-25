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
    const userId = ctx.from.id;
    const trakteerUrl = process.env.TRAKTEER_URL || 'https://trakteer.id/jzxyzx/tip';

    // Untuk saat ini, hanya pesan statis.
    // Nanti bisa diintegrasikan dengan payment gateway.
    const message = `
*➕ Top Up Koin*\n\n
Pilih salah satu paket di bawah ini untuk melakukan top up. Kamu akan diarahkan ke halaman Trakteer.
    `;

    // Daftar paket top up
    const packages = [
        { label: '10 Koin', price: 10000, coins: 10, item: 'koin_10' },
        { label: '50 Koin', price: 45000, coins: 50, item: 'koin_50' },
        { label: '100 Koin', price: 80000, coins: 100, item: 'koin_100' },
    ];

    const buttons = packages.map(pkg => {
        // Buat URL Trakteer dengan parameter khusus untuk top up
        const url = new URL(trakteerUrl);
        url.searchParams.set('type', 'topup');
        url.searchParams.set('tid', userId);
        url.searchParams.set('item', pkg.item);
        // Trakteer mungkin mengenali parameter 'price'
        url.searchParams.set('price', pkg.price);
        return [Markup.button.url(`💰 ${pkg.label} - Rp ${pkg.price / 1000}rb`, url.toString())];
    });

    buttons.push([Markup.button.callback('Kembali', 'saldo_back')]);

    await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: buttons
        }
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
