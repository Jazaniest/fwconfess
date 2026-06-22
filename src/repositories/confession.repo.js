/**
 * Confession repository — query confession, rate limit, rank limit.
 * Phase 2: extracted from commands/database.js
 */
import { db } from '../services/db.js';
import { getConfig } from './config.repo.js';
import { getUserById } from './user.repo.js';

// ─── Confession CRUD ─────────────────────────────────────────────────────────

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

export async function getConfessionsByUserId(telegramId, limit = 5) {
  const [rows] = await db.query(
    'SELECT * FROM `confessions` WHERE `telegram_id` = ? ORDER BY `created_at` DESC LIMIT ?',
    [telegramId, limit]
  );
  return rows;
}

export async function getConfessionByChannelMessageId(channelMessageId) {
  const [rows] = await db.query(
    'SELECT * FROM `confessions` WHERE `channel_message_id` = ?',
    [channelMessageId]
  );
  return rows[0] || null;
}

export async function getLatestConfessionByUserId(userId) {
  const [rows] = await db.query(
    'SELECT * FROM `confessions` WHERE `telegram_id` = ? ORDER BY `created_at` DESC LIMIT 1',
    [userId]
  );
  return rows[0] || null;
}

// ─── Rate limit ──────────────────────────────────────────────────────────────

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

export async function recordActionSent(telegramId, actionType) {
  await db.query(
    'INSERT INTO `action_rate_limits` (`telegram_id`, `action_type`) VALUES (?, ?)',
    [telegramId, actionType]
  );
}

export async function cleanupOldRateLimits(windowMs = 8 * 60 * 60 * 1000) {
  const windowSec = Math.floor(windowMs / 1000);
  const [result] = await db.query(
    `DELETE FROM \`action_rate_limits\`
      WHERE \`sent_at\` < DATE_SUB(NOW(), INTERVAL ? SECOND)`,
    [windowSec]
  );
  return result.affectedRows;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getTotalConfessions() {
  const [[{ total }]] = await db.query(
    'SELECT COUNT(*) AS total FROM `confessions`'
  );
  return total;
}

// ─── Backward-compat aliases (confess.js) ────────────────────────────────────

export async function countRecentConfessions(telegramId, windowMs) {
  return countRecentActions(telegramId, 'confess', windowMs);
}

export async function getLastConfessionTime(telegramId, windowMs) {
  return getOldestActionTime(telegramId, 'confess', windowMs);
}

export async function recordConfessionSent(telegramId) {
  return recordActionSent(telegramId, 'confess');
}

// ─── Rank / action limit ─────────────────────────────────────────────────────

export async function getActionLimitByRank(rank, actionType) {
  const colMap = {
    confess: 'max_count',
    hitme: 'hitme_max_count',
    showme: 'showme_max_count',
  };
  const col = colMap[actionType] || 'max_count';
  const [rows] = await db.query(
    `SELECT \`${col}\` AS max_count FROM \`rank_confession_limits\` WHERE \`rank\` = ?`,
    [rank]
  );
  return rows[0] ? rows[0].max_count : 1;
}

export async function getConfessionLimitByRank(rank) {
  return getActionLimitByRank(rank, 'confess');
}

export async function getEffectiveRank(telegramId) {
  const rankEnabled = await getConfig('rank_system_enabled', '0');
  if (rankEnabled !== '1') return 'member';

  const user = await getUserById(telegramId);
  return user?.rank || 'member';
}
