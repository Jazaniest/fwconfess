/**
 * Report repository — query laporan/pelaporan.
 * Phase 2: extracted from commands/database.js
 */
import { db } from '../services/db.js';

export async function hasUserReported(reporterId, confessionId) {
  const [[{ total }]] = await db.query(
    'SELECT COUNT(*) AS total FROM `reports` WHERE `reporter_id` = ? AND `target_message_id` = ?',
    [reporterId, confessionId]
  );
  return total > 0;
}

export async function getReportWithDetail(reportId) {
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

export async function getReportsPaginated(status = null, limit = 5, offset = 0) {
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

export async function saveReport(reporterId, targetMessageId, reason) {
  const [result] = await db.query(
    'INSERT INTO `reports` (`reporter_id`, `target_message_id`, `reason`, `status`) VALUES (?, ?, ?, ?)',
    [reporterId, targetMessageId, reason, 'pending']
  );
  const [rows] = await db.query('SELECT * FROM `reports` WHERE `id` = ?', [result.insertId]);
  return rows[0];
}

export async function getTotalReports() {
  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM `reports`');
  return total;
}

export async function getReportStats() {
  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM `reports`');
  const [[{ pending }]] = await db.query("SELECT COUNT(*) AS pending FROM `reports` WHERE `status` = 'pending'");
  const [[{ handled }]] = await db.query("SELECT COUNT(*) AS handled FROM `reports` WHERE `status` = 'handled'");
  const [[{ rejected }]] = await db.query("SELECT COUNT(*) AS rejected FROM `reports` WHERE `status` = 'rejected'");
  return { total, pending, handled, rejected };
}

export async function getRecentReports(limit = 5) {
  const [rows] = await db.query(
    'SELECT * FROM `reports` ORDER BY `created_at` DESC LIMIT ?',
    [limit]
  );
  return rows;
}

export async function updateReportStatus(reportId, status) {
  await db.query(
    'UPDATE `reports` SET `status` = ?, `updated_at` = NOW() WHERE `id` = ?',
    [status, reportId]
  );
}
