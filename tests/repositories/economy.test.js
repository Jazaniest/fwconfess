import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as EconomyRepo from '../../src/repositories/economy.repo.js';
import { db } from '../../src/services/db.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup database khusus untuk file tes ini
beforeAll(async () => {
    try {
        const schemaPath = path.join(__dirname, '../schema.sql');
        const schemaSQL = await fs.readFile(schemaPath, 'utf-8');
        const queries = schemaSQL.split(';').filter(q => q.trim() !== '');

        await db.query('SET FOREIGN_KEY_CHECKS = 0;');
        const [tables] = await db.query("SHOW TABLES;");
        for (const table of tables) {
            const tableName = Object.values(table)[0];
            await db.query(`DROP TABLE IF EXISTS ${tableName}`);
        }

        for (const query of queries) {
            await db.query(query);
        }
        await db.query('SET FOREIGN_KEY_CHECKS = 1;');
        console.log('Database untuk economy.test.js disiapkan.');
    } catch (error) {
        console.error("GAGAL SETUP DATABASE:", error);
        process.exit(1);
    }
});

afterAll(async () => {
    await db.end();
});

// Buat user dummy untuk pengujian
const testUser = {
  telegram_id: 12345,
  username: 'testuser',
  gender: 'male',
  origin: 'testland',
  rank: 'member',
};

beforeEach(async () => {
    // Kosongkan tabel dan masukkan data user baru sebelum setiap tes
    await db.query('SET FOREIGN_KEY_CHECKS = 0;');
    await db.query(`TRUNCATE TABLE coin_transactions`);
    await db.query(`TRUNCATE TABLE user_wallets`);
    await db.query(`TRUNCATE TABLE users`);
    await db.query('SET FOREIGN_KEY_CHECKS = 1;');

    await db.query(
        'INSERT INTO users (telegram_id, username, gender, origin, `rank`) VALUES (?, ?, ?, ?, ?)',
        [testUser.telegram_id, testUser.username, testUser.gender, testUser.origin, testUser.rank]
    );
});

describe('Economy Repository', () => {
  it('should create a new wallet for a new user', async () => {
    const wallet = await EconomyRepo.getWallet(testUser.telegram_id);
    expect(wallet).toBeDefined();
    expect(wallet.balance).toBe(0);
  });

  it('should add coins to a user wallet', async () => {
    const success = await EconomyRepo.addCoins(testUser.telegram_id, 100, 'purchase', 'Test purchase');
    expect(success).toBe(true);
    const wallet = await EconomyRepo.getWallet(testUser.telegram_id);
    expect(wallet.balance).toBe(100);
  });

  it('should spend coins from a user wallet if balance is sufficient', async () => {
    await EconomyRepo.addCoins(testUser.telegram_id, 50, 'purchase', 'Initial balance');
    const success = await EconomyRepo.spendCoins(testUser.telegram_id, 20, 'spend_super_hit', 'Test spend');
    expect(success).toBe(true);
    const wallet = await EconomyRepo.getWallet(testUser.telegram_id);
    expect(wallet.balance).toBe(30);
  });

  it('should not spend coins if balance is insufficient', async () => {
    await EconomyRepo.addCoins(testUser.telegram_id, 10, 'purchase', 'Initial balance');
    const success = await EconomyRepo.spendCoins(testUser.telegram_id, 20, 'spend_super_hit', 'Test spend');
    expect(success).toBe(false);
    const wallet = await EconomyRepo.getWallet(testUser.telegram_id);
    expect(wallet.balance).toBe(10);
  });
});
