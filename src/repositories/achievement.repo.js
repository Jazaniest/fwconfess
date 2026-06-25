import { db } from '../services/db.js';

/**
 * Membuka achievement untuk pengguna jika belum dimiliki.
 * @param {number} userId ID Telegram pengguna.
 * @param {string} achievementName Nama unik achievement (cth: 'FIRST_CONFESSION').
 * @returns {Promise<object|null>} Data achievement jika berhasil dibuka, null jika sudah dimiliki atau tidak ditemukan.
 */
export async function unlockAchievement(userId, achievementName) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Dapatkan ID achievement dari namanya
    const [achievements] = await connection.query('SELECT id, title, description, icon FROM achievements WHERE name = ?', [achievementName]);
    if (achievements.length === 0) {
      console.warn(`🔒 Achievement dengan nama '${achievementName}' tidak ditemukan.`);
      await connection.rollback();
      return null;
    }
    const achievement = achievements[0];

    // 2. Cek apakah pengguna sudah memiliki achievement ini
    const [existing] = await connection.query(
      'SELECT id FROM user_achievements WHERE user_id = ? AND achievement_id = ?',
      [userId, achievement.id]
    );

    if (existing.length > 0) {
      // Pengguna sudah punya, tidak perlu lakukan apa-apa
      await connection.commit();
      return null;
    }

    // 3. Jika belum, berikan achievement
    await connection.query(
      'INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)',
      [userId, achievement.id]
    );

    await connection.commit();
    console.log(`🎉 Achievement Unlocked: '${achievement.title}' untuk user ${userId}.`);
    return achievement;

  } catch (error) {
    await connection.rollback();
    console.error(`❌ Gagal membuka achievement '${achievementName}' untuk user ${userId}:`, error);
    return null;
  } finally {
    connection.release();
  }
}

/**
 * Mengambil semua achievement yang dimiliki oleh pengguna.
 * @param {number} userId ID Telegram pengguna.
 * @returns {Promise<Array<object>>}
 */
export async function getUserAchievements(userId) {
    const [rows] = await db.query(
        `SELECT a.title, a.icon, a.description
         FROM user_achievements ua
         JOIN achievements a ON ua.achievement_id = a.id
         WHERE ua.user_id = ?
         ORDER BY ua.unlocked_at DESC`,
        [userId]
    );
    return rows;
}
