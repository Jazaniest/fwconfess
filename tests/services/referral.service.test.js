import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/services/db.js';
import * as EconomyRepo from '../../src/repositories/economy.repo.js';
import { processReferralRewards } from '../../src/services/referral.service.js';

describe('Referral Service', () => {
  beforeEach(async () => {
    // Bersihkan semua tabel yang relevan
    await db.query('DELETE FROM referral_payouts');
    await db.query('DELETE FROM economy_wallets');
    await db.query('DELETE FROM economy_transactions');
    await db.query('DELETE FROM users');
    await db.query('DELETE FROM referral_rewards');
    await db.query('DELETE FROM bot_config WHERE `key` LIKE "feature_referral_enabled" OR `key` LIKE "referral_cofounder_reward"');

    // Setup konfigurasi tes
    await db.query("INSERT INTO bot_config (`key`, `value`) VALUES ('feature_referral_enabled', '1')");
    await db.query("INSERT INTO bot_config (`key`, `value`) VALUES ('referral_cofounder_reward', '1')");
    await db.query("INSERT INTO referral_rewards (`level`, `reward_amount`) VALUES (1, 0.5), (2, 0.4), (3, 0.3), (4, 0.2), (5, 0.1)");
  });

  /**
   * Membuat struktur referral:
   * cofounder (id: 1) -> level1 (id: 10) -> level2 (id: 20) -> level3 (id: 30) -> level4 (id: 40) -> level5 (id: 50)
   * newUser (id: 60) direferensikan oleh level5
   */
  async function seedReferralTree() {
    await db.query("INSERT INTO users (telegram_id, username, is_cofounder) VALUES (1, 'cofounder', 1)");
    await db.query("INSERT INTO users (telegram_id, username, referrer_id) VALUES (10, 'level1', 1)");
    await db.query("INSERT INTO users (telegram_id, username, referrer_id) VALUES (20, 'level2', 10)");
    await db.query("INSERT INTO users (telegram_id, username, referrer_id) VALUES (30, 'level3', 20)");
    await db.query("INSERT INTO users (telegram_id, username, referrer_id) VALUES (40, 'level4', 30)");
    await db.query("INSERT INTO users (telegram_id, username, referrer_id) VALUES (50, 'level5', 40)");
  }

  it('should distribute rewards to 5 upline levels correctly', async () => {
    await seedReferralTree();
    const newUser = { telegram_id: 60, referrer_id: 50 };

    await processReferralRewards(newUser);

    // Cek saldo uplines
    const walletL5 = await EconomyRepo.getWallet(50); // Level 1 -> 0.5
    const walletL4 = await EconomyRepo.getWallet(40); // Level 2 -> 0.4
    const walletL3 = await EconomyRepo.getWallet(30); // Level 3 -> 0.3
    const walletL2 = await EconomyRepo.getWallet(20); // Level 4 -> 0.2
    const walletL1 = await EconomyRepo.getWallet(10); // Level 5 -> 0.1

    expect(walletL5.balance).toBe(0.5);
    expect(walletL4.balance).toBe(0.4);
    expect(walletL3.balance).toBe(0.3);
    expect(walletL2.balance).toBe(0.2);
    expect(walletL1.balance).toBe(0.1);
  });

  it('should give a bonus to the co-founder in the upline tree', async () => {
    await seedReferralTree();
    const newUser = { telegram_id: 60, referrer_id: 50 };

    await processReferralRewards(newUser);

    // Co-founder adalah upline level 6, jadi dia dapat bonus co-founder
    const cofounderWallet = await EconomyRepo.getWallet(1);
    expect(cofounderWallet.balance).toBe(1);
  });

  it('should not distribute rewards if the feature is disabled', async () => {
    await db.query("UPDATE bot_config SET `value` = '0' WHERE `key` = 'feature_referral_enabled'");
    await seedReferralTree();
    const newUser = { telegram_id: 60, referrer_id: 50 };

    await processReferralRewards(newUser);

    const walletL5 = await EconomyRepo.getWallet(50);
    expect(walletL5.balance).toBe(0);
    const cofounderWallet = await EconomyRepo.getWallet(1);
    expect(cofounderWallet.balance).toBe(0);
  });

  it('should stop distributing rewards if an upline is not found', async () => {
    // level3 (id: 30) mereferensikan level5 (id: 50)
    // Seharusnya hanya level 1, 2, 3 yang dapat reward
    await db.query("INSERT INTO users (telegram_id, username, referrer_id) VALUES (10, 'level1', null)");
    await db.query("INSERT INTO users (telegram_id, username, referrer_id) VALUES (20, 'level2', 10)");
    await db.query("INSERT INTO users (telegram_id, username, referrer_id) VALUES (30, 'level3', 20)");

    const newUser = { telegram_id: 40, referrer_id: 30 };
    await processReferralRewards(newUser);

    const walletL3 = await EconomyRepo.getWallet(30); // Level 1 -> 0.5
    const walletL2 = await EconomyRepo.getWallet(20); // Level 2 -> 0.4
    const walletL1 = await EconomyRepo.getWallet(10); // Level 3 -> 0.3

    expect(walletL3.balance).toBe(0.5);
    expect(walletL2.balance).toBe(0.4);
    expect(walletL1.balance).toBe(0.3);
  });

  it('should record all payouts in referral_payouts table', async () => {
    await seedReferralTree();
    const newUser = { telegram_id: 60, referrer_id: 50 };
    await processReferralRewards(newUser);

    const [payouts] = await db.query('SELECT * FROM referral_payouts');
    expect(payouts.length).toBe(6); // 5 level + 1 co-founder

    const cofounderPayout = payouts.find(p => p.recipient_id === 1);
    expect(cofounderPayout.level).toBe(-1); // Level co-founder ditandai -1
    expect(cofounderPayout.reward_amount).toBe(1);

    const level1Payout = payouts.find(p => p.level === 1);
    expect(level1Payout.recipient_id).toBe(50);
    expect(level1Payout.reward_amount).toBe(0.5);
  });
});
