import { Markup } from 'telegraf';
import { db } from '../services/db.js';
import { getWeek } from 'date-fns';

async function getLeaderboardData(type, week, year, limit = 5) {
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

function formatLeaderboard(title, icon, data) {
  let text = `${icon} *${title}*\n`;
  if (data.length === 0) {
    text += '_Belum ada data untuk minggu ini._\n';
    return text;
  }
  data.forEach((item, index) => {
    const name = item.username ? `@${item.username}` : `User (${String(item.user_id).slice(-4)})`;
    text += `${index + 1}. ${name} - *${item.score}* poin\n`;
  });
  return text;
}

export default function leaderboardCommand(bot) {
  bot.command('leaderboard', async (ctx) => {
    try {
      const now = new Date();
      const weekOfYear = getWeek(now, { weekStartsOn: 1 });
      const year = now.getFullYear();

      const [confessData, hitData, donationData] = await Promise.all([
        getLeaderboardData('weekly_confessions', weekOfYear, year),
        getLeaderboardData('weekly_hitme_received', weekOfYear, year),
        getLeaderboardData('weekly_donations', weekOfYear, year),
      ]);

      let fullText = `🏆 *Papan Peringkat Mingguan*\n\n`;
      fullText += formatLeaderboard('Top Pengirim Menfess', '📝', confessData);
      fullText += '\n';
      fullText += formatLeaderboard('Top Populer (Paling Sering di-Hit)', '🔥', hitData);
      fullText += '\n';
      fullText += formatLeaderboard('Top Donatur', '❤️', donationData);
      fullText += `\n_Peringkat direset setiap hari Senin._`;

      await ctx.reply(fullText, {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Refresh', 'leaderboard_refresh')]
        ]).reply_markup
      });
    } catch (error) {
      console.error('❌ Error fetching leaderboard:', error);
      await ctx.reply('❌ Terjadi kesalahan saat memuat papan peringkat.');
    }
  });

  bot.action('leaderboard_refresh', async (ctx) => {
    try {
      await ctx.answerCbQuery('🔄 Memperbarui...');
      const now = new Date();
      const weekOfYear = getWeek(now, { weekStartsOn: 1 });
      const year = now.getFullYear();

      const [confessData, hitData, donationData] = await Promise.all([
        getLeaderboardData('weekly_confessions', weekOfYear, year),
        getLeaderboardData('weekly_hitme_received', weekOfYear, year),
        getLeaderboardData('weekly_donations', weekOfYear, year),
      ]);

      let fullText = `🏆 *Papan Peringkat Mingguan*\n\n`;
      fullText += formatLeaderboard('Top Pengirim Menfess', '📝', confessData);
      fullText += '\n';
      fullText += formatLeaderboard('Top Populer (Paling Sering di-Hit)', '🔥', hitData);
      fullText += '\n';
      fullText += formatLeaderboard('Top Donatur', '❤️', donationData);
      fullText += `\n_Peringkat direset setiap hari Senin._`;

      await ctx.editMessageText(fullText, {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Refresh', 'leaderboard_refresh')]
        ]).reply_markup
      });
    } catch (error) {
      console.error('❌ Error refreshing leaderboard:', error);
      await ctx.answerCbQuery('❌ Gagal memperbarui.');
    }
  });
}
