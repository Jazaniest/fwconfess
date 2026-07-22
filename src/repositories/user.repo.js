/**
 * User repository — semua query terkait user, profile, privacy.
 * Phase 2: extracted from commands/database.js
 */
import { db } from '../services/db.js';

export async function getUserById(telegramId) {
  const [rows] = await db.query(
    `SELECT u.telegram_id, r.name as \`rank\`, u.gender, u.origin, u.username, u.hide_username, u.hide_gender, u.hide_origin, u.free_menfess_balance, u.referrer_id, u.rank_id
     FROM \`users\` u
     LEFT JOIN \`ranks\` r ON u.rank_id = r.id
     WHERE u.telegram_id = ?`,
    [telegramId]
  );
  return rows[0] || null;
}

export async function getUserFullProfile(telegramId) {
  const [rows] = await db.query(
    `SELECT u.telegram_id, r.name as \`rank\`, u.gender, u.origin, u.registered_at, u.is_active, u.rank_id
     FROM \`users\` u
     LEFT JOIN \`ranks\` r ON u.rank_id = r.id
     WHERE u.telegram_id = ?`,
    [telegramId]
  );
  return rows[0] || null;
}

export async function getUsersPaginated(limit = 10, offset = 0) {
  const [rows] = await db.query(
    `SELECT u.telegram_id, u.username, r.name as \`rank\`, u.gender, u.origin, u.registered_at, u.is_active, u.confession_count AS total_confessions
    FROM \`users\` u
    LEFT JOIN \`ranks\` r ON u.rank_id = r.id
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
      `SELECT u.telegram_id, u.username, r.name as \`rank\`, u.gender, u.origin, u.registered_at, u.is_active, u.confession_count AS total_confessions
      FROM \`users\` u
      LEFT JOIN \`ranks\` r ON u.rank_id = r.id
      WHERE u.telegram_id = ?
      LIMIT ? OFFSET ?`,
      [parseInt(query.trim()), limit, offset]
    );
  } else {
    const like = `%${query.trim()}%`;
    [rows] = await db.query(
      `SELECT u.telegram_id, u.username, r.name as \`rank\`, u.gender, u.origin, u.registered_at, u.is_active, u.confession_count AS total_confessions
   FROM \`users\` u
   LEFT JOIN \`ranks\` r ON u.rank_id = r.id
   WHERE u.username LIKE ?
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
  `SELECT u.telegram_id, u.username, r.name as \`rank\`, u.gender, u.origin, u.registered_at
    FROM \`users\` u
    LEFT JOIN \`ranks\` r ON u.rank_id = r.id
    WHERE u.is_active = 0
    ORDER BY u.registered_at DESC
    LIMIT ? OFFSET ?\`,
    [limit, offset]`
  );
  return rows;
}

export async function countNewUsers() {
    const [[result]] = await db.query(
        `SELECT
            SUM(CASE WHEN registered_at >= NOW() - INTERVAL 1 DAY THEN 1 ELSE 0 END) AS day1,
            SUM(CASE WHEN registered_at >= NOW() - INTERVAL 7 DAY THEN 1 ELSE 0 END) AS day7,
            SUM(CASE WHEN registered_at >= NOW() - INTERVAL 30 DAY THEN 1 ELSE 0 END) AS day30
        FROM \`users\`\``,
    );
    return { day1: result.day1 || 0, day7: result.day7 || 0, day30: result.day30 || 0 };
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
    'SELECT confession_count AS total FROM `users` WHERE `telegram_id` = ?',
    [telegramId]
  );
  return total;
}

export async function getTopUsersByAction(actionType, limit = 5) {
  const [rows] = await db.query(
    `SELECT u.telegram_id, u.username, r.name as \`rank\`, COUNT(a.id) AS total
    FROM \`action_rate_limits\` a
    JOIN \`users\` u ON a.telegram_id = u.telegram_id
    LEFT JOIN \`ranks\` r ON u.rank_id = r.id
    WHERE a.action_type = ?
    GROUP BY u.telegram_id, u.username, r.name
    ORDER BY total DESC
    LIMIT ?\``,
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
    `UPDATE \`users\` SET \`\${field}\` = ? WHERE \`telegram_id\` = ?`,
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

export async function recordReferralPayout(recipientId, newUserId, level, rewardAmount) {
  await db.query(
    'INSERT INTO `referral_payouts` (`recipient_id`, `new_user_id`, `level`, `reward_amount`) VALUES (?, ?, ?, ?)',
    [recipientId, newUserId, level, rewardAmount]
  );
}

export async function getCoFounders() {
  const [rows] = await db.query(
    'SELECT `telegram_id`, `username` FROM `users` WHERE `is_cofounder` = 1'
  );
  return rows;
}

export async function setUserCoFounderStatus(userId, status) {
  const isCoFounder = status ? 1 : 0;
  await db.query(
    'UPDATE `users` SET `is_cofounder` = ? WHERE `telegram_id` = ?',
    [isCoFounder, userId]
  );
}

export async function incrementFreeMenfessBalance(telegramId, amount = 1) {
  await db.query(
    'UPDATE `users` SET `free_menfess_balance` = `free_menfess_balance` + ? WHERE `telegram_id` = ?',
    [amount, telegramId]
  );
}

export async function decrementFreeMenfessBalance(telegramId, amount = 1) {
  await db.query(
    'UPDATE `users` SET `free_menfess_balance` = GREATEST(0, `free_menfess_balance` - ?) WHERE `telegram_id` = ?',
    [amount, telegramId]
  );
}

/**
 * Assign a rank to a user, with an optional expiration date.
 * @param {object} options - The options object.
 * @param {number} options.userId - The ID of the user.
 * @param {number} options.rankId - The ID of the rank.
 * @param {string|null} [options.expiresAt=null] - The expiration date in ISO 8601 format.
 */
export async function assignRank({ userId, rankId, expiresAt = null }) {
  await db.query(
    'UPDATE `users` SET `rank_id` = ?, `rank_expires_at` = ? WHERE `telegram_id` = ?',
    [rankId, expiresAt, userId]
  );
}
