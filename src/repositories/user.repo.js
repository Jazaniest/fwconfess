import { db } from '../services/db.js';

/**
 * Daftarkan user baru ke database
 */
export async function createUser(telegramId, username, gender, origin) {
  await db.query(
    'INSERT INTO `users` (`telegram_id`, `username`, `gender`, `origin`, `rank`, `registered_at`) VALUES (?, ?, ?, ?, ?, NOW())',
    [telegramId, username, gender, origin, 'member']
  );
}

/**
 * Get user data by telegram ID
 */
export async function getUserById(telegramId) {
  const [rows] = await db.query(
    'SELECT `telegram_id`, `rank`, `gender`, `origin` FROM `users` WHERE `telegram_id` = ?',
    [telegramId]
  );
  return rows[0] || null;
}

/**
 * Get full user profile including registration date
 */
export async function getUserFullProfile(telegramId) {
  const [rows] = await db.query(
    'SELECT `telegram_id`, `rank`, `gender`, `origin`, `registered_at`, `is_active` FROM `users` WHERE `telegram_id` = ?',
    [telegramId]
  );
  return rows[0] || null;
}

/**
 * Ambil daftar user dengan pagination
 */
export async function getUsersPaginated(limit = 10, offset = 0) {
  const [rows] = await db.query(
    `SELECT u.telegram_id, u.username, u.rank, u.gender, u.origin, u.registered_at, u.is_active,
            COUNT(c.id) AS total_confessions
    FROM \`users\` u
    LEFT JOIN \`confessions\` c ON u.telegram_id = c.telegram_id
    GROUP BY u.telegram_id
    ORDER BY u.registered_at DESC
    LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return rows;
}

/**
 * Hitung total user
 */
export async function countAllUsers() {
  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM `users`');
  return total;
}

/**
 * Hitung total user (alias untuk admin stats)
 */
export async function getTotalUsers() {
  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM `users`');
  return total;
}

/**
 * Cari user berdasarkan telegram_id atau username
 */
export async function searchUsers(query, limit = 10, offset = 0) {
  const isNumeric = /^\d+$/.test(query.trim());
  let rows;

  if (isNumeric) {
    [rows] = await db.query(
      `SELECT u.telegram_id, u.username, u.rank, u.gender, u.origin, u.registered_at, u.is_active,
              COUNT(c.id) AS total_confessions
      FROM \`users\` u
      LEFT JOIN \`confessions\` c ON u.telegram_id = c.telegram_id
      WHERE u.telegram_id = ?
      GROUP BY u.telegram_id
      LIMIT ? OFFSET ?`,
      [parseInt(query.trim()), limit, offset]
    );
  } else {
    const like = `%${query.trim()}%`;
    [rows] = await db.query(
      `SELECT u.telegram_id, u.username, u.rank, u.gender, u.origin, u.registered_at, u.is_active,
              COUNT(c.id) AS total_confessions
      FROM \`users\` u
      LEFT JOIN \`confessions\` c ON u.telegram_id = c.telegram_id
      WHERE u.username LIKE ?
      GROUP BY u.telegram_id
      LIMIT ? OFFSET ?`,
      [like, limit, offset]
    );
  }
  return rows;
}

/**
 * Hitung hasil pencarian user
 */
export async function countSearchUsers(query) {
  const isNumeric = /^\d+$/.test(query.trim());
  let total;
  if (isNumeric) {
    [[{ total }]] = await db.query(
      'SELECT COUNT(*) AS total FROM `users` WHERE `telegram_id` = ?',
      [parseInt(query.trim())]
    );
  } else {
    const like = `%${query.trim()}%`;
    [[{ total }]] = await db.query(
      'SELECT COUNT(*) AS total FROM `users` WHERE `username` LIKE ?',
      [like]
    );
  }
  return total;
}

/**
 * Ambil daftar user yang di-ban (is_active = 0) dengan pagination
 */
export async function getBannedUsersPaginated(limit = 10, offset = 0) {
  const [rows] = await db.query(
    `SELECT telegram_id, username, \`rank\`, gender, origin, registered_at
    FROM \`users\`
    WHERE \`is_active\` = 0
    ORDER BY \`registered_at\` DESC
    LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return rows;
}

/**
 * Hitung user yang di-ban (is_active = 0)
 */
export async function getBannedUsersCount() {
  const [[{ total }]] = await db.query(
    'SELECT COUNT(*) AS total FROM `users` WHERE `is_active` = 0'
  );
  return total;
}

/**
 * Hitung user baru dalam rentang waktu tertentu
 */
export async function countNewUsers() {
  const [[d1]] = await db.query(
    "SELECT COUNT(*) AS total FROM `users` WHERE `registered_at` >= NOW() - INTERVAL 1 DAY"
  );
  const [[d7]] = await db.query(
    "SELECT COUNT(*) AS total FROM `users` WHERE `registered_at` >= NOW() - INTERVAL 7 DAY"
  );
  const [[d30]] = await db.query(
    "SELECT COUNT(*) AS total FROM `users` WHERE `registered_at` >= NOW() - INTERVAL 30 DAY"
  );
  return { day1: d1.total, day7: d7.total, day30: d30.total };
}

/**
 * Hitung user yang register hari ini
 */
export async function getActiveUsersToday() {
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM \`users\`
      WHERE DATE(\`registered_at\`) = CURDATE()`
  );
  return total;
}

/**
 * Update rank user
 */
export async function updateUserRank(telegramId, rank) {
  await db.query(
    'UPDATE `users` SET `rank` = ? WHERE `telegram_id` = ?',
    [rank, telegramId]
  );
}

/**
 * Set user active status
 */
export async function setUserActive(telegramId, isActive) {
  await db.query(
    'UPDATE `users` SET `is_active` = ? WHERE `telegram_id` = ?',
    [isActive ? 1 : 0, telegramId]
  );
}

/**
 * Update username
 */
export async function updateUsername(telegramId, username) {
  await db.query(
    'UPDATE `users` SET `username` = ? WHERE `telegram_id` = ?',
    [username, telegramId]
  );
}

/**
 * Top 5 user berdasarkan jumlah action tertentu (confess / hitme / showme)
 */
export async function getTopUsersByAction(actionType, limit = 5) {
  const [rows] = await db.query(
    `SELECT u.telegram_id, u.username, u.rank, COUNT(a.id) AS total
    FROM \`action_rate_limits\` a
    JOIN \`users\` u ON a.telegram_id = u.telegram_id
    WHERE a.action_type = ?
    GROUP BY a.telegram_id
    ORDER BY total DESC
    LIMIT ?`,
    [actionType, limit]
  );
  return rows;
}

/**
 * Get total confessions by user
 */
export async function getTotalUserConfessions(telegramId) {
  const [[{ total }]] = await db.query(
    'SELECT COUNT(*) AS total FROM `confessions` WHERE `telegram_id` = ?',
    [telegramId]
  );
  return total;
}