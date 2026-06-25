import express from 'express';
import { Database } from '../commands/database.js';
import { formatRupiah } from '../utils/formatters.js';
import * as LeaderboardRepo from '../repositories/leaderboard.repo.js';
import * as EconomyRepo from '../repositories/economy.repo.js';
import * as UserRepo from '../repositories/user.repo.js';

const COIN_PACKAGES = {
    'koin_10': { coins: 10, price: 10000 },
    'koin_50': { coins: 50, price: 45000 },
    'koin_100': { coins: 100, price: 80000 },
};

export function createPaymentRouter(bot, webhookSecret) {
    const router = express.Router();

    router.post('/webhook', express.json(), async (req, res) => {
        // Verifikasi secret token Trakteer
        const token = req.headers['x-trakteer-token'] || req.headers['authorization'];
        if (webhookSecret && token !== webhookSecret) {
            console.warn('⚠️ [PAYMENT] Webhook ditolak: token tidak valid');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const payload = req.body;
        const paymentType = payload.query?.type;

        if (paymentType === 'topup') {
            await handleTopUp(bot, payload);
        } else if (paymentType === 'rank_purchase') {
            await handleRankPurchase(bot, payload);
        } else {
            await handleDonation(bot, payload);
        }

        return res.status(200).json({ status: 'ok' });
    });

    return router;
}



async function handleTopUp(bot, payload) {
    console.log('💰 [TOPUP] Menerima webhook top up...');
    const { transaction_id, query, price } = payload;
    const userId = query?.tid;
    const item = query?.item;

    if (!userId || !item || !COIN_PACKAGES[item]) {
        console.warn('⚠️ [TOPUP] Payload tidak lengkap atau item tidak valid:', payload);
        return;
    }

    const pkg = COIN_PACKAGES[item];
    // Validasi harga untuk keamanan tambahan
    if (parseInt(price) < pkg.price) {
        console.warn(`⚠️ [TOPUP] Harga tidak sesuai! Diharapkan: ${pkg.price}, Diterima: ${price}`);
        return;
    }

    try {
        const success = await EconomyRepo.addCoins(
            parseInt(userId),
            pkg.coins,
            'purchase',
            `Top up paket ${item}`,
            transaction_id
        );

        if (success) {
            // Cek dan berikan achievement donasi pertama
            const totalDonationsFromUser = await Database.getTotalDonationCountByUserId(parseInt(userId));
            if (totalDonationsFromUser === 1) {
                const newAchievement = await AchievementRepo.unlockAchievement(parseInt(userId), 'FIRST_TOPUP');
                if (newAchievement) {
                    bot.telegram.sendMessage(parseInt(userId), `🎉 *Achievement Unlocked: ${newAchievement.icon} ${newAchievement.title}!*\n_${newAchievement.description}_`, { parse_mode: 'Markdown' });
                }
            }

            await bot.telegram.sendMessage(
                userId,
                `✅ *Top Up Berhasil!*\n\n${pkg.coins} koin telah ditambahkan ke dompet kamu.` +
                `\n\nTerima kasih telah mendukung kami!`,
                { parse_mode: 'Markdown' }
            );
        }
    } catch (error) {
        console.error('❌ [TOPUP] Gagal memproses top up:', error);
    }
}

async function handleRankPurchase(bot, payload) {
    console.log('💎 [RANK] Menerima webhook pembelian rank...');
    const { query, price } = payload;
    const userId = query?.tid;
    const rank = query?.rank;

    if (!userId || !rank) {
        console.warn('⚠️ [RANK] Payload tidak lengkap:', payload);
        return;
    }

    try {
        const [ranks] = await db.query('SELECT price_idr FROM rank_confession_limits WHERE `rank` = ?', [rank]);
        if (ranks.length === 0) {
            return console.warn(`⚠️ [RANK] Rank '${rank}' tidak ditemukan.`);
        }
        const rankData = ranks[0];

        if (parseInt(price) < rankData.price_idr) {
            return console.warn(`⚠️ [RANK] Harga tidak sesuai untuk rank '${rank}'.`);
        }

        await UserRepo.updateUserRank(parseInt(userId), rank);

        await bot.telegram.sendMessage(
            userId,
            `🎉 *Upgrade Berhasil!*\n\nSelamat, rank kamu sekarang adalah *${rank}*!`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error(`❌ [RANK] Gagal memproses pembelian rank untuk user ${userId}:`, error);
    }
}

async function handleDonation(bot, payload) {
    console.log('❤️ [DONATION] Menerima webhook donasi...');
    const { transaction_id, unit, quantity, price } = payload;
    const channelId = process.env.TARGET_CHANNEL_ID;

    if (!transaction_id || !unit || quantity == null || price == null) {
        console.warn('⚠️ [DONATION] Payload tidak lengkap:', payload);
        return;
    }

    try {
        const donation = await Database.saveDonation({
            transactionId: transaction_id,
            supporterName: payload.supporter_name || 'Anonim',
            supporterMessage: payload.supporter_message || null,
            unit,
            quantity: parseInt(quantity),
            price: parseInt(price),
            userId: null,
        });

        if (!donation) {
            console.log(`⏭️ [DONATION] Duplicate transaction_id: ${transaction_id}`);
            return;
        }

        console.log(`✅ [DONATION] Donasi masuk: ${donation.supporter_name}`);

        const notifText =
            `❤️ *Donasi Masuk!*\n\n` +
            `👤 Dari: *${donation.supporter_name}*\n` +
            `☕ Unit: *${donation.quantity}x ${donation.unit}*\n` +
            `💰 Nominal: *${formatRupiah(donation.total_amount)}*` +
            (donation.supporter_message ? `\n💬 _"${donation.supporter_message}"_` : '');

        await bot.telegram.sendMessage(channelId, notifText, { parse_mode: 'Markdown' });

        const adminId = process.env.ADMIN_ID;
        if (adminId) {
            await bot.telegram.sendMessage(adminId, notifText + `\n\n🆔 \`${transaction_id}\``, { parse_mode: 'Markdown' });
        }

    } catch (err) {
        console.error('❌ [DONATION] Error proses webhook:', err);
    }
}
