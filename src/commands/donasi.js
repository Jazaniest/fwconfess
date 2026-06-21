import { Markup } from 'telegraf';
import { Database } from './database.js';
import { formatRupiah } from '../utils/formatters.js';

export default function donasiCommand(bot, trakteerUrl = 'https://trakteer.id/jzxyzx/tip') {

    // ── /donasi & tombol menu ───────────────────────────────────────────────────
    async function showDonasiMenu(ctx) {
        try {
            const [totalAmount, totalCount, topDonators, recent] = await Promise.all([
                Database.getTotalDonations(),
                Database.getTotalDonationCount(),
                Database.getTopDonators(5),
                Database.getRecentDonations(3),
            ]);

            let text =
                `❤️ *Donasi*\n\n` +
                `Terima kasih sudah mendukung bot ini!\n\n`;

            if (topDonators.length > 0) {
                text += `🏆 *Top Donator:*\n`;
                topDonators.forEach((d, i) => {
                    text += `${i + 1}. *${d.supporter_name}* — ${formatRupiah(d.total)} (${d.donation_count}x)\n`;
                });
                text += '\n';
            }

            if (recent.length > 0) {
                text += `🕐 *Donasi Terbaru:*\n`;
                recent.forEach(d => {
                    const msg = d.supporter_message ? ` _"${d.supporter_message}"_` : '';
                    text += `• *${d.supporter_name}* — ${d.quantity}x ${d.unit} (${formatRupiah(d.total_amount)})${msg}\n`;
                });
                text += '\n';
            }

            text += `_Setiap donasi sangat berarti untuk pengembangan bot ini!_ 🙏`;

            await ctx.reply(text, {
                parse_mode: 'Markdown',
                reply_markup: Markup.inlineKeyboard([
                    [Markup.button.url('❤️ Donasi Sekarang', trakteerUrl)],
                    [Markup.button.callback('🔄 Refresh', 'donasi_refresh')],
                    [Markup.button.callback('🏠 Menu Utama', 'back_to_main')],
                ]).reply_markup,
            });
        } catch (err) {
            console.error('❌ [DONASI] Error memuat menu donasi:', err);
            await ctx.reply('❌ Gagal memuat halaman donasi. Coba lagi nanti.');
        }
    }

    bot.command('donasi', async (ctx) => {
        if (ctx.chat.type !== 'private') return;
        await showDonasiMenu(ctx);
    });

    bot.action('btn_donasi', async (ctx) => {
        await ctx.answerCbQuery();
        await showDonasiMenu(ctx);
    });

    bot.action('donasi_refresh', async (ctx) => {
        await ctx.answerCbQuery('🔄 Memperbarui...');
        try {
            const [totalAmount, totalCount, topDonators, recent] = await Promise.all([
                Database.getTotalDonations(),
                Database.getTotalDonationCount(),
                Database.getTopDonators(5),
                Database.getRecentDonations(3),
            ]);

            let text =
                `❤️ *Donasi*\n\n` +
                `Terima kasih sudah mendukung bot ini!\n\n`;

            if (topDonators.length > 0) {
                text += `🏆 *Top Donator:*\n`;
                topDonators.forEach((d, i) => {
                    text += `${i + 1}. *${d.supporter_name}* — ${formatRupiah(d.total)} (${d.donation_count}x)\n`;
                });
                text += '\n';
            }

            if (recent.length > 0) {
                text += `🕐 *Donasi Terbaru:*\n`;
                recent.forEach(d => {
                    const msg = d.supporter_message ? ` _"${d.supporter_message}"_` : '';
                    text += `• *${d.supporter_name}* — ${d.quantity}x ${d.unit} (${formatRupiah(d.total_amount)})${msg}\n`;
                });
                text += '\n';
            }

            text += `_Setiap donasi sangat berarti untuk pengembangan bot ini!_ 🙏`;

            await ctx.editMessageText(text, {
                parse_mode: 'Markdown',
                reply_markup: Markup.inlineKeyboard([
                    [Markup.button.url('❤️ Donasi Sekarang', trakteerUrl)],
                    [Markup.button.callback('🔄 Refresh', 'donasi_refresh')],
                    [Markup.button.callback('🏠 Menu Utama', 'back_to_main')],
                ]).reply_markup,
            });
        } catch (err) {
            console.error('❌ [DONASI] Error refresh:', err);
            await ctx.answerCbQuery('❌ Gagal memperbarui.');
        }
    });

    return { showDonasiMenu };
}