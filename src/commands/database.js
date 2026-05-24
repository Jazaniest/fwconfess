import { db } from '../services/db.js';

/**
 * Database helper functions
 */
export class Database {

  /**
   * Get user data by telegram ID
   */
  static async getUserById(telegramId) {
    const [rows] = await db.query(
      'SELECT `telegram_id`, `rank`, `gender`, `origin` FROM `users` WHERE `telegram_id` = ?',
      [telegramId]
    );
    return rows[0] || null;
  }

  /**
   * Get full user profile including registration date
   */
  static async getUserFullProfile(telegramId) {
    const [rows] = await db.query(
      'SELECT `telegram_id`, `rank`, `gender`, `origin`, `registered_at`, `is_active` FROM `users` WHERE `telegram_id` = ?',
      [telegramId]
    );
    return rows[0] || null;
  }

  /**
   * Get total confessions by user
   */
  static async getTotalUserConfessions(telegramId) {
    const [[{ total }]] = await db.query(
      'SELECT COUNT(*) AS total FROM `confessions` WHERE `telegram_id` = ?',
      [telegramId]
    );
    return total;
  }

  /**
   * Save confession to database
   */
  static async saveConfession(telegramId, messageText, channelMessageId) {
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
   * Get confession by channel message ID
   */
  static async getConfessionByChannelMessageId(channelMessageId) {
    const [rows] = await db.query(
      'SELECT * FROM `confessions` WHERE `channel_message_id` = ?',
      [channelMessageId]
    );
    return rows[0] || null;
  }

  /**
   * Get latest confession by user ID
   */
  static async getLatestConfessionByUserId(userId) {
    const [rows] = await db.query(
      'SELECT * FROM `confessions` WHERE `telegram_id` = ? ORDER BY `created_at` DESC LIMIT 1',
      [userId]
    );
    return rows[0] || null;
  }

  /**
   * Create anonymous chat session
   */
  static async createChatSession(confessionId, confessorId, hitterId) {
    const sessionCode = Math.random().toString(36).substring(2, 15) +
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
  static async getActiveChatSession(userId) {
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
  static async getActiveSessions() {
    const [rows] = await db.query(
      'SELECT * FROM `chat_sessions` WHERE `is_active` = 1 ORDER BY `created_at` DESC'
    );
    return rows;
  }

  /**
   * Get chat session by session code
   */
  static async getChatSessionByCode(sessionCode) {
    const [rows] = await db.query(
      'SELECT * FROM `chat_sessions` WHERE `session_code` = ?',
      [sessionCode]
    );
    return rows[0] || null;
  }

  /**
   * Get chat session by ID
   */
  static async getChatSessionById(sessionId) {
    const [rows] = await db.query(
      'SELECT * FROM `chat_sessions` WHERE `id` = ?',
      [sessionId]
    );
    return rows[0] || null;
  }

  /**
   * Save anonymous message
   */
  static async saveAnonymousMessage(sessionId, senderId, messageText, messageType = 'text') {
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
  static async getChatHistory(sessionId, limit = 50) {
    const [rows] = await db.query(
      'SELECT * FROM `anonymous_messages` WHERE `session_id` = ? ORDER BY `created_at` ASC LIMIT ?',
      [sessionId, limit]
    );
    return rows;
  }

  /**
   * Check reveal status for user in session
   */
  static async checkRevealStatus(sessionId, userId) {
    const [rows] = await db.query(
      'SELECT `revealed` FROM `reveal_status` WHERE `session_id` = ? AND `user_id` = ?',
      [sessionId, userId]
    );
    return rows[0] ? rows[0].revealed === 1 : false;
  }

  /**
   * Update reveal status for user in session (upsert)
   */
  static async updateRevealStatus(sessionId, userId, revealed) {
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
  static async getSessionRevealStatus(sessionId) {
    const session = await this.getChatSessionById(sessionId);
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
      hitter_revealed: revealMap[session.hitter_id] || false,
    };
  }

  /**
   * Update chat session reveal status (legacy - backward compatibility)
   */
  static async updateChatSessionRevealStatus(sessionId, userId, isRevealed) {
    return await this.updateRevealStatus(sessionId, userId, isRevealed);
  }

  /**
   * End chat session
   */
  static async endChatSession(sessionId) {
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
   * Get session statistics
   */
  static async getSessionStats() {
    try {
      const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM `chat_sessions`');
      const [[{ active }]] = await db.query('SELECT COUNT(*) AS active FROM `chat_sessions` WHERE `is_active` = 1');
      const [[{ completed }]] = await db.query('SELECT COUNT(*) AS completed FROM `chat_sessions` WHERE `is_active` = 0 AND `ended_at` IS NOT NULL');
      const [[{ messages }]] = await db.query('SELECT COUNT(*) AS messages FROM `anonymous_messages`');
      const [[{ reveals }]] = await db.query('SELECT COUNT(*) AS reveals FROM `reveal_status` WHERE `revealed` = 1');

      return { total, active, completed, messages, reveals };
    } catch (error) {
      console.error('Error getting session stats:', error);
      return { total: 0, active: 0, completed: 0, messages: 0, reveals: 0 };
    }
  }

  /**
   * Cleanup inactive sessions (sessions older than 24 hours)
   */
  static async cleanupInactiveSessions() {
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
  static async getUserActiveSessionDetailed(userId) {
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

  // ─── Admin stat queries ──────────────────────────────────────────────────────
  // Dipakai oleh admin.js untuk menampilkan statistik nyata di panel admin.

  static async getTotalUsers() {
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM `users`');
    return total;
  }

  static async getBannedUsersCount() {
    const [[{ total }]] = await db.query(
      'SELECT COUNT(*) AS total FROM `users` WHERE `is_active` = 0'
    );
    return total;
  }

  static async getTotalConfessions() {
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM `confessions`');
    return total;
  }

  static async getActiveUsersToday() {
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM \`users\`
       WHERE DATE(\`registered_at\`) = CURDATE()`
    );
    return total;
  }

  // ─── Report queries ──────────────────────────────────────────────────────────
  // Dipakai oleh report.js dan admin.js.

  static async saveReport(reporterId, targetMessageId, reason) {
    const [result] = await db.query(
      'INSERT INTO `reports` (`reporter_id`, `target_message_id`, `reason`, `status`) VALUES (?, ?, ?, ?)',
      [reporterId, targetMessageId, reason, 'pending']
    );
    const [rows] = await db.query('SELECT * FROM `reports` WHERE `id` = ?', [result.insertId]);
    return rows[0];
  }

  static async getTotalReports() {
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM `reports`');
    return total;
  }

  static async getReportStats() {
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM `reports`');
    const [[{ pending }]] = await db.query("SELECT COUNT(*) AS pending FROM `reports` WHERE `status` = 'pending'");
    const [[{ handled }]] = await db.query("SELECT COUNT(*) AS handled FROM `reports` WHERE `status` = 'handled'");
    const [[{ rejected }]] = await db.query("SELECT COUNT(*) AS rejected FROM `reports` WHERE `status` = 'rejected'");
    return { total, pending, handled, rejected };
  }

  static async getRecentReports(limit = 5) {
    const [rows] = await db.query(
      'SELECT * FROM `reports` ORDER BY `created_at` DESC LIMIT ?',
      [limit]
    );
    return rows;
  }

  static async updateReportStatus(reportId, status) {
    await db.query(
      'UPDATE `reports` SET `status` = ?, `updated_at` = NOW() WHERE `id` = ?',
      [status, reportId]
    );
  }

  // ─── CATATAN: syncSessionsWithDatabase & forceCleanupUserSession ─────────────
  //
  // ✅ FIX BUG #9: Dua method ini DIHAPUS dari class Database karena keduanya
  // mengakses `this.activeChatUsers` — sebuah Map in-memory milik ChatManager,
  // bukan milik class Database yang bersifat static/pure-DB.
  // Akibatnya setiap kali dipanggil, `this.activeChatUsers` selalu undefined dan
  // seluruh logika sync tidak berjalan sama sekali.
  //
  // Kedua method ini sudah diimplementasikan dengan benar di ChatManager
  // (chat-manager.js) dan di situlah seharusnya mereka berada.
  // Kode pemanggil (hitme.js) sudah memanggil chatManager.syncSessionsWithDatabase()
  // dan chatManager.forceCleanupUserSession() — tidak perlu diubah.
}