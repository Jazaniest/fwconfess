/**
 * User repository — semua query terkait user, profile, privacy.
 * Phase 2: extracted from commands/database.js
 */
import { db } from '../services/db.js';

export async function getUserById(telegramId) {
  const [rows] = await db.query(
    'SELECT `telegram_id`, `rank`, `gender`, `origin`, `username`, `hide_username`, `hide_gender`, `hide_origin` FROM `users` WHERE `telegram_id` = ?',
    [telegramId]
  );
  return rows[0] || null;
}

export async function getUserFullProfile(telegramId) {
  const [rows] = await db.query(
    'SELECT `telegram_id`, `rank`, `gender`, `origin`, `registered_at`, `is_active` FROM `users` WHERE `telegram_id` = ?',
    [telegramId]
  );
  return rows[0] || null;
}

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

export async function countAllUsers() {
  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM `users`');
  return total;
}

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

export async function countSearchUsers(query) {
  const isNumeric = /^\d+$/.test(query.trim());
  let rows;
  if (isNumeric) {
    [[{ total: rows }]] = await db.query(
      'SELECT COUNT(*) AS total FROM `users` WHERE `telegram_id` = ?',
      [parseInt(query.trim())]
    );
  } else {
    const like = `%${query.trim()}%`;
    [[{ total: rows }]] = await db.query(
      'SELECT COUNT(*) AS total FROM `users` WHERE `username` LIKE ?',
      [like]
    );
  }
  return rows;
}

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

export async function getActiveUsersToday() {
  const [[{ total }]] = await db.query(
    "SELECT COUNT(*) AS total FROM `users` WHERE `registered_at` >= NOW() - INTERVAL 1 DAY"
  );
  return total;
}

export async function getBannedUsersCount() {
  const [[{ total }]] = await db.query(
    'SELECT COUNT(*) AS total FROM `users` WHERE `is_active` = 0'
  );
  return total;
}

export async function getTotalUserConfessions(telegramId) {
  const [[{ total }]] = await db.query(
    'SELECT COUNT(*) AS total FROM `confessions` WHERE `telegram_id` = ?',
    [telegramId]
  );
  return total;
}

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

export async function getPrivacySettings(telegramId) {
  const [rows] = await db.query(
    'SELECT `hide_username`, `hide_gender`, `hide_origin` FROM `users` WHERE `telegram_id` = ?',
    [telegramId]
  );
  return rows[0] || { hide_username: 0, hide_gender: 0, hide_origin: 0 };
}

export async function setPrivacyField(telegramId, field, value) {
  const allowed = ['hide_username', 'hide_gender', 'hide_origin'];
  if (!allowed.includes(field)) throw new Error('Invalid privacy field');
  await db.query(
    `UPDATE \`users\` SET \`${field}\` = ? WHERE \`telegram_id\` = ?`,
    [value, telegramId]
  );
}

export async function updateOrigin(telegramId, origin) {
  await db.query(
    'UPDATE `users` SET `origin` = ? WHERE `telegram_id` = ?',
    [origin, telegramId]
  );
}

export async function updateGender(telegramId, gender) {
  await db.query(
    'UPDATE `users` SET `gender` = ? WHERE `telegram_id` = ?',
    [gender, telegramId]
  );
}

export async function updateUsername(telegramId, username) {
  await db.query(
    'UPDATE `users` SET `username` = ? WHERE `telegram_id` = ?',
    [username || null, telegramId]
  );
}
