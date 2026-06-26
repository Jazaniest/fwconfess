import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/services/db.js';
import * as ConfessionRepo from '../../src/repositories/confession.repo.js';

async function seedTestUsers() {
  await db.query(`
    INSERT INTO users (telegram_id, username, rank) VALUES
    (1001, 'user_a', 'member'),
    (1002, 'user_b', 'vip'),
    (1003, 'user_c', 'member')
    ON DUPLICATE KEY UPDATE username=VALUES(username);
  `);
}

describe('Confession Repository', () => {
  beforeEach(async () => {
    await db.query('DELETE FROM confessions');
    await db.query('DELETE FROM action_rate_limits');
    await db.query('DELETE FROM users');
    await seedTestUsers();
  });

  describe('saveConfession()', () => {
    it('should save a new confession and return it', async () => {
      const confessionData = {
        telegram_id: 1001,
        message_text: 'Ini adalah menfess tes pertama.',
        channel_message_id: 9001,
        tags: '#test, #coba',
      };

      const savedConfession = await ConfessionRepo.saveConfession(
        confessionData.telegram_id,
        confessionData.message_text,
        confessionData.channel_message_id,
        confessionData.tags
      );

      expect(savedConfession).not.toBeNull();
      expect(savedConfession.telegram_id).toBe(confessionData.telegram_id);
      expect(savedConfession.message_text).toBe(confessionData.message_text);
      expect(savedConfession.tags).toBe(confessionData.tags);
    });
  });

  describe('getConfessionsByUserId()', () => {
    it('should return an array of confessions for a user', async () => {
      await ConfessionRepo.saveConfession(1001, 'Menfess A', 9001, '');
      await ConfessionRepo.saveConfession(1002, 'Menfess B', 9002, '');
      await ConfessionRepo.saveConfession(1001, 'Menfess C', 9003, '');

      const confessions = await ConfessionRepo.getConfessionsByUserId(1001);
      expect(confessions.length).toBe(2);
      expect(confessions[0].message_text).toBe('Menfess C'); // Ordered by date descending
    });

    it('should return an empty array for a user with no confessions', async () => {
      const confessions = await ConfessionRepo.getConfessionsByUserId(1003);
      expect(confessions).toEqual([]);
    });
  });

  describe('getConfessionByChannelMessageId()', () => {
    it('should return the correct confession', async () => {
        await ConfessionRepo.saveConfession(1001, 'Target Menfess', 9005, '');
        const confession = await ConfessionRepo.getConfessionByChannelMessageId(9005);
        expect(confession).not.toBeNull();
        expect(confession.message_text).toBe('Target Menfess');
    });

    it('should return null if not found', async () => {
        const confession = await ConfessionRepo.getConfessionByChannelMessageId(9999);
        expect(confession).toBeNull();
    });
  });

  describe('countRecentConfessions()', () => {
    it('should count confessions within the time window', async () => {
        await ConfessionRepo.recordConfessionSent(1001); // recordConfessionSent adds to action_rate_limits
        await ConfessionRepo.recordConfessionSent(1001);
        // Tunggu 1 detik untuk memastikan entri berikutnya punya timestamp berbeda
        await new Promise(res => setTimeout(res, 1000));
        await ConfessionRepo.recordConfessionSent(1002);

        const windowMs = 60 * 60 * 1000; // 1 jam
        const count = await ConfessionRepo.countRecentConfessions(1001, windowMs);
        expect(count).toBe(2);
    });

    it('should not count confessions outside the time window', async () => {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
        await db.query(
            "INSERT INTO action_rate_limits (telegram_id, action_type, created_at) VALUES (?, 'confess', ?)",
            [1001, twoHoursAgo]
        );
        const windowMs = 1 * 60 * 60 * 1000; // 1 jam
        const count = await ConfessionRepo.countRecentConfessions(1001, windowMs);
        expect(count).toBe(0);
    });
  });
});
