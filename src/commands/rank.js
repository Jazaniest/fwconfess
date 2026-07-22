import { Markup } from 'telegraf';
import { db } from '../services/db.js';
import * as EconomyRepo from '../repositories/economy.repo.js';
import * as UserRepo from '../repositories/user.repo.js';
import { privateChatOnly } from '../middleware/private-chat-only.js';
import { configService } from '../services/config.service.js';

async function getAvailableRanks() {
    const [rows] = await db.query('SELECT * FROM rank_confession_limits WHERE is_active = 1 AND `rank` != ? ORDER BY price_idr ASC', ['member']);
    return rows;
}

export default function rankCommand(bot) {
    const showRankMenu = async (ctx) => {
        if (!configService.isFeatureEnabled('rank_purchase')) {
            return ctx.reply('ℹ️ Fitur peningkatan rank sedang tidak aktif saat ini.');
        }
        try {
            const userId = ctx.from.id;
            const [user, ranks, wallet] = await Promise.all([UserRepo.getUserById(userId), getAvailableRanks(), EconomyRepo.getWallet(userId)]);
            let message = `🏆 *Pusat Peningkatan Rank*\n\nRank kamu saat ini: *${user.rank || 'member'}*\nSaldo Koin: *${wallet.balance} 🪙*\n\nPilih rank di bawah untuk mendapatkan keuntungan lebih!\n\n`;
            ranks.forEach(rank => {
                message += `*${rank.rank.charAt(0).toUpperCase() + rank.rank.slice(1)}* - ${rank.max_count}x menfess\n`;
                message += `Harga: ${rank.price_coins} 🪙 atau Rp ${rank.price_idr.toLocaleString('id-ID')}\n\n`;
            });
            const buttons = ranks.map(rank => {
                const trakteerUrl = new URL(process.env.TRAKTEER_URL);
                const quantity = rank.price_idr / 1000;
                const supporterMessage = `UPGRADE;${rank.rank};${userId}`;
                trakteerUrl.searchParams.set('quantity', quantity);
                trakteerUrl.searchParams.set('supporter_message', supporterMessage);
                trakteerUrl.searchParams.set('step', '2');
                return [
                    Markup.button.callback(`Beli ${rank.rank} (${rank.price_coins} 🪙)`, `buy_rank_coin_${rank.rank}`),
                    Markup.button.url(`Beli dgn Rp`, trakteerUrl.toString()),
                ];
            });
            await ctx.reply(message, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
        } catch (error) {
            console.error('❌ Gagal menampilkan menu rank:', error);
            await ctx.reply('❌ Terjadi kesalahan saat memuat menu rank.');
        }
    };

    bot.command('rank', privateChatOnly(), showRankMenu);

    bot.action('show_rank_menu', privateChatOnly(), async (ctx) => {
        await ctx.answerCbQuery();
        await showRankMenu(ctx);
    });

    bot.action(/^buy_rank_coin_(\\d+)$/, privateChatOnly(), async (ctx) => {
        const rankId = parseInt(ctx.match[1]);
        const userId = ctx.from.id;

        try {
            await ctx.answerCbQuery(' memproses...');

            const rank = await RankRepo.getRankById(rankId);
            if (!rank) {
                return ctx.reply('❌ Rank tidak valid atau sudah tidak tersedia.');
            }

            const wallet = await EconomyRepo.getWallet(userId);
            if (wallet.balance < rank.price_coins) {
                return ctx.editMessageText(
                    `⚠️ *Gagal Membeli Rank*\n\nKoin kamu tidak cukup untuk membeli rank *${rank.name}*.\n` +
                    `Harga: ${rank.price_coins} 🪙\n` +
                    `Saldo kamu: ${wallet.balance} 🪙\n\n` +
                    `Silakan top up koin terlebih dahulu.`,
                    { parse_mode: 'Markdown' }
                );
            }

            // Spend coins
            await EconomyRepo.spendCoins(userId, rank.price_coins);

            // Assign rank
            let expiresAt = null;
            let successMessage = `🎉 *Upgrade Berhasil!*\n\nSelamat, rank kamu sekarang adalah *${rank.name}* (Permanen)!`;

            if (rank.type === 'subscription') {
                expiresAt = new Date(Date.now() + rank.duration_days * 24 * 60 * 60 * 1000);
                const formattedDate = expiresAt.toLocaleString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                successMessage = `🎉 *Upgrade Berhasil!*\n\nSelamat, kamu telah berlangganan rank *${rank.name}*!\nRank ini akan aktif hingga: *${formattedDate}*.`;
            }

            await UserRepo.assignRank({ userId, rankId, expiresAt });

            await ctx.editMessageText(successMessage, { parse_mode: 'Markdown' });

        } catch (error) {
            console.error(`❌ Gagal memproses pembelian rank via koin untuk user ${userId}:`, error);
            await ctx.reply('❌ Terjadi kesalahan saat memproses pembelian. Silakan coba lagi.');
        }
    });
}
