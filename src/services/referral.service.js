import { Database } from '../commands/database.js';
import * as EconomyRepo from '../repositories/economy.repo.js';

/**
 * Memproses dan memberikan reward referral setelah pengguna baru mendaftar.
 * @param {object} newUser - Objek pengguna yang baru mendaftar. Harus berisi `telegram_id` dan `referrer_id`.
 */
export async function processReferralRewards(newUser) {
  if (!newUser || !newUser.referrer_id) {
    console.log(`[REFERRAL] Pengguna baru ${newUser.telegram_id} tidak memiliki referrer. Skipping.`);
    return;
  }

  const featureEnabled = await Database.getConfig('feature_referral_enabled', '0');
  if (featureEnabled !== '1') {
    console.log('[REFERRAL] Fitur referral sedang nonaktif. Skipping.');
    return;
  }

  console.log(`[REFERRAL] Memproses reward untuk pendaftaran ${newUser.telegram_id} dengan referrer ${newUser.referrer_id}`);

  try {
    const rewardsConfig = await Database.getAllReferralRewards(); // Perlu dibuat
    const cofounderReward = parseFloat(await Database.getConfig('referral_cofounder_reward', '1'));

    let currentReferrerId = newUser.referrer_id;
    let cofounderFound = null;

    // 1. Proses reward publik (5 level)
    for (let level = 1; level <= 5; level++) {
      if (!currentReferrerId) break;

      const referrer = await Database.getUserById(currentReferrerId);
      if (!referrer) break; // Berhenti jika referrer tidak ditemukan

      const rewardConfig = rewardsConfig.find(r => r.level === level);
      if (rewardConfig && rewardConfig.reward_amount > 0) {
        const rewardAmount = parseFloat(rewardConfig.reward_amount);
        await EconomyRepo.addCoins(
          referrer.telegram_id,
          rewardAmount,
          'referral_bonus',
          `Bonus referral level ${level} dari user ${newUser.telegram_id}`
        );

        await Database.recordReferralPayout(referrer.telegram_id, newUser.telegram_id, level, rewardAmount); // Perlu dibuat
        console.log(`[REFERRAL] Memberikan ${rewardAmount} koin ke ${referrer.telegram_id} (Level ${level})`);
      }

      // Cek apakah referrer ini adalah co-founder
      if (referrer.is_cofounder) {
        cofounderFound = referrer;
      }

      currentReferrerId = referrer.referrer_id;
    }

    // 2. Proses reward co-founder (jika ada)
    // Jika co-founder sudah ditemukan dalam 5 level pertama
    if (cofounderFound) {
      await giveCofounderReward(cofounderFound, newUser, cofounderReward);
    } else {
      // Jika tidak, lanjutkan pencarian ke atas
      while (currentReferrerId) {
        const upline = await Database.getUserById(currentReferrerId);
        if (!upline) break;
        if (upline.is_cofounder) {
          await giveCofounderReward(upline, newUser, cofounderReward);
          break; // Berhenti setelah co-founder pertama ditemukan
        }
        currentReferrerId = upline.referrer_id;
      }
    }

  } catch (error) {
    console.error(`❌ [REFERRAL] Gagal memproses reward untuk user ${newUser.telegram_id}:`, error);
  }
}

/**
 * Helper untuk memberikan reward ke co-founder
 */
async function giveCofounderReward(cofounder, newUser, rewardAmount) {
    if (rewardAmount > 0) {
        await EconomyRepo.addCoins(
            cofounder.telegram_id,
            rewardAmount,
            'cofounder_bonus',
            `Bonus co-founder dari pendaftaran user ${newUser.telegram_id}`
        );
        await Database.recordReferralPayout(cofounder.telegram_id, newUser.telegram_id, -1, rewardAmount); // Level -1 untuk co-founder
        console.log(`[REFERRAL] Memberikan bonus co-founder ${rewardAmount} koin ke ${cofounder.telegram_id}`);
    }
}
