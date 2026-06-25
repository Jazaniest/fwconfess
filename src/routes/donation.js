import express from 'express';
import { Database } from '../commands/database.js';
import { formatRupiah } from '../utils/formatters.js';
import * as LeaderboardRepo from '../repositories/leaderboard.repo.js';


const router = express.Router();

/**
 * Buat handler webhook donasi.
 * @param {Telegraf} bot - instance bot Telegraf
 * @param {string} channelId - TARGET_CHANNEL_ID
 * @param {string} webhookSecret - secret token dari Trakteer
 */
export function createDonationRouter(bot, channelId, webhookSecret) {

    // POST /donation/donation
    router.post('/donation', express.json(), async (req, res) => {

        // Verifikasi secret token
        const token = req.headers['x-trakteer-token'] || req.headers['authorization'];
        if (webhookSecret && token !== webhookSecret) {
            console.warn('⚠️ [DONASI] Webhook ditolak: token tidak valid');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const payload = req.body;

        // Validasi field wajib
        const { transaction_id, unit, quantity, price } = payload;
        if (!transaction_id || !unit || quantity == null || price == null) {
            console.warn('⚠️ [DONASI] Payload tidak lengkap:', payload);
            return res.status(400).json({ error: 'Payload tidak lengkap' });
        }

        try {
            // Simpan ke database (duplikat diabaikan)
            const donation = await Database.saveDonation({
                transactionId: transaction_id,
                supporterName: payload.supporter_name || 'Anonim',
                supporterMessage: payload.supporter_message || null,
                unit,
                quantity: parseInt(quantity),
                price: parseInt(price),
            });

            // Duplicate transaction → respon 200 tapi tidak kirim notif lagi
            if (!donation) {
                console.log(`⏭️ [DONASI] Duplicate transaction_id: ${transaction_id}`);
                return res.status(200).json({ status: 'duplicate' });
            }

            // Lacak untuk papan peringkat
            // Trakteer meneruskan query params dari URL ke webhook payload
            const userId = payload.query?.tid || payload.tid;
            if (userId) {
                // Skor didasarkan pada jumlah donasi dalam Rupiah
                const score = parseInt(price) * parseInt(quantity);
                await LeaderboardRepo.recordAction(parseInt(userId), 'weekly_donations', score);
            } else {
                console.log('ℹ️ [DONASI] Donasi tanpa telegram_id, tidak masuk leaderboard.');
            }

            console.log(`✅ [DONASI] Donasi masuk: ${donation.supporter_name} — ${donation.quantity}x ${donation.unit}`);

            // Susun pesan notifikasi
            const msgLine = donation.supporter_message
                ? `\n💬 _"${donation.supporter_message}"_`
                : '';

            const notifText =
                `❤️ *Donasi Masuk!*\n\n` +
                `👤 Dari: *${donation.supporter_name}*\n` +
                `☕ Unit: *${donation.quantity}x ${donation.unit}*\n` +
                `💰 Nominal: *${formatRupiah(donation.total_amount)}*` +
                msgLine;

            // Kirim ke channel
            await bot.telegram.sendMessage(channelId, notifText, {
                parse_mode: 'Markdown',
            }).catch(err => console.error('❌ [DONASI] Gagal kirim ke channel:', err.message));

            // Kirim ke admin
            const adminId = process.env.ADMIN_ID;
            if (adminId) {
                await bot.telegram.sendMessage(
                    adminId,
                    notifText + `\n\n🆔 \`${transaction_id}\``,
                    { parse_mode: 'Markdown' }
                ).catch(err => console.error('❌ [DONASI] Gagal kirim ke admin:', err.message));
            }

            return res.status(200).json({ status: 'ok' });

        } catch (err) {
            console.error('❌ [DONASI] Error proses webhook:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    });

    return router;
}