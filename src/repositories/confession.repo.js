/**
 * Confession repository — query confession, rate limit, rank limit.
 * Phase 2: extracted from commands/database.js
 */
import { db } from '../services/db.js';
import { getUserById } from './user.repo.js';

// ─── Confession CRUD ─────────────────────────────────────────────────────────

export async function createPendingConfession(telegramId, messageText, tags = null) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      "INSERT INTO `confessions` (`telegram_id`, `message_text`, `tags`, `status`) VALUES (?, ?, ?, 'pending')",
      [telegramId, messageText, tags]
    );
    const confessionId = result.insertId;

    await connection.query(
      'UPDATE `users` SET `confession_count` = `confession_count` + 1 WHERE `telegram_id` = ?',
      [telegramId]
    );

    await connection.commit();
    return confessionId;
  } catch (error) {
    await connection.rollback();
    console.error("Failed to create pending confession:", error);
    throw error;
  } finally {
    connection.release();
  }
}

export async function finalizeConfession(confessionId, channelMessageId) {
  await db.query(
    "UPDATE `confessions` SET `status` = 'published', `channel_message_id` = ? WHERE `id` = ?",
    [channelMessageId, confessionId]
  );
}

export async function failConfession(confessionId) {
  // We might not want to decrement user's confession_count here,
  // as the attempt was still made. This can be a business logic decision.
  await db.query(
    "UPDATE `confessions` SET `status` = 'failed' WHERE `id` = ?",
    [confessionId]
  );
}

export async function getConfessionsByUserId(telegramId, limit = 5) {
  const [rows] = await db.query(
    "SELECT * FROM `confessions` WHERE `telegram_id` = ? AND `status` = 'published' ORDER BY `created_at` DESC LIMIT ?",
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
    "SELECT * FROM `confessions` WHERE `telegram_id` = ? AND `status` = 'published' ORDER BY `created_at` DESC LIMIT 1",
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
        AND \`sent_at\` > DATE_SUB(NOW(), INTERVAL ? SECOND)\``,
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
      LIMIT 1\``,
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
      WHERE \`sent_at\` < DATE_SUB(NOW(), INTERVAL ? SECOND)\``,
    [windowSec]
  );
  return result.affectedRows;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getTotalConfessions() {
  const [[{ total }]] = await db.query(
    "SELECT COUNT(*) AS total FROM `confessions` WHERE `status` = 'published'"
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

export async function getActionLimitByRankId(rankId, actionType) {
  const colMap = {
    confess: 'max_count',
    hitme: 'hitme_max_count',
    showme: 'showme_max_count',
  };
  const col = colMap[actionType] || 'max_count';
  // Fallback to rank_id 1 (default rank) if specific limit not found
  const [rows] = await db.query(
    `SELECT \`${col}\` AS max_count
     FROM \`rank_confession_limits\`
     WHERE \`rank_id\` = ?
     UNION ALL
     SELECT \`${col}\` FROM \`rank_confession_limits\` WHERE \`rank_id\` = 1
     LIMIT 1\``,
    [rankId]
  );
  return rows[0] ? rows[0].max_count : 1;
}

export async function getConfessionLimitByRankId(rankId) {
  return getActionLimitByRankId(rankId, 'confess');
}

export async function getEffectiveRankId(telegramId) {
  const user = await getUserById(telegramId);
  return user?.rank_id || 1; // Fallback to rank_id 1 (default rank)
}
