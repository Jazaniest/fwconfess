import express from 'express';
import { db } from '../services/db.js';
import * as UserRepo from '../repositories/user.repo.js';

export function createAdWebhookRouter(bot) {
    const router = express.Router();

    router.post('/iklan-selesai', express.json(), async (req, res) => {
        const { token, secret } = req.body;
        const webhookSecret = process.env.AD_CALLBACK_SECRET;

        // 1. Validasi secret dari website
        if (!webhookSecret || secret !== webhookSecret) {
            console.warn('⚠️ [AD_WEBHOOK] Request ditolak: secret tidak valid.');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!token) {
            console.warn('⚠️ [AD_WEBHOOK] Request ditolak: token tidak ada.');
            return res.status(400).json({ error: 'Bad Request: Missing token' });
        }

        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();

            // 2. Cari token di database
            const [tokens] = await connection.query(
                'SELECT `id`, `user_id`, `status` FROM `ad_view_tokens` WHERE `token` = ? AND `expires_at` > NOW() FOR UPDATE',
                [token]
            );

            if (tokens.length === 0) {
                await connection.rollback();
                console.log(`[AD_WEBHOOK] Token tidak valid atau kedaluwarsa: ${token}`);
                return res.status(404).json({ error: 'Token not found or expired' });
            }

            const tokenData = tokens[0];

            if (tokenData.status !== 'pending') {
                await connection.rollback();
                console.log(`[AD_WEBHOOK] Token sudah pernah diklaim: ${token}`);
                return res.status(409).json({ error: 'Token already claimed' });
            }

            // 3. Update status token menjadi 'claimed'
            await connection.query(
                'UPDATE `ad_view_tokens` SET `status` = "claimed" WHERE `id` = ?',
                [tokenData.id]
            );

            // 4. Tambah saldo menfess gratis ke user
            await UserRepo.incrementFreeMenfessBalance(tokenData.user_id, 1);

            // 5. Catat riwayat tontonan
            await connection.query(
                'INSERT INTO `ad_view_history` (`user_id`) VALUES (?)',
                [tokenData.user_id]
            );

            await connection.commit(); // Selesaikan transaksi

            console.log(`✅ [AD_WEBHOOK] Hadiah menfess gratis diberikan ke user ${tokenData.user_id} untuk token ${token}`);

            // 6. Kirim notifikasi ke user (opsional, tapi sangat direkomendasikan)
            bot.telegram.sendMessage(
                tokenData.user_id,
                '🎉 Selamat! Kamu telah menerima 1 menfess gratis. Kamu bisa langsung mengirim menfess tanpa terkena limit harian.'
            ).catch(e => console.error(`[AD_WEBHOOK] Gagal kirim notifikasi ke ${tokenData.user_id}: ${e.message}`));


            return res.status(200).json({ status: 'success' });

        } catch (error) {
            await connection.rollback();
            console.error(`❌ [AD_WEBHOOK] Gagal memproses token ${token}:`, error);
            return res.status(500).json({ error: 'Internal Server Error' });
        } finally {
            connection.release();
        }
    });

    return router;
}
