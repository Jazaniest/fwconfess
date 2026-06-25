import { Markup } from 'telegraf';
import { db } from '../services/db.js';

async function searchByTag(tag, limit = 5, offset = 0) {
  const [rows] = await db.query(
    `SELECT * FROM confessions WHERE FIND_IN_SET(?, tags) ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [tag, limit, offset]
  );
  const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM confessions WHERE FIND_IN_SET(?, tags)', [tag]);
  return { confessions: rows, total };
}

export default function searchCommand(bot) {
  bot.command(['caritagar', 'tag'], async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
      return ctx.reply('Gunakan: `/tag <namatag>` atau `/caritagar <namatag>`', { parse_mode: 'Markdown' });
    }

    let tag = args[1].trim();
    if (!tag.startsWith('#')) {
      tag = `#${tag}`;
    }

    try {
      const { confessions, total } = await searchByTag(tag.substring(1)); // Kirim tanpa '#'

      if (total === 0) {
        return ctx.reply(`Tidak ada menfess yang ditemukan dengan tag *${tag}*`, { parse_mode: 'Markdown' });
      }

      let responseText = `🔎 Hasil pencarian untuk tag *${tag}* (${total} ditemukan):\n\n`;
      confessions.forEach(c => {
        const shortText = c.message_text.length > 100 ? c.message_text.substring(0, 100) + '...' : c.message_text;
        responseText += `📝 "${shortText}"\n🔗 [Lihat di Channel](https://t.me/${process.env.TARGET_CHANNEL_ID.replace('-100', '')}/${c.channel_message_id})\n\n`;
      });

      // TODO: Tambahkan tombol paginasi jika total > limit

      await ctx.reply(responseText, { parse_mode: 'Markdown', disable_web_page_preview: true });

    } catch (error) {
      console.error(`❌ Gagal mencari tag '${tag}':`, error);
      await ctx.reply('❌ Terjadi kesalahan saat melakukan pencarian.');
    }
  });
}
