import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/services/db.js';
import * as EconomyRepo from '../../src/repositories/economy.repo.js';

// Fungsi helper untuk seeding data pengguna
async function seedTestUsers() {
  await db.query(`
    INSERT INTO users (telegram_id, username, rank) VALUES
    (1001, 'user_a', 'member'),
    (1002, 'user_b', 'vip'),
    (2001, 'user_c', 'member')
    ON DUPLICATE KEY UPDATE username=VALUES(username);
  `);
}

describe('Economy Repository', () => {
  beforeEach(async () => {
    // Bersihkan dan seed ulang data sebelum setiap tes
    await db.query('DELETE FROM economy_transactions');
    await db.query('DELETE FROM economy_wallets');
    await db.query('DELETE FROM users');
    await seedTestUsers();
  });

  describe('getWallet()', () => {
    it('should return a new wallet with 0 balance for a new user', async () => {
      const wallet = await EconomyRepo.getWallet(123456); // User ID yang belum ada walletnya
      expect(wallet).not.toBeNull();
      expect(wallet.balance).toBe(0);
    });

    it('should return an existing wallet', async () => {
      // Buat wallet dulu
      await EconomyRepo.addCoins(1001, 50, 'test', 'Initial balance');
      const wallet = await EconomyRepo.getWallet(1001);
      expect(wallet.balance).toBe(50);
    });
  });

  describe('addCoins()', () => {
    it('should add coins to a new wallet', async () => {
      const success = await EconomyRepo.addCoins(2001, 100, 'test', 'Add to new');
      expect(success).toBe(true);
      const wallet = await EconomyRepo.getWallet(2001);
      expect(wallet.balance).toBe(100);
    });

    it('should add coins to an existing wallet', async () => {
      await EconomyRepo.addCoins(1001, 50, 'test', 'Initial');
      const success = await EconomyRepo.addCoins(1001, 75, 'test', 'Add more');
      expect(success).toBe(true);
      const wallet = await EconomyRepo.getWallet(1001);
      expect(wallet.balance).toBe(125);
    });

    it('should record a transaction', async () => {
      await EconomyRepo.addCoins(1001, 100, 'purchase', 'Test purchase');
      const [transactions] = await db.query('SELECT * FROM economy_transactions WHERE user_id = ?', [1001]);
      expect(transactions.length).toBe(1);
      expect(transactions[0].amount).toBe(100);
      expect(transactions[0].type).toBe('income');
      expect(transactions[0].reason).toBe('purchase');
    });
  });

  describe('spendCoins()', () => {
    beforeEach(async () => {
      await EconomyRepo.addCoins(1001, 200, 'test', 'Setup for spending');
    });

    it('should return false if balance is insufficient', async () => {
      const success = await EconomyRepo.spendCoins(1001, 250, 'test', 'Too expensive');
      expect(success).toBe(false);
      const wallet = await EconomyRepo.getWallet(1001);
      expect(wallet.balance).toBe(200); // Saldo tidak berubah
    });

    it('should return true and decrease balance if funds are sufficient', async () => {
      const success = await EconomyRepo.spendCoins(1001, 75, 'test', 'Affordable');
      expect(success).toBe(true);
      const wallet = await EconomyRepo.getWallet(1001);
      expect(wallet.balance).toBe(125);
    });

    it('should record a transaction on successful spend', async () => {
      await EconomyRepo.spendCoins(1001, 75, 'spend_item', 'Test spend');
      const [transactions] = await db.query('SELECT * FROM economy_transactions WHERE user_id = ? AND type = ?', [1001, 'expense']);
      expect(transactions.length).toBe(1);
      expect(transactions[0].amount).toBe(-75);
      expect(transactions[0].reason).toBe('spend_item');
    });

    it('should not record a transaction on failed spend', async () => {
      await EconomyRepo.spendCoins(1001, 300, 'test', 'Fail spend');
      const [transactions] = await db.query('SELECT * FROM economy_transactions WHERE user_id = ? AND type = ?', [1001, 'expense']);
      expect(transactions.length).toBe(0);
    });
  });
});
