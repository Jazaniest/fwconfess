import { db } from '../services/db.js';

/**
 * Create anonymous chat session
 */
export async function createChatSession(confessionId, confessorId, hitterId) {
  const sessionCode =
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);

  const [result] = await db.query(
    'INSERT INTO `chat_sessions` (`confession_id`, `confessor_id`, `hitter_id`, `session_code`) VALUES (?, ?, ?, ?)',
    [confessionId, confessorId, hitterId, sessionCode]
  );
  const [rows] = await db.query(
    'SELECT * FROM `chat_sessions` WHERE `id` = ?',
    [result.insertId]
  );
  return rows[0];
}

/**
 * Get active chat session by user ID
 */
export async function getActiveChatSession(userId) {
  const [rows] = await db.query(
    `SELECT * FROM \`chat_sessions\`
      WHERE (\`confessor_id\` = ? OR \`hitter_id\` = ?)
        AND \`is_active\` = 1
      ORDER BY \`created_at\` DESC
      LIMIT 1`,
    [userId, userId]
  );
  return rows[0] || null;
}

/**
 * Get all active sessions
 */
export async function getActiveSessions() {
  const [rows] = await db.query(
    'SELECT * FROM `chat_sessions` WHERE `is_active` = 1 ORDER BY `created_at` DESC'
  );
  return rows;
}

/**
 * Get chat session by session code
 */
export async function getChatSessionByCode(sessionCode) {
  const [rows] = await db.query(
    'SELECT * FROM `chat_sessions` WHERE `session_code` = ?',
    [sessionCode]
  );
  return rows[0] || null;
}

/**
 * Get chat session by ID
 */
export async function getChatSessionById(sessionId) {
  const [rows] = await db.query(
    'SELECT * FROM `chat_sessions` WHERE `id` = ?',
    [sessionId]
  );
  return rows[0] || null;
}

/**
 * End chat session
 */
export async function endChatSession(sessionId) {
  await db.query(
    'UPDATE `chat_sessions` SET `is_active` = 0, `ended_at` = NOW(), `updated_at` = NOW() WHERE `id` = ?',
    [sessionId]
  );
  const [rows] = await db.query(
    'SELECT * FROM `chat_sessions` WHERE `id` = ?',
    [sessionId]
  );
  return rows[0];
}

/**
 * Save anonymous message
 */
export async function saveAnonymousMessage(sessionId, senderId, messageText, messageType = 'text') {
  const [result] = await db.query(
    'INSERT INTO `anonymous_messages` (`session_id`, `sender_id`, `message_text`, `message_type`) VALUES (?, ?, ?, ?)',
    [sessionId, senderId, messageText, messageType]
  );
  const [rows] = await db.query(
    'SELECT * FROM `anonymous_messages` WHERE `id` = ?',
    [result.insertId]
  );
  return rows[0];
}

/**
 * Get chat history for session
 */
export async function getChatHistory(sessionId, limit = 50) {
  const [rows] = await db.query(
    'SELECT * FROM `anonymous_messages` WHERE `session_id` = ? ORDER BY `created_at` ASC LIMIT ?',
    [sessionId, limit]
  );
  return rows;
}

/**
 * Check reveal status for user in session
 */
export async function checkRevealStatus(sessionId, userId) {
  const [rows] = await db.query(
    'SELECT `revealed` FROM `reveal_status` WHERE `session_id` = ? AND `user_id` = ?',
    [sessionId, userId]
  );
  return rows[0] ? rows[0].revealed === 1 : false;
}

/**
 * Update reveal status for user in session (upsert)
 */
export async function updateRevealStatus(sessionId, userId, revealed) {
  await db.query(
    `INSERT INTO \`reveal_status\` (\`session_id\`, \`user_id\`, \`revealed\`)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE \`revealed\` = VALUES(\`revealed\`), \`updated_at\` = NOW()`,
    [sessionId, userId, revealed]
  );
  const [rows] = await db.query(
    'SELECT * FROM `reveal_status` WHERE `session_id` = ? AND `user_id` = ?',
    [sessionId, userId]
  );
  return rows[0];
}

/**
 * Get reveal status for both users in session
 */
export async function getSessionRevealStatus(sessionId) {
  const session = await getChatSessionById(sessionId);
  if (!session) return null;

  const [rows] = await db.query(
    'SELECT `user_id`, `revealed` FROM `reveal_status` WHERE `session_id` = ?',
    [sessionId]
  );

  const revealMap = {};
  rows.forEach(item => {
    revealMap[item.user_id] = item.revealed === 1;
  });

  return {
    confessor_revealed: revealMap[session.confessor_id] || false,
    hitter_revealed:    revealMap[session.hitter_id] || false,
  };
}

/**
 * Update chat session reveal status (legacy alias)
 */
export async function updateChatSessionRevealStatus(sessionId, userId, isRevealed) {
  return updateRevealStatus(sessionId, userId, isRevealed);
}

/**
 * Get session statistics
 */
export async function getSessionStats() {
  try {
    const [[{ total }]]     = await db.query('SELECT COUNT(*) AS total FROM `chat_sessions`');
    const [[{ active }]]    = await db.query('SELECT COUNT(*) AS active FROM `chat_sessions` WHERE `is_active` = 1');
    const [[{ completed }]] = await db.query('SELECT COUNT(*) AS completed FROM `chat_sessions` WHERE `is_active` = 0 AND `ended_at` IS NOT NULL');
    const [[{ messages }]]  = await db.query('SELECT COUNT(*) AS messages FROM `anonymous_messages`');
    const [[{ reveals }]]   = await db.query('SELECT COUNT(*) AS reveals FROM `reveal_status` WHERE `revealed` = 1');
    return { total, active, completed, messages, reveals };
  } catch (error) {
    console.error('Error getting session stats:', error);
    return { total: 0, active: 0, completed: 0, messages: 0, reveals: 0 };
  }
}

/**
 * Cleanup inactive sessions (sessions older than 24 hours)
 */
export async function cleanupInactiveSessions() {
  const [result] = await db.query(
    `UPDATE \`chat_sessions\`
      SET \`is_active\` = 0, \`ended_at\` = NOW(), \`updated_at\` = NOW()
      WHERE \`is_active\` = 1
        AND \`ended_at\` IS NULL
        AND \`created_at\` < DATE_SUB(NOW(), INTERVAL 24 HOUR)`
  );
  return result.affectedRows;
}

/**
 * Get user's active session with detailed info
 */
export async function getUserActiveSessionDetailed(userId) {
  const [rows] = await db.query(
    `SELECT cs.*, c.message_text AS confession_text
      FROM \`chat_sessions\` cs
      JOIN \`confessions\` c ON cs.\`confession_id\` = c.\`id\`
      WHERE (cs.\`confessor_id\` = ? OR cs.\`hitter_id\` = ?)
        AND cs.\`is_active\` = 1
      LIMIT 1`,
    [userId, userId]
  );
  return rows[0] || null;
}

/**
 * Alias used by some older callers
 */
export async function getChatStats() {
  return getSessionStats();
}