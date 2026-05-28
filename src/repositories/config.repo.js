import { db } from '../services/db.js';

/**
 * Ambil satu nilai config berdasarkan key.
 * @param {string} key
 * @param {string|null} defaultValue - fallback jika key tidak ditemukan
 */
export async function getConfig(key, defaultValue = null) {
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
export async function getConfigs(keys) {
  const [rows] = await db.query(
    'SELECT `key`, `value` FROM `bot_config` WHERE `key` IN (?)',
    [keys]
  );
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

/**
 * Update nilai config (dipakai admin).
 */
export async function setConfig(key, value) {
  await db.query(
    'INSERT INTO `bot_config` (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
    [key, value]
  );
}