import { db } from '../services/db.js';

/**
 * Save confession to database
 */
export async function saveConfession(telegramId, messageText, channelMessageId) {
  const [result] = await db.query(
    'INSERT INTO `confessions` (`telegram_id`, `message_text`, `channel_message_id`) VALUES (?, ?, ?)',
    [telegramId, messageText, channelMessageId]
  );
  const [rows] = await db.query(
    'SELECT * FROM `confessions` WHERE `id` = ?',
    [result.insertId]
  );
  return rows[0];
}

/**
 * Get confessions by Telegram ID
 */
export async function getConfessionsByUserId(telegramId, limit = 5) {
  const [rows] = await db.query(
    'SELECT * FROM `confessions` WHERE `telegram_id` = ? ORDER BY `created_at` DESC LIMIT ?',
    [telegramId, limit]
  );
  return rows;
}

/**
 * Get confession by channel message ID
 */
export async function getConfessionByChannelMessageId(channelMessageId) {
  const [rows] = await db.query(
    'SELECT * FROM `confessions` WHERE `channel_message_id` = ?',
    [channelMessageId]
  );
  return rows[0] || null;
}

/**
 * Get latest confession by user ID
 */
export async function getLatestConfessionByUserId(userId) {
  const [rows] = await db.query(
    'SELECT * FROM `confessions` WHERE `telegram_id` = ? ORDER BY `created_at` DESC LIMIT 1',
    [userId]
  );
  return rows[0] || null;
}

/**
 * Get total confessions (for admin stats)
 */
export async function getTotalConfessions() {
  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM `confessions`');
  return total;
}

// ─── Rate limit queries ──────────────────────────────────────────────────────

/**
 * Hitung berapa action yang dikirim user dalam window waktu tertentu.
 */
export async function countRecentActions(telegramId, actionType, windowMs = 8 * 60 * 60 * 1000) {
  const windowSec = Math.floor(windowMs / 1000);
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM \`action_rate_limits\`
      WHERE \`telegram_id\` = ?
        AND \`action_type\` = ?
        AND \`sent_at\` > DATE_SUB(NOW(), INTERVAL ? SECOND)`,
    [telegramId, actionType, windowSec]
  );
  return total;
}

/**
 * Ambil timestamp action terlama user dalam window (untuk hitung kapan boleh lagi).
 */
export async function getOldestActionTime(telegramId, actionType, windowMs = 8 * 60 * 60 * 1000) {
  const windowSec = Math.floor(windowMs / 1000);
  const [[row]] = await db.query(
    `SELECT \`sent_at\` FROM \`action_rate_limits\`
      WHERE \`telegram_id\` = ?
        AND \`action_type\` = ?
        AND \`sent_at\` > DATE_SUB(NOW(), INTERVAL ? SECOND)
      ORDER BY \`sent_at\` ASC
      LIMIT 1`,
    [telegramId, actionType, windowSec]
  );
  return row ? new Date(row.sent_at) : new Date();
}

/**
 * Catat satu action terkirim.
 */
export async function recordActionSent(telegramId, actionType) {
  await db.query(
    'INSERT INTO `action_rate_limits` (`telegram_id`, `action_type`) VALUES (?, ?)',
    [telegramId, actionType]
  );
}

/**
 * Bersihkan data rate limit lama supaya tabel tidak membengkak.
 */
export async function cleanupOldRateLimits(windowMs = 8 * 60 * 60 * 1000) {
  const windowSec = Math.floor(windowMs / 1000);
  const [result] = await db.query(
    `DELETE FROM \`action_rate_limits\`
      WHERE \`sent_at\` < DATE_SUB(NOW(), INTERVAL ? SECOND)`,
    [windowSec]
  );
  return result.affectedRows;
}

// Backward-compat aliases

export async function countRecentConfessions(telegramId, windowMs) {
  return countRecentActions(telegramId, 'confess', windowMs);
}

export async function getLastConfessionTime(telegramId, windowMs) {
  return getOldestActionTime(telegramId, 'confess', windowMs);
}

export async function recordConfessionSent(telegramId) {
  return recordActionSent(telegramId, 'confess');
}

// ─── Rank limit queries ──────────────────────────────────────────────────────

/**
 * Ambil limit action untuk rank tertentu.
 */
export async function getActionLimitByRank(rank, actionType) {
  const colMap = {
    confess: 'max_count',
    hitme:   'hitme_max_count',
    showme:  'showme_max_count',
  };
  const col = colMap[actionType] || 'max_count';
  const [rows] = await db.query(
    `SELECT \`${col}\` AS max_count FROM \`rank_confession_limits\` WHERE \`rank\` = ?`,
    [rank]
  );
  return rows[0] ? rows[0].max_count : 1;
}

// Alias for backward compatibility
export async function getConfessionLimitByRank(rank) {
  return getActionLimitByRank(rank, 'confess');
}

/**
 * Ambil semua rank limits (untuk admin panel)
 */
export async function getAllRankLimits() {
  const [rows] = await db.query(
    'SELECT * FROM `rank_confession_limits` ORDER BY `max_count` ASC'
  );
  return rows;
}

/**
 * Update limit sebuah rank untuk action tertentu
 */
export async function updateRankLimit(rank, actionType, maxCount, isActive) {
  const colMap = {
    confess: 'max_count',
    hitme:   'hitme_max_count',
    showme:  'showme_max_count',
  };
  const col = colMap[actionType] || 'max_count';
  await db.query(
    `UPDATE \`rank_confession_limits\` SET \`${col}\` = ?, \`is_active\` = ? WHERE \`rank\` = ?`,
    [maxCount, isActive, rank]
  );
}

/**
 * Ambil rank yang aktif (untuk ditampilkan ke user)
 */
export async function getActiveRanks() {
  const [rows] = await db.query(
    `SELECT \`rank\`, \`max_count\`, \`hitme_max_count\`, \`showme_max_count\`
      FROM \`rank_confession_limits\`
      WHERE \`is_active\` = 1 AND \`rank\` != ?
      ORDER BY \`max_count\` ASC`,
    ['member']
  );
  return rows;
}

/**
 * Ambil rank efektif user — jika rank system off, return 'member'
 * NOTE: Requires config.repo and user.repo — imported inline to avoid circular deps
 */
export async function getEffectiveRank(telegramId) {
  // Import lazily to avoid circular dependency
  const { getConfig } = await import('./config.repo.js');
  const { getUserById } = await import('./user.repo.js');

  const rankEnabled = await getConfig('rank_system_enabled', '0');
  if (rankEnabled !== '1') return 'member';

  const user = await getUserById(telegramId);
  return user?.rank || 'member';
}