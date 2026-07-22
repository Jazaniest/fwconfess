/**
 * Rank repository — query-query terkait rank.
 */
import { db } from '../services/db.js';

/**
 * Mendapatkan semua rank.
 * @returns {Promise<Array<object>>}
 */
export async function getActiveRanks() {
  const [rows] = await db.query('SELECT * FROM `ranks` ORDER BY `id` ASC');
  return rows;
}

/**
 * Mendapatkan satu rank berdasarkan ID-nya.
 * @param {number} id - ID rank yang dicari.
 * @returns {Promise<object|null>}
 */
export async function getRankById(id) {
  const [rows] = await db.query('SELECT * FROM `ranks` WHERE `id` = ?', [id]);
  return rows[0] || null;
}

/**
 * Membuat rank baru.
 * @param {object} rankData - Data untuk rank baru.
 * @returns {Promise<object>}
 */
export async function createRank(rankData) {
  const { name, type, duration_days, price, description } = rankData;
  const [result] = await db.query(
    'INSERT INTO `ranks` (name, type, duration_days, price, description) VALUES (?, ?, ?, ?, ?)',
    [name, type, duration_days, price, description]
  );
  return result;
}

/**
 * Memperbarui rank yang ada.
 * @param {number} rankId - ID rank yang akan diperbarui.
 * @param {object} rankData - Data rank yang baru.
 * @returns {Promise<object>}
 */
export async function updateRank(rankId, rankData) {
  const [result] = await db.query('UPDATE `ranks` SET ? WHERE `id` = ?', [
    rankData,
    rankId,
  ]);
  return result;
}

/**
 * Menghapus rank.
 * @param {number} rankId - ID rank yang akan dihapus.
 * @returns {Promise<void>}
 */
export async function deleteRank(rankId) {
  await db.query('DELETE FROM `ranks` WHERE `id` = ?', [rankId]);
}
