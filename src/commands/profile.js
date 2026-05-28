import { Markup }                    from 'telegraf';
import { getUserById } from '../repositories/user.repo.js';
import { getGenderEmoji, getRankEmoji, formatProfileMessage } from '../utils/formatters.js';

/**
 * Profile command entry-point.
 *
 * Logika formatProfile tetap di sini karena hanya dipakai oleh command ini.
 * Jika ke depan dipakai di tempat lain, pindahkan ke utils/formatters.js.
 *
 * @param {import('telegraf').Telegraf} bot
 */
export default function profileCommand(bot) {

  // ─── Tombol "Lihat Profile" ─────────────────────────────────────────────────

  bot.action('btn_profile', async (ctx) => {
    await ctx.answerCbQuery();
    await showUserProfile(ctx);
  });

  // ─── /profile command ───────────────────────────────────────────────────────

  bot.command('profile', async (ctx) => {
    await showUserProfile(ctx);
  });

  // ─── Core: tampilkan data profile ──────────────────────────────────────────

  async function showUserProfile(ctx) {
    const userId = ctx.from.id;

    try {
      const loadingMsg = await ctx.reply('⏳ Memuat profile...');

      const user = await getUserById(userId);

      await ctx.deleteMessage(loadingMsg.message_id).catch(() => {});

      if (!user) {
        return ctx.reply(
          '❌ Profile tidak ditemukan!\n\n' +
          'Sepertinya kamu belum terdaftar. Silakan daftar terlebih dahulu.',
          Markup.inlineKeyboard([
            [Markup.button.callback('📝 Daftar Sekarang', 'btn_register')],
            [Markup.button.callback('🏠 Kembali ke Menu',  'btn_back_to_start')],
          ])
        );
      }

      await ctx.reply(
        formatProfileMessage(user, ctx.from),
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('✏️ Edit Profile',  'btn_edit_profile')],
            [Markup.button.callback('🏠 Kembali ke Menu', 'btn_back_to_start')],
          ]),
        }
      );

    } catch (error) {
      console.error('Error loading user profile:', error);
      await ctx.reply(
        '❌ Terjadi kesalahan saat memuat profile.\n' +
        'Silakan coba lagi nanti atau hubungi admin jika masalah berlanjut.\n\n' +
        `Error: ${error.message || 'Unknown error'}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🏠 Kembali ke Menu', 'btn_back_to_start')],
        ])
      );
    }
  }

  // ─── Tombol "Edit Profile" ─────────────────────────────────────────────────

  bot.action('btn_edit_profile', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
      '✏️ Fitur edit profile sedang dalam pengembangan.\n' +
      'Untuk saat ini, silakan hubungi admin jika ingin mengubah data profile.',
      Markup.inlineKeyboard([
        [Markup.button.callback('🏠 Kembali ke Menu', 'btn_back_to_start')],
      ])
    );
  });
}