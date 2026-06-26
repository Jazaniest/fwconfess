/**
 * Daget repository — query daget (undian) dan pemenang.
 * Phase 2: extracted from commands/database.js (standalone functions)
 */
import { db } from '../services/db.js';
import { formatMySqlDateTime } from '../utils/formatters.js';

// ─── Dagetan ────────────────────────────────────────────────────────────────

export async function dbCreateDaget(title, winnerCount, ranks, drawAt, createdBy) {
  const [result] = await db.query(
    `INSERT INTO \`dagetan\`
      (\`title\`, \`winner_count\`, \`ranks\`, \`draw_at\`, \`created_by\`)
     VALUES (?, ?, ?, ?, ?)`,
    [title, winnerCount, JSON.stringify(ranks), formatMySqlDateTime(drawAt), createdBy]
  );
  return result.insertId;
}

export async function dbGetDagetById(id) {
  const [rows] = await db.query(
    'SELECT * FROM `dagetan` WHERE `id` = ?',
    [id]
  );
  return rows[0] || null;
}

export async function dbGetActiveDagetan() {
  const [rows] = await db.query(
    "SELECT * FROM `dagetan` WHERE `status` = 'waiting' ORDER BY `draw_at` ASC"
  );
  return rows;
}

export async function dbMarkDagetDrawn(id) {
  await db.query(
    "UPDATE `dagetan` SET `status` = 'drawn', `drawn_at` = NOW() WHERE `id` = ?",
    [id]
  );
}

export async function dbMarkDagetCancelled(id) {
  await db.query(
    "UPDATE `dagetan` SET `status` = 'cancelled' WHERE `id` = ?",
    [id]
  );
}

// ─── Pemenang ───────────────────────────────────────────────────────────────

export async function dbSaveDagetWinners(dagetId, winners) {
  if (!winners.length) return;
  const values = winners.map(w => [dagetId, w.telegram_id, w.username || null]);
  await db.query(
    'INSERT INTO `daget_winners` (`daget_id`, `telegram_id`, `username`) VALUES ?',
    [values]
  );
}

export async function dbGetDagetWinners(dagetId) {
  const [rows] = await db.query(
    'SELECT * FROM `daget_winners` WHERE `daget_id` = ? ORDER BY `id` ASC',
    [dagetId]
  );
  return rows;
}

// ─── Pool peserta ───────────────────────────────────────────────────────────

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
