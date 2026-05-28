import { db } from '../services/db.js';

/**
 * Cek apakah user sedang dalam ban aktif.
 * Otomatis handle expired temporary ban.
 */
export async function getActiveBan(telegramId) {
  // Expire dulu ban yang sudah lewat waktunya
  await db.query(
    `UPDATE \`user_bans\` SET \`is_active\` = 0, \`unbanned_at\` = NOW()
    WHERE \`telegram_id\` = ? AND \`is_active\` = 1
      AND \`ban_type\` = 'temporary' AND \`expires_at\` <= NOW()`,
    [telegramId]
  );

  const [rows] = await db.query(
    `SELECT * FROM \`user_bans\`
    WHERE \`telegram_id\` = ? AND \`is_active\` = 1
    ORDER BY \`banned_at\` DESC LIMIT 1`,
    [telegramId]
  );

  // Sync is_active di tabel users
  // if (rows.length === 0) {
  //   await db.query(
  //     'UPDATE `users` SET `is_active` = 1 WHERE `telegram_id` = ? AND `is_active` = 0',
  //     [telegramId]
  //   );
  // }

  return rows[0] || null;
}

/**
 * Ban user (permanent atau temporary)
 * @param {number} telegramId
 * @param {'permanent'|'temporary'} banType
 * @param {string|null} reason
 * @param {Date|null} expiresAt - null untuk permanent
 * @param {number} bannedBy - telegram ID admin
 */
export async function createBan(telegramId, banType, reason, expiresAt, bannedBy) {
  // Nonaktifkan ban lama jika ada
  await db.query(
    'UPDATE `user_bans` SET `is_active` = 0 WHERE `telegram_id` = ? AND `is_active` = 1',
    [telegramId]
  );

  const [result] = await db.query(
    `INSERT INTO \`user_bans\`
      (\`telegram_id\`, \`ban_type\`, \`reason\`, \`expires_at\`, \`banned_by\`)
    VALUES (?, ?, ?, ?, ?)`,
    [telegramId, banType, reason || null, expiresAt || null, bannedBy]
  );

  // Update cache di tabel users
  await db.query(
    'UPDATE `users` SET `is_active` = 0 WHERE `telegram_id` = ?',
    [telegramId]
  );

  const [rows] = await db.query(
    'SELECT * FROM `user_bans` WHERE `id` = ?',
    [result.insertId]
  );
  return rows[0];
}

/**
 * Unban user (manual)
 * @param {number} telegramId
 * @param {number} unbannedBy - telegram ID admin
 */
export async function removeBan(telegramId, unbannedBy) {
  await db.query(
    `UPDATE \`user_bans\`
    SET \`is_active\` = 0, \`unbanned_at\` = NOW(), \`unbanned_by\` = ?
    WHERE \`telegram_id\` = ? AND \`is_active\` = 1`,
    [unbannedBy, telegramId]
  );

  await db.query(
    'UPDATE `users` SET `is_active` = 1 WHERE `telegram_id` = ?',
    [telegramId]
  );
}

/**
 * Alias — beberapa caller masih memakai nama lama
 */
export async function unbanUser(telegramId) {
  await db.query(
    'UPDATE `users` SET `is_active` = 1 WHERE `telegram_id` = ?',
    [telegramId]
  );
}

/**
 * Riwayat ban user
 */
export async function getBanHistory(telegramId, limit = 5) {
  const [rows] = await db.query(
    `SELECT * FROM \`user_bans\`
    WHERE \`telegram_id\` = ?
    ORDER BY \`banned_at\` DESC
    LIMIT ?`,
    [telegramId, limit]
  );
  return rows;
}

/**
 * Hitung total ban aktif (untuk stats)
 */
export async function getActiveBansCount() {
  // Expire dulu yang sudah lewat
  await db.query(
    `UPDATE \`user_bans\` SET \`is_active\` = 0, \`unbanned_at\` = NOW()
    WHERE \`is_active\` = 1 AND \`ban_type\` = 'temporary' AND \`expires_at\` <= NOW()`
  );
  const [[{ total }]] = await db.query(
    'SELECT COUNT(*) AS total FROM `user_bans` WHERE `is_active` = 1'
  );
  return total;
}

/**
 * Alias untuk backward compat
 */
export async function createBanRecord(telegramId, banType, reason, expiresAt, bannedBy) {
  return createBan(telegramId, banType, reason, expiresAt, bannedBy);
}