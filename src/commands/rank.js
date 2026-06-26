import { Markup } from 'telegraf';
import { db } from '../services/db.js';
import * as EconomyRepo from '../repositories/economy.repo.js';
import * as UserRepo from '../repositories/user.repo.js';
import { privateChatOnly } from '../middleware/private-chat-only.js';
import { configService } from '../services/config.service.js';

async function getAvailableRanks() {
    const [rows] = await db.query(
        'SELECT * FROM rank_confession_limits WHERE is_active = 1 AND `rank` != ? ORDER BY price_idr ASC',
        ['member']
    );
    return rows;
}

export default function rankCommand(bot) {
    const showRankMenu = async (ctx) => {
        if (!configService.isFeatureEnabled('rank_purchase')) {
            return ctx.reply('ℹ️ Fitur peningkatan rank sedang tidak aktif saat ini.');
        }
        try {
            const userId = ctx.from.id;
            const [user, ranks, wallet] = await Promise.all([
                UserRepo.getUserById(userId),
                getAvailableRanks(),
                EconomyRepo.getWallet(userId)
            ]);

            let message = `🏆 *Pusat Peningkatan Rank*\n\n`;
            message += `Rank kamu saat ini: *${user.rank || 'member'}*\n`;
            message += `Saldo Koin: *${wallet.balance} 🪙*\n\n`;
            message += `Pilih rank di bawah untuk mendapatkan keuntungan lebih!\n\n`;

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

            await ctx.reply(message, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: buttons }
            });

        } catch (error) {
            console.error('❌ Gagal menampilkan menu rank:', error);
            await ctx.reply('❌ Terjadi kesalahan saat memuat menu rank.');
        }
    };

    bot.command('rank', privateChatOnly(), showRankMenu);

    bot.action(/^buy_rank_coin_(.+)$/, privateChatOnly(), async (ctx) => {
        await ctx.answerCbQuery();
        const targetRank = ctx.match[1];
        const userId = ctx.from.id;

        try {
            const [ranks] = await db.query('SELECT * FROM rank_confession_limits WHERE `rank` = ?', [targetRank]);
            if (ranks.length === 0) {
                return ctx.reply('❌ Rank tidak valid.');
            }
            const rankData = ranks[0];

            const success = await EconomyRepo.spendCoins(
                userId,
                rankData.price_coins,
                'spend_rank_upgrade',
                `Upgrade rank ke ${targetRank}`
            );

            if (!success) {
                return ctx.reply(`⚠️ Koin tidak cukup! Kamu butuh ${rankData.price_coins} koin untuk upgrade.`);
            }

            // Lakukan upgrade rank di DB
            await UserRepo.updateUserRank(userId, targetRank); // Perlu dibuat

            await ctx.reply(`🎉 Selamat! Rank kamu telah di-upgrade ke *${targetRank}*!`, { parse_mode: 'Markdown' });

        } catch (error) {
            console.error('❌ Gagal membeli rank dengan koin:', error);
            await ctx.reply('❌ Terjadi kesalahan saat memproses pembelian.');
        }
    });
}
