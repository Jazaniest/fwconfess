import { db } from '../services/db.js';
import * as UserRepo from '../repositories/user.repo.js';

/**
 * Finds users with expired subscription ranks and resets their rank.
 * This job should be scheduled to run periodically (e.g., daily).
 */
export async function handleExpiredSubscriptions(bot) {
    console.log('⏳ [JOB] Running expired subscriptions cleanup...');
    let processedCount = 0;

    try {
        const [expiredUsers] = await db.query(
            "SELECT telegram_id, rank_id FROM users WHERE rank_expires_at IS NOT NULL AND rank_expires_at < NOW()"
        );

        if (expiredUsers.length === 0) {
            console.log('✅ [JOB] No expired subscriptions found.');
            return;
        }

        console.log(`ℹ️ [JOB] Found ${expiredUsers.length} user(s) with expired ranks.`);

        for (const user of expiredUsers) {
            try {
                // Reset rank by setting rank_id and expires_at to NULL
                await UserRepo.assignRank({ userId: user.telegram_id, rankId: null, expiresAt: null });

                // Notify the user
                await bot.telegram.sendMessage(
                    user.telegram_id,
                    '🔔 Peringatan Rank!\n\nLangganan rank premium kamu telah berakhir. Kamu sekarang kembali menjadi member biasa. Perpanjang rank kamu untuk tetap menikmati keuntungannya!'
                ).catch(e => console.warn(`[JOB] Failed to send expiration notice to ${user.telegram_id}: ${e.message}`));

                processedCount++;
            } catch (error) {
                console.error(`❌ [JOB] Failed to process expiration for user ${user.telegram_id}:`, error);
            }
        }

        console.log(`✅ [JOB] Finished subscription cleanup. Processed ${processedCount} user(s).`);

    } catch (error) {
        console.error('❌ [JOB] An error occurred during the subscription cleanup job:', error);
    }
}
