import express from 'express';
import { db } from '../services/db.js';
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
        // const token = req.headers['x-trakteer-token'] || req.headers['authorization'];
        // console.log('isi token:', token);
        // if (webhookSecret && token !== webhookSecret) {
        //     console.warn('⚠️ [PAYMENT] Webhook ditolak: token tidak valid. token :', token);
        //     return res.status(401).json({ error: 'Unauthorized' });
        // }

        const payload = req.body;
        const { supporter_message } = payload;
        const paymentType = supporter_message && supporter_message.startsWith('UPGRADE;') ? 'rank_purchase' : 'donation';

        if (paymentType === 'rank_purchase') {
            await handleRankPurchase(bot, payload);
        } else {
            await handleDonation(bot, payload);
        }

        return res.status(200).json({ status: 'ok' });
    });

    return router;
}



async function handleRankPurchase(bot, payload) {
    console.log('💎 [RANK] Menerima webhook pembelian rank...');
    const { supporter_message, price } = payload;

    // Format: UPGRADE;{RANK_NAME};{USER_ID}
    const parts = supporter_message.split(';');
    if (parts.length !== 3 || parts[0] !== 'UPGRADE') {
        console.warn('⚠️ [RANK] Format supporter_message tidak valid:', supporter_message);
        return;
    }

    const rank = parts[1];
    const userId = parts[2];

    if (!userId || !rank) {
        console.warn('⚠️ [RANK] Payload (dari message) tidak lengkap:', payload);
        return;
    }

    try {
        const [ranks] = await db.query('SELECT price_idr FROM rank_confession_limits WHERE `rank` = ?', [rank]);
        if (ranks.length === 0) {
            return console.warn(`⚠️ [RANK] Rank '${rank}' tidak ditemukan.`);
        }
        const rankData = ranks[0];

        // Harga dari webhook adalah total, quantity-nya adalah harga / 1000
        const expectedPrice = rankData.price_idr;
        if (parseInt(price) < expectedPrice) {
            return console.warn(`⚠️ [RANK] Harga tidak sesuai untuk rank '${rank}'. Diharapkan: ${expectedPrice}, Diterima: ${price}`);
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
