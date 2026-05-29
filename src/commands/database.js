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

  // ─── User management queries (admin panel) ───────────────────────────────────

  /**
   * Ambil daftar user dengan pagination
   */
  static async getUsersPaginated(limit = 10, offset = 0) {
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
  static async countAllUsers() {
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM `users`');
    return total;
  }

  /**
   * Cari user berdasarkan telegram_id atau username
   */
  static async searchUsers(query, limit = 10, offset = 0) {
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
  static async countSearchUsers(query) {
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

  /**
   * Ambil daftar user yang di-ban (is_active = 0) dengan pagination
   */
  static async getBannedUsersPaginated(limit = 10, offset = 0) {
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
   * Hitung user baru dalam rentang waktu tertentu
   */
  static async countNewUsers() {
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
   * Ban user: set is_active = 0
   */
  static async banUser(telegramId) {
    await db.query(
      'UPDATE `users` SET `is_active` = 0 WHERE `telegram_id` = ?',
      [telegramId]
    );
  }

  /**
   * Unban user: set is_active = 1
   */
  static async unbanUser(telegramId) {
    await db.query(
      'UPDATE `users` SET `is_active` = 1 WHERE `telegram_id` = ?',
      [telegramId]
    );
  }

  /**
   * Top 5 user berdasarkan jumlah action tertentu (confess / hitme / showme)
   */
  static async getTopUsersByAction(actionType, limit = 5) {
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
   * Get confessions by Telegram ID
   */
  static async getConfessionsByUserId(telegramId, limit = 5) {
    const [rows] = await db.query(
      'SELECT * FROM `confessions` WHERE `telegram_id` = ? ORDER BY `created_at` DESC LIMIT ?',
      [telegramId, limit]
    );
    return rows;
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
   * Cek apakah user sudah pernah report confession tertentu
   */
  static async hasUserReported(reporterId, confessionId) {
    const [[{ total }]] = await db.query(
      'SELECT COUNT(*) AS total FROM `reports` WHERE `reporter_id` = ? AND `target_message_id` = ?',
      [reporterId, confessionId]
    );
    return total > 0;
  }

  /**
   * Ambil detail laporan beserta info confession dan reporter
   */
  static async getReportWithDetail(reportId) {
    const [rows] = await db.query(
      `SELECT r.*, 
              c.message_text AS confession_text, 
              c.telegram_id AS confessor_id,
              c.channel_message_id
      FROM \`reports\` r
      JOIN \`confessions\` c ON r.\`target_message_id\` = c.\`id\`
      WHERE r.\`id\` = ?`,
      [reportId]
    );
    return rows[0] || null;
  }

  /**
   * Ambil laporan dengan pagination dan filter status
   */
  static async getReportsPaginated(status = null, limit = 5, offset = 0) {
    const whereClause = status ? 'WHERE r.`status` = ?' : '';
    const params = status
      ? [status, limit, offset]
      : [limit, offset];

    const [rows] = await db.query(
      `SELECT r.*, 
              c.message_text AS confession_text,
              c.telegram_id AS confessor_id,
              c.channel_message_id
      FROM \`reports\` r
      JOIN \`confessions\` c ON r.\`target_message_id\` = c.\`id\`
      ${whereClause}
      ORDER BY r.\`created_at\` DESC
      LIMIT ? OFFSET ?`,
      params
    );
    return rows;
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

  // ─── Bot config queries ──────────────────────────────────────────────────────

  /**
   * Ambil satu nilai config berdasarkan key.
   * @param {string} key
   * @param {string} defaultValue - fallback jika key tidak ditemukan
   */
  static async getConfig(key, defaultValue = null) {
    const [rows] = await db.query(
      'SELECT `value` FROM `bot_config` WHERE `key` = ?',
      [key]
    );
    return rows[0] ? rows[0].value : defaultValue;
  }

  /**
   * Ambil banyak config sekaligus, return sebagai object { key: value }.
   * @param {string[]} keys
   */
  static async getConfigs(keys) {
    const [rows] = await db.query(
      'SELECT `key`, `value` FROM `bot_config` WHERE `key` IN (?)',
      [keys]
    );
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  }

  /**
   * Update nilai config (dipakai admin).
   */
  static async setConfig(key, value) {
    await db.query(
      'INSERT INTO `bot_config` (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
      [key, value]
    );
  }

  // ─── Rate limit queries ──────────────────────────────────────────────────────

  /**
   * Hitung berapa action yang dikirim user dalam window waktu tertentu.
   * @param {number} telegramId
   * @param {'confess'|'hitme'|'showme'} actionType
   * @param {number} windowMs
   */
  static async countRecentActions(telegramId, actionType, windowMs = 8 * 60 * 60 * 1000) {
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
   * @param {number} telegramId
   * @param {'confess'|'hitme'|'showme'} actionType
   * @param {number} windowMs
   */
  static async getOldestActionTime(telegramId, actionType, windowMs = 8 * 60 * 60 * 1000) {
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
    // Fallback ke NOW() jika tidak ada data — caller tetap bisa hitung nextAllowed
    return row ? new Date(row.sent_at) : new Date();
  }

  /**
   * Catat satu action terkirim.
   * @param {number} telegramId
   * @param {'confess'|'hitme'|'showme'} actionType
   */
  static async recordActionSent(telegramId, actionType) {
    await db.query(
      'INSERT INTO `action_rate_limits` (`telegram_id`, `action_type`) VALUES (?, ?)',
      [telegramId, actionType]
    );
  }

  /**
   * Bersihkan data rate limit lama supaya tabel tidak membengkak.
   * @param {number} windowMs
   */
  static async cleanupOldRateLimits(windowMs = 8 * 60 * 60 * 1000) {
    const windowSec = Math.floor(windowMs / 1000);
    const [result] = await db.query(
      `DELETE FROM \`action_rate_limits\`
        WHERE \`sent_at\` < DATE_SUB(NOW(), INTERVAL ? SECOND)`,
      [windowSec]
    );
    return result.affectedRows;
  }

  // Backward-compat: dipakai confess.js — arahkan ke method generik
  static async countRecentConfessions(telegramId, windowMs) {
    return this.countRecentActions(telegramId, 'confess', windowMs);
  }

  static async getLastConfessionTime(telegramId, windowMs) {
    return this.getOldestActionTime(telegramId, 'confess', windowMs);
  }

  static async recordConfessionSent(telegramId) {
    return this.recordActionSent(telegramId, 'confess');
  }

  // ─── Rank limit queries ──────────────────────────────────────────────────────

  /**
   * Ambil limit action untuk rank tertentu.
   * @param {string} rank
   * @param {'confess'|'hitme'|'showme'} actionType
   */
  static async getActionLimitByRank(rank, actionType) {
    const colMap = {
      confess : 'max_count',
      hitme   : 'hitme_max_count',
      showme  : 'showme_max_count',
    };
    const col = colMap[actionType] || 'max_count';
    const [rows] = await db.query(
      `SELECT \`${col}\` AS max_count FROM \`rank_confession_limits\` WHERE \`rank\` = ?`,
      [rank]
    );
    return rows[0] ? rows[0].max_count : 1;
  }

  // Alias tetap tersedia agar kode lama di confess.js tidak perlu diubah dulu
  static async getConfessionLimitByRank(rank) {
    return this.getActionLimitByRank(rank, 'confess');
  }

  // Ambil semua rank limits (untuk admin panel)
  static async getAllRankLimits() {
    const [rows] = await db.query(
      'SELECT * FROM `rank_confession_limits` ORDER BY `max_count` ASC'
    );
    return rows;
  }

  // Update limit sebuah rank untuk action tertentu
  static async updateRankLimit(rank, actionType, maxCount, isActive) {
    const colMap = {
      confess : 'max_count',
      hitme   : 'hitme_max_count',
      showme  : 'showme_max_count',
    };
    const col = colMap[actionType] || 'max_count';
    await db.query(
      `UPDATE \`rank_confession_limits\` SET \`${col}\` = ?, \`is_active\` = ? WHERE \`rank\` = ?`,
      [maxCount, isActive, rank]
    );
  }

  // Ambil rank yang aktif (untuk ditampilkan ke user)
  static async getActiveRanks() {
    const [rows] = await db.query(
      `SELECT \`rank\`, \`max_count\`, \`hitme_max_count\`, \`showme_max_count\`
        FROM \`rank_confession_limits\`
        WHERE \`is_active\` = 1 AND \`rank\` != ?
        ORDER BY \`max_count\` ASC`,
      ['member']
    );
    return rows;
  }

  // Ambil rank efektif user — jika rank system off, return 'member'
  static async getEffectiveRank(telegramId) {
    const rankEnabled = await this.getConfig('rank_system_enabled', '0');
    if (rankEnabled !== '1') return 'member';

    const user = await this.getUserById(telegramId);
    return user?.rank || 'member';
  }

  // ─── Ban management queries ──────────────────────────────────────────────────

  /**
   * Cek apakah user sedang dalam ban aktif
   * Otomatis handle expired temporary ban
   */
  static async getActiveBan(telegramId) {
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
    if (rows.length === 0) {
      await db.query(
        'UPDATE `users` SET `is_active` = 1 WHERE `telegram_id` = ? AND `is_active` = 0',
        [telegramId]
      );
    }

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
  static async createBan(telegramId, banType, reason, expiresAt, bannedBy) {
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
  static async removeBan(telegramId, unbannedBy) {
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
   * Riwayat ban user
   */
  static async getBanHistory(telegramId, limit = 5) {
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
  static async getActiveBansCount() {
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

  
}

// ─── Dagetan ─────────────────────────────────────────────────────────────────
 
/**
 * Buat daget baru.
 * @param {string}   title
 * @param {number}   winnerCount
 * @param {string[]} ranks        - array rank yang eligible
 * @param {string}   drawAt       - ISO string waktu undian
 * @param {number}   createdBy    - telegram_id pembuat
 * @returns {Promise<number>} insertId
 */
export async function dbCreateDaget(title, winnerCount, ranks, drawAt, createdBy) {
  const [result] = await db.query(
    `INSERT INTO \`dagetan\`
      (\`title\`, \`winner_count\`, \`ranks\`, \`draw_at\`, \`created_by\`)
     VALUES (?, ?, ?, ?, ?)`,
    [title, winnerCount, JSON.stringify(ranks), drawAt, createdBy]
  );
  return result.insertId;
}
 
/**
 * Ambil satu daget berdasarkan ID.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
export async function dbGetDagetById(id) {
  const [rows] = await db.query(
    'SELECT * FROM `dagetan` WHERE `id` = ?',
    [id]
  );
  return rows[0] || null;
}
 
/**
 * Ambil semua daget yang masih aktif (status = 'waiting').
 * @returns {Promise<Object[]>}
 */
export async function dbGetActiveDagetan() {
  const [rows] = await db.query(
    "SELECT * FROM `dagetan` WHERE `status` = 'waiting' ORDER BY `draw_at` ASC"
  );
  return rows;
}
 
/**
 * Tandai daget sebagai sudah diundi.
 * @param {number} id
 */
export async function dbMarkDagetDrawn(id) {
  await db.query(
    "UPDATE `dagetan` SET `status` = 'drawn', `drawn_at` = NOW() WHERE `id` = ?",
    [id]
  );
}
 
/**
 * Tandai daget sebagai dibatalkan.
 * @param {number} id
 */
export async function dbMarkDagetCancelled(id) {
  await db.query(
    "UPDATE `dagetan` SET `status` = 'cancelled' WHERE `id` = ?",
    [id]
  );
}
 
// ─── Pemenang ─────────────────────────────────────────────────────────────────
 
/**
 * Simpan daftar pemenang ke tabel daget_winners.
 * @param {number}   dagetId
 * @param {Object[]} winners - array { telegram_id, username }
 */
export async function dbSaveDagetWinners(dagetId, winners) {
  if (!winners.length) return;
  const values = winners.map(w => [dagetId, w.telegram_id, w.username || null]);
  await db.query(
    'INSERT INTO `daget_winners` (`daget_id`, `telegram_id`, `username`) VALUES ?',
    [values]
  );
}
 
/**
 * Ambil semua pemenang dari satu daget.
 * @param {number} dagetId
 * @returns {Promise<Object[]>}
 */
export async function dbGetDagetWinners(dagetId) {
  const [rows] = await db.query(
    'SELECT * FROM `daget_winners` WHERE `daget_id` = ? ORDER BY `id` ASC',
    [dagetId]
  );
  return rows;
}
 
// ─── Pool peserta ─────────────────────────────────────────────────────────────
 
/**
 * Ambil semua user aktif yang ranknya masuk daftar eligible.
 * @param {string[]} ranks
 * @returns {Promise<Object[]>} array { telegram_id, username }
 */
export async function dbGetEligibleUsers(ranks) {
  if (!ranks.length) return [];
  const placeholders = ranks.map(() => '?').join(', ');
  const [rows] = await db.query(
    `SELECT \`telegram_id\`, \`username\`
     FROM   \`users\`
     WHERE  \`is_active\` = 1
       AND  \`rank\` IN (${placeholders})`,
    ranks
  );
  return rows;
}