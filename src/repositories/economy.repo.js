import { db } from '../services/db.js';
import { randomUUID } from 'crypto';

/**
 * Mendapatkan atau membuat dompet untuk pengguna.
 * @param {number} userId ID Telegram pengguna.
 * @returns {Promise<{user_id: number, balance: number}>}
 */
export async function getWallet(userId) {
  const [wallets] = await db.query('SELECT * FROM user_wallets WHERE user_id = ?', [userId]);
  if (wallets.length > 0) {
    return wallets[0];
  }
  // Jika dompet belum ada, buatkan yang baru.
  await db.query('INSERT INTO user_wallets (user_id, balance) VALUES (?, 0) ON DUPLICATE KEY UPDATE user_id = user_id', [userId]);
  return { user_id: userId, balance: 0 };
}

/**
 * Menambah koin ke dompet pengguna.
 * @param {number} userId ID Telegram pengguna.
 * @param {number} amount Jumlah koin yang ditambahkan.
 * @param {'purchase' | 'refund' | 'admin_grant'} type Jenis transaksi.
 * @param {string} description Deskripsi transaksi.
 * @param {string} transactionId ID transaksi eksternal jika ada.
 * @returns {Promise<boolean>}
 */
export async function addCoins(userId, amount, type, description, transactionId = null) {
  if (amount <= 0) return false;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(
        'INSERT INTO user_wallets (user_id, balance) VALUES (?, ?) ON DUPLICATE KEY UPDATE balance = balance + ?',
        [userId, amount, amount]
    );

    await connection.query(
      'INSERT INTO coin_transactions (id, user_id, type, amount, description) VALUES (?, ?, ?, ?, ?)',
      [transactionId || randomUUID(), userId, type, amount, description]
    );

    await connection.commit();
    console.log(`💰 Ekonomi: ${amount} koin ditambahkan ke user ${userId} untuk '${description}'.`);
    return true;
  } catch (error) {
    await connection.rollback();
    console.error(`❌ Gagal menambah koin untuk user ${userId}:`, error);
    return false;
  } finally {
    connection.release();
  }
}

/**
 * Menggunakan koin dari dompet pengguna.
 * @param {number} userId ID Telegram pengguna.
 * @param {number} amount Jumlah koin yang digunakan.
 * @param {'spend_super_hit' | 'spend_extend_chat'} type Jenis transaksi.
 * @param {string} description Deskripsi transaksi.
 * @returns {Promise<boolean>} True jika berhasil, false jika saldo tidak cukup atau error.
 */
export async function spendCoins(userId, amount, type, description) {
  if (amount <= 0) return false;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Cek saldo dengan lock untuk mencegah race condition
    const [wallets] = await connection.query('SELECT balance FROM user_wallets WHERE user_id = ? FOR UPDATE', [userId]);
    const balance = wallets[0]?.balance || 0;

    if (balance < amount) {
      await connection.rollback();
      return false; // Saldo tidak cukup
    }

    await connection.query('UPDATE user_wallets SET balance = balance - ? WHERE user_id = ?', [amount, userId]);

    await connection.query(
      'INSERT INTO coin_transactions (id, user_id, type, amount, description) VALUES (?, ?, ?, ?, ?)',
      [randomUUID(), userId, type, -amount, description] // Simpan sebagai angka negatif
    );

    await connection.commit();
    console.log(`💸 Ekonomi: ${amount} koin digunakan oleh user ${userId} untuk '${description}'.`);
    return true;
  } catch (error) {
    await connection.rollback();
    console.error(`❌ Gagal menggunakan koin untuk user ${userId}:`, error);
    return false;
  } finally {
    connection.release();
  }
}
