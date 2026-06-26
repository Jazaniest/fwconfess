import { db } from '../services/db.js'
import { Markup } from 'telegraf'
import { privateChatOnly } from '../middleware/private-chat-only.js';
import { processReferralRewards } from '../services/referral.service.js';



/**
 * Handler untuk perintah /register: mendaftarkan user ke DB MySQL
 * @param {Telegraf} bot
 */

export default function registerCommand(bot) {
  bot.command('register', privateChatOnly('Untuk mendaftar, silakan mulai chat pribadi dengan saya.'), async (ctx) => {
    const telegramId = ctx.from.id

    try {
      // Cek apakah user sudah terdaftar
      const [existing] = await db.query(
        'SELECT `telegram_id` FROM `users` WHERE `telegram_id` = ? LIMIT 1',
        [telegramId]
      )

      if (existing.length > 0) {
        return ctx.reply('Kamu sudah terdaftar.')
      }

      // Simpan status sementara di session
      ctx.session ??= {}
      ctx.session.registration = {
        telegram_id: telegramId,
      }

      // Kirim pilihan gender
      return ctx.reply(
        'Pilih gender kamu:',
        Markup.inlineKeyboard([
          [Markup.button.callback('Laki-laki', 'gender_male')],
          [Markup.button.callback('Perempuan', 'gender_female')],
          [Markup.button.callback('Lainnya', 'gender_other')],
        ])
      )
    } catch (error) {
      console.error('Error fetching user:', error)
      return ctx.reply('Terjadi kesalahan saat memeriksa data. Coba lagi nanti.')
    }
  })

  bot.action('btn_register', privateChatOnly('Proses registrasi hanya bisa dilakukan di chat pribadi.'), async (ctx) => {
    await ctx.answerCbQuery()
    const telegramId = ctx.from.id

    try {
      // Cek apakah user sudah terdaftar
      const [existing] = await db.query(
        'SELECT `telegram_id` FROM `users` WHERE `telegram_id` = ? LIMIT 1',
        [telegramId]
      )

      if (existing.length > 0) {
        return ctx.reply('Kamu sudah terdaftar.')
      }

      // Simpan status sementara di session
      ctx.session ??= {}
      ctx.session.registration = {
        telegram_id: telegramId,
      }

      // Kirim pilihan gender
      return ctx.reply(
        'Pilih gender kamu:',
        Markup.inlineKeyboard([
          [Markup.button.callback('Laki-laki', 'gender_male')],
          [Markup.button.callback('Perempuan', 'gender_female')],
          [Markup.button.callback('Lainnya', 'gender_other')],
        ])
      )
    } catch (error) {
      console.error('Error fetching user:', error)
      return ctx.reply('Terjadi kesalahan saat memeriksa data. Coba lagi nanti.')
    }
  })

  // Handler gender
  bot.action(/^gender_(.+)$/, async (ctx) => {
    const gender = ctx.match[1] // male / female / other
    ctx.session.registration.gender = gender

    await ctx.answerCbQuery()
    await ctx.editMessageText(`Gender kamu: ${gender}.`)

    // Minta asal
    await ctx.reply('Masukkan kota asal kamu (opsional). Bisa dikosongkan atau ketik `-` jika tidak ingin isi.')
  })

  async function handleRegisterText(ctx, next) {
    if (!ctx.session?.registration?.gender || ctx.session?.registration?.done) {
      return next()
    }

    const originInput = ctx.message.text.trim()
    const origin = originInput === '-' ? null : originInput

    const { telegram_id, gender } = ctx.session.registration

    try {
      const username = ctx.from.username || null;
      const referrerId = ctx.session.referrerId || null; // Ambil referrerId dari session

      await db.query(
        'INSERT INTO `users` (`telegram_id`, `username`, `gender`, `origin`, `rank`, `referrer_id`, `registered_at`) VALUES (?, ?, ?, ?, ?, ?, NOW())',
        [telegram_id, username, gender, origin, 'member', referrerId]
      );

      ctx.session.registration.done = true;
      if (referrerId) {
        delete ctx.session.referrerId; // Hapus dari session setelah digunakan
      }

      // Panggil proses referral reward di background (tidak perlu menunggu)
      processReferralRewards({ telegram_id, referrer_id: referrerId })
          .catch(e => console.error(`[REFERRAL] Background process error: ${e.message}`));

      return ctx.reply('Pendaftaran berhasil! Kamu dapat mengirim menfess di /start.');
    } catch (error) {
      console.error('Error inserting user:', error);
      return ctx.reply('Gagal mendaftar. Silakan coba lagi nanti.');
    }
  }

  return {
    handleRegisterText
  }
}