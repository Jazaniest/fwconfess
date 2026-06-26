import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/services/db.js';
import * as ConfigRepo from '../../src/repositories/config.repo.js';

describe('Config Repository', () => {
  beforeEach(async () => {
    await db.query('DELETE FROM bot_config');
    await db.query('DELETE FROM rank_confession_limits');
    await db.query('DELETE FROM referral_rewards');
    // Seed data
    await db.query("INSERT INTO bot_config (`key`, `value`) VALUES ('test_key', 'test_value')");
    await db.query("INSERT INTO rank_confession_limits (`rank`, `price_coins`, `price_idr`) VALUES ('vip', 100, 100000)");
    await db.query("INSERT INTO referral_rewards (`level`, `reward_amount`) VALUES (1, 0.5)");
  });

  describe('getConfig() and setConfig()', () => {
    it('should get an existing config value', async () => {
      const value = await ConfigRepo.getConfig('test_key');
      expect(value).toBe('test_value');
    });

    it('should return default value for non-existing key', async () => {
      const value = await ConfigRepo.getConfig('non_existing', 'default');
      expect(value).toBe('default');
    });

    it('should set a new config value', async () => {
      await ConfigRepo.setConfig('new_key', 'new_value');
      const value = await ConfigRepo.getConfig('new_key');
      expect(value).toBe('new_value');
    });

    it('should update an existing config value', async () => {
      await ConfigRepo.setConfig('test_key', 'updated_value');
      const value = await ConfigRepo.getConfig('test_key');
      expect(value).toBe('updated_value');
    });
  });

  describe('Rank Prices', () => {
    it('should update rank prices', async () => {
      await ConfigRepo.updateRankPrices('vip', 150, 150000);
      const [rows] = await db.query("SELECT * FROM rank_confession_limits WHERE `rank` = 'vip'");
      expect(rows[0].price_coins).toBe(150);
      expect(rows[0].price_idr).toBe(150000);
    });
  });

  describe('Referral Rewards', () => {
    it('should get all referral rewards', async () => {
      await db.query("INSERT INTO referral_rewards (`level`, `reward_amount`) VALUES (2, 0.4)");
      const rewards = await ConfigRepo.getAllReferralRewards();
      expect(rewards.length).toBe(2);
    });

    it('should update a referral reward for a specific level', async () => {
      await ConfigRepo.updateReferralReward(1, 0.6);
      const [rows] = await db.query("SELECT * FROM referral_rewards WHERE `level` = 1");
      expect(rows[0].reward_amount).toBe(0.6);
    });
  });
});
