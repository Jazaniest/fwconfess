import { getUserById, createUser } from '../repositories/user.repo.js';
import { Markup } from 'telegraf';

export default function registerCommand(bot) {

  async function startRegistration(ctx) {
    const telegramId = ctx.from.id;

    try {
      const existing = await getUserById(telegramId);

      if (existing) {
        return ctx.reply('Kamu sudah terdaftar.');
      }

      ctx.session      ??= {};
      ctx.session.registration = { telegram_id: telegramId };

      return ctx.reply(
        'Pilih gender kamu:',
        Markup.inlineKeyboard([
          [Markup.button.callback('Laki-laki', 'gender_male')],
          [Markup.button.callback('Perempuan',  'gender_female')],
          [Markup.button.callback('Lainnya',    'gender_other')],
        ])
      );
    } catch (error) {
      console.error('Error fetching user:', error);
      return ctx.reply('Terjadi kesalahan saat memeriksa data. Coba lagi nanti.');
    }
  }

  bot.command('register', async (ctx) => {
    await startRegistration(ctx);
  });

  bot.action('btn_register', async (ctx) => {
    await ctx.answerCbQuery();
    await startRegistration(ctx);
  });

  bot.action(/^gender_(.+)$/, async (ctx) => {
    const gender = ctx.match[1];
    ctx.session.registration.gender = gender;

    await ctx.answerCbQuery();
    await ctx.editMessageText(`Gender kamu: ${gender}.`);

    await ctx.reply(
      'Masukkan asal kamu (opsional). Bisa dikosongkan atau ketik `-` jika tidak ingin isi.'
    );
  });

  async function handleRegisterText(ctx, next) {
    if (!ctx.session?.registration?.gender || ctx.session?.registration?.done) {
      return next();
    }

    const originInput = ctx.message.text.trim();
    const origin      = originInput === '-' ? null : originInput;

    const { telegram_id, gender } = ctx.session.registration;

    try {
      const username = ctx.from.username || null;

      await createUser(telegram_id, username, gender, origin);

      ctx.session.registration.done = true;
      return ctx.reply('Pendaftaran berhasil! Kamu dapat mengirim menfess di /start.');
    } catch (error) {
      console.error('Error inserting user:', error);
      return ctx.reply('Gagal mendaftar. Silakan coba lagi nanti.');
    }
  }

  return { handleRegisterText };
}