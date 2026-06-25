import { db } from '../services/db.js';
import { getWeek, subWeeks } from 'date-fns';

async function getWinners(type, week, year, limit = 3) {
  const [rows] = await db.query(
    `SELECT l.user_id, u.username, l.score
     FROM leaderboards l
     JOIN users u ON l.user_id = u.telegram_id
     WHERE l.type = ? AND l.week_of_year = ? AND l.year = ?
     ORDER BY l.score DESC
     LIMIT ?`,
    [type, week, year, limit]
  );
  return rows;
}

async function clearOldBadges() {
    // Hapus semua badge yang sudah kedaluwarsa
    await db.query('DELETE FROM user_badges WHERE expires_at < NOW()');
    // Hapus semua badge yang tidak punya tanggal kedaluwarsa (untuk kasus darurat)
    await db.query('DELETE FROM user_badges WHERE expires_at IS NULL');
}

async function assignBadge(userId, title, icon, description, expiresAt) {
    await db.query(
        `INSERT INTO user_badges (user_id, badge_title, badge_icon, source_description, expires_at)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           badge_title = VALUES(badge_title),
           badge_icon = VALUES(badge_icon),
           source_description = VALUES(source_description),
           expires_at = VALUES(expires_at)`,
        [userId, title, icon, description, expiresAt]
    );
}

export async function runWeeklyReset(bot, groupId) {
  console.log('🏆 Memulai proses reset mingguan...');

  try {
    const lastWeek = subWeeks(new Date(), 1);
    const weekOfYear = getWeek(lastWeek, { weekStartsOn: 1 });
    const year = lastWeek.getFullYear();

    await clearOldBadges();

    const [confessWinners, hitWinners, donationWinners] = await Promise.all([
      getWinners('weekly_confessions', weekOfYear, year),
      getWinners('weekly_hitme_received', weekOfYear, year),
      getWinners('weekly_donations', weekOfYear, year),
    ]);

    let announcement = `🎉 *Pemenang Papan Peringkat Minggu Ini!*\n\nSelamat kepada para pemenang minggu lalu (Minggu ke-${weekOfYear}, ${year}). Kalian mendapatkan *badge* spesial di grup selama seminggu!\n\n`;

    // Proses Pemenang Menfess
    if (confessWinners.length > 0) {
        announcement += "📝 *Top Pengirim Menfess*\n";
        const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        for (const [index, winner] of confessWinners.entries()) {
            const rank = index + 1;
            const name = winner.username ? `@${winner.username}` : `User (${String(winner.user_id).slice(-4)})`;
            announcement += `${rank}. ${name} - *${winner.score}* menfess\n`;
            await assignBadge(winner.user_id, `Top Menfess #${rank}`, '📝', `Juara #${rank} Top Menfess Mingguan`, expires);
        }
        announcement += '\n';
    }

    // Proses Pemenang Populer
    if (hitWinners.length > 0) {
        announcement += "🔥 *Top Populer (Paling Sering di-Hit)*\n";
        const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        for (const [index, winner] of hitWinners.entries()) {
            const rank = index + 1;
            const name = winner.username ? `@${winner.username}` : `User (${String(winner.user_id).slice(-4)})`;
            announcement += `${rank}. ${name} - *${winner.score}* kali di-hit\n`;
            await assignBadge(winner.user_id, `Top Populer #${rank}`, '🔥', `Juara #${rank} Top Populer Mingguan`, expires);
        }
        announcement += '\n';
    }

    // Proses Pemenang Donatur
    if (donationWinners.length > 0) {
        announcement += "❤️ *Top Donatur*\n";
        const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        for (const [index, winner] of donationWinners.entries()) {
            const rank = index + 1;
            const name = winner.username ? `@${winner.username}` : `User (${String(winner.user_id).slice(-4)})`;
            announcement += `${rank}. ${name} - *Rp ${winner.score.toLocaleString('id-ID')}*\n`;
            await assignBadge(winner.user_id, `Top Donatur #${rank}`, '❤️', `Juara #${rank} Top Donatur Mingguan`, expires);
        }
        announcement += '\n';
    }

    announcement += "Terima kasih atas partisipasi kalian semua! Mari kita ramaikan lagi minggu ini! 🚀";

    if (confessWinners.length > 0 || hitWinners.length > 0 || donationWinners.length > 0) {
        await bot.telegram.sendMessage(groupId, announcement, { parse_mode: 'Markdown' });
        console.log('✅ Pengumuman pemenang berhasil dikirim.');
    } else {
        console.log('ℹ️ Tidak ada pemenang minggu lalu, tidak ada pengumuman yang dikirim.');
    }

    console.log('🏆 Proses reset mingguan selesai.');
  } catch (error) {
    console.error('❌ Gagal menjalankan reset mingguan:', error);
  }
}
