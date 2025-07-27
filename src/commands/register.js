import { supabase } from '../services/db.js'
import { Markup } from 'telegraf'

/**
 * Handler untuk perintah /register: mendaftarkan user ke DB Supabase
 * @param {Telegraf} bot
 */

export default function registerCommand(bot) {
  bot.command('register', async (ctx) => {
    const telegramId = ctx.from.id

    // Cek apakah user sudah terdaftar
    const { data: existing, error: fetchError } = await supabase
      .from('users')
      .select('telegram_id')
      .eq('telegram_id', telegramId)
      .limit(1)

    if (fetchError) {
      console.error('Error fetching user:', fetchError)
      return ctx.reply('Terjadi kesalahan saat memeriksa data. Coba lagi nanti.')
    }

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
  })

  bot.action('btn_register', async (ctx) => {
    await ctx.answerCbQuery();
    const telegramId = ctx.from.id

    // Cek apakah user sudah terdaftar
    const { data: existing, error: fetchError } = await supabase
      .from('users')
      .select('telegram_id')
      .eq('telegram_id', telegramId)
      .limit(1)

    if (fetchError) {
      console.error('Error fetching user:', fetchError)
      return ctx.reply('Terjadi kesalahan saat memeriksa data. Coba lagi nanti.')
    }

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
  });

  // Handler gender
  bot.action(/^gender_(.+)$/, async (ctx) => {
    const gender = ctx.match[1] // male / female / other
    ctx.session.registration.gender = gender

    await ctx.answerCbQuery()
    await ctx.editMessageText(`Gender kamu: ${gender}.`)

    // Minta asal
    await ctx.reply('Masukkan asal kamu (opsional). Bisa dikosongkan atau ketik `-` jika tidak ingin isi.')
  })

  async function handleRegisterText (ctx, next) {
    if (!ctx.session?.registration?.gender || ctx.session?.registration?.done) {
      return next(); // Lanjutkan ke handler lain
    }
  
    const originInput = ctx.message.text.trim()
    const origin = originInput === '-' ? null : originInput
  
    const { telegram_id, gender } = ctx.session.registration
  
    const { error } = await supabase.from('users').insert({
      telegram_id,
      gender,
      origin,
      rank: 'bronze',
      registered_at: new Date().toISOString(),
    })
  
    ctx.session.registration.done = true
  
    if (error) {
      console.error('Error inserting user:', error)
      return ctx.reply('Gagal mendaftar. Silakan coba lagi nanti.')
    }
  
    return ctx.reply('Pendaftaran berhasil! Kamu dapat mengirim menfess di /start.')
  } 
  return {
    handleRegisterText
  }
  // Handler asal (teks biasa setelah gender)
  // bot.on('text', async (ctx, next) => {
  //   // Pastikan ini adalah sesi registrasi yang aktif
  //   if (!ctx.session?.registration?.gender || ctx.session?.registration?.done) {
  //     return next(); // Lanjutkan ke handler lain
  //   }

  //   const originInput = ctx.message.text.trim()
  //   const origin = originInput === '-' ? null : originInput

  //   const { telegram_id, gender } = ctx.session.registration

  //   const { error } = await supabase.from('users').insert({
  //     telegram_id,
  //     gender,
  //     origin,
  //     rank: 'bronze',
  //     registered_at: new Date().toISOString(),
  //   })

  //   ctx.session.registration.done = true

  //   if (error) {
  //     console.error('Error inserting user:', error)
  //     return ctx.reply('Gagal mendaftar. Silakan coba lagi nanti.')
  //   }

  //   return ctx.reply('Pendaftaran berhasil! Kamu dapat mengirim menfess di /start.')
  // });
}
