import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { db } from '../../src/services/db.js';
import * as RankRepo from '../../src/repositories/rank.repo.js';
import * as UserRepo from '../../src/repositories/user.repo.js';
import { handleExpiredSubscriptions } from '../../src/jobs/subscription-cleanup.js';

// Helper function to sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

describe('Rank System Feature', () => {

    // Clean up all tables before starting
    beforeEach(async () => {
        await db.query('SET FOREIGN_KEY_CHECKS = 0');
        await db.query('TRUNCATE TABLE users');
        await db.query('TRUNCATE TABLE ranks');
        await db.query('TRUNCATE TABLE wallets');
        await db.query('SET FOREIGN_KEY_CHECKS = 1');
    });

    afterAll(async () => {
        await db.end();
    });

    describe('Admin CRUD Operations', () => {
        it('should create a new permanent rank', async () => {
            const rankData = {
                name: 'Gold',
                type: 'permanent',
                price_coins: 100,
                price_currency: 10000,
                confession_limit: 10,
            };
            const result = await RankRepo.createRank(rankData);
            expect(result.insertId).toBeGreaterThan(0);

            const [rows] = await db.query('SELECT * FROM ranks WHERE id = ?', [result.insertId]);
            expect(rows.length).toBe(1);
            expect(rows[0].name).toBe('Gold');
            expect(rows[0].type).toBe('permanent');
            expect(rows[0].duration_days).toBeNull();
        });

        it('should create a new subscription rank', async () => {
            const rankData = {
                name: 'VIP',
                type: 'subscription',
                duration_days: 30,
                price_coins: 50,
                price_currency: 5000,
                confession_limit: 20,
            };
            const result = await RankRepo.createRank(rankData);
            expect(result.insertId).toBeGreaterThan(0);

            const [rows] = await db.query('SELECT * FROM ranks WHERE id = ?', [result.insertId]);
            expect(rows[0].name).toBe('VIP');
            expect(rows[0].type).toBe('subscription');
            expect(rows[0].duration_days).toBe(30);
        });
    });

    describe('User Rank Purchase and Expiration', () => {
        let testUser;
        let subscriptionRank;

        beforeEach(async () => {
            // Create a user
            [testUser] = await UserRepo.createUser({ telegram_id: 12345, username: 'testuser' });
            await EconomyRepo.createWallet(testUser.insertId);

            // Create a subscription rank
            const rankData = { name: 'VIP', type: 'subscription', duration_days: 30, price_coins: 50 };
            [subscriptionRank] = await RankRepo.createRank(rankData);
        });

        it('should allow a user to buy a subscription rank with coins', async () => {
            // Give user enough coins
            await EconomyRepo.updateWalletBalance(testUser.insertId, 100);

            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

            await UserRepo.assignRank({ userId: 12345, rankId: subscriptionRank.insertId, expiresAt });

            const [updatedUser] = await UserRepo.getUserById(12345);
            expect(updatedUser.rank_id).toBe(subscriptionRank.insertId);
            expect(updatedUser.rank_expires_at).toBeDefined();
            // Check if expiration is roughly correct (within a minute)
            expect(Math.abs(new Date(updatedUser.rank_expires_at) - expiresAt)).toBeLessThan(60000);
        });

        it('should reset rank after subscription expires', async () => {
            // Give a user a rank that expires in the past
            const pastDate = new Date(Date.now() - 1000);
            await UserRepo.assignRank({ userId: 12345, rankId: subscriptionRank.insertId, expiresAt: pastDate });

            let userWithRank = await UserRepo.getUserById(12345);
            expect(userWithRank.rank_id).toBe(subscriptionRank.insertId);

            // Mock bot object for the job
            const mockBot = {
                telegram: {
                    sendMessage: () => Promise.resolve(true)
                }
            };

            // Run the cleanup job
            await handleExpiredSubscriptions(mockBot);

            const userAfterJob = await UserRepo.getUserById(12345);
            expect(userAfterJob.rank_id).toBeNull();
            expect(userAfterJob.rank_expires_at).toBeNull();
        });
    });
});
