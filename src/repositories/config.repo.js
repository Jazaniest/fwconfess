/**
 * Config repository — bot config, rank limits, donations.
 * Phase 2: extracted from commands/database.js
 */
import { db } from '../services/db.js';

// ─── Bot config ─────────────────────────────────────────────────────────────

export async function getConfig(key, defaultValue = null) {
  const [rows] = await db.query(
    'SELECT `value` FROM `bot_config` WHERE `key` = ?',
    [key]
  );
  return rows[0] ? rows[0].value : defaultValue;
}

export async function getConfigs(keys) {
  const [rows] = await db.query(
    'SELECT `key`, `value` FROM `bot_config` WHERE `key` IN (?)',
    [keys]
  );
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

export async function setConfig(key, value) {
  await db.query(
    'INSERT INTO `bot_config` (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
    [key, value]
  );
}

// ─── Rank limits ────────────────────────────────────────────────────────────

export async function getAllRankLimits() {
  const [rows] = await db.query(
    'SELECT * FROM `rank_confession_limits` ORDER BY `max_count` ASC'
  );
  return rows;
}

export async function updateRankLimit(rank, actionType, maxCount, isActive) {
  const colMap = {
    confess: 'max_count',
    hitme: 'hitme_max_count',
    showme: 'showme_max_count',
  };
  const col = colMap[actionType] || 'max_count';
  await db.query(
    `UPDATE \`rank_confession_limits\` SET \`${col}\` = ?, \`is_active\` = ? WHERE \`rank\` = ?`,
    [maxCount, isActive, rank]
  );
}

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

// ─── Donations ──────────────────────────────────────────────────────────────

export async function saveDonation({ transactionId, supporterName, supporterMessage, unit, quantity, price }) {
  try {
    const totalAmount = quantity * price;
    const [result] = await db.query(
      `INSERT INTO \`donations\`
        (\`transaction_id\`, \`supporter_name\`, \`supporter_message\`, \`unit\`, \`quantity\`, \`price\`, \`total_amount\`)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [transactionId, supporterName || 'Anonim', supporterMessage || null, unit, quantity, price, totalAmount]
    );
    const [rows] = await db.query('SELECT * FROM `donations` WHERE `id` = ?', [result.insertId]);
    return rows[0];
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return null;
    throw err;
  }
}

export async function getTotalDonations() {
  const [[{ total }]] = await db.query('SELECT COALESCE(SUM(`total_amount`), 0) AS total FROM `donations`');
  return total;
}

export async function getTopDonators(limit = 5) {
  const [rows] = await db.query(
    `SELECT \`supporter_name\`,
            SUM(\`total_amount\`) AS total,
            COUNT(\`id\`)         AS donation_count
    FROM \`donations\`
    GROUP BY \`supporter_name\`
    ORDER BY total DESC
    LIMIT ?`,
    [limit]
  );
  return rows;
}

export async function getRecentDonations(limit = 5) {
  const [rows] = await db.query(
    `SELECT * FROM \`donations\` ORDER BY \`created_at\` DESC LIMIT ?`,
    [limit]
  );
  return rows;
}

export async function getTotalDonationCount() {
  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM `donations`');
  return total;
}
