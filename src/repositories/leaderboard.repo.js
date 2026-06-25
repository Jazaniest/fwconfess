import { db } from '../services/db.js';
import { getWeek } from 'date-fns';

/**
 * Mencatat sebuah aksi yang akan dihitung di papan peringkat.
 * @param {number} userId ID Telegram pengguna.
 * @param {'weekly_confessions' | 'weekly_donations' | 'weekly_hitme_received'} type Jenis aksi.
 * @param {number} score Nilai yang akan ditambahkan.
 */
export async function recordAction(userId, type, score = 1) {
  if (!userId || !type) return;

  const now = new Date();
  const weekOfYear = getWeek(now, { weekStartsOn: 1 }); // Minggu dimulai hari Senin
  const year = now.getFullYear();

  try {
    const query = `
      INSERT INTO leaderboards (user_id, type, score, week_of_year, year)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE score = score + VALUES(score);
    `;
    await db.query(query, [userId, type, score, weekOfYear, year]);
    console.log(`🏆 Leaderboard: Aksi '${type}' untuk user ${userId} berhasil dicatat.`);
  } catch (error) {
    console.error(`❌ Gagal mencatat aksi leaderboard untuk user ${userId}:`, error);
  }
}
