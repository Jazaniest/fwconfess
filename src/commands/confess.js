import { Markup } from 'telegraf';
import { Database } from './database.js';
import commentHandler from './comment.js';
import showMeHandler from './showme.js';

/**
 * Handler untuk logika menfess
 * @param {Telegraf} bot
 * @param {string|number} targetChannelId - ID channel atau group untuk publish
 */
export default function confessCommand(bot, targetChannelId) {
  // ✅ FIX BUG #4: Validasi targetChannelId di awal. Jika tidak di-set,
  // lempar error saat inisialisasi agar masalah terdeteksi segera,
  // bukan saat user pertama kali mencoba kirim confession.
  if (!targetChannelId) {
    throw new Error(
      '❌ KONFIG ERROR: TARGET_CHANNEL_ID tidak di-set di environment variables!\n' +
      'Tambahkan TARGET_CHANNEL_ID ke file .env kamu.'
    );
  }

  const pending = new Map();
  const lastSent = new Map();
  const LIMIT_MS = 8 * 60 * 60 * 1000; // 8 jam

  const commentSystem = commentHandler(bot, process.env.DISCUSSION_GROUP_ID);
  const showMeSystem = showMeHandler(bot);

  console.log('🚀 Confess command initialized with channel:', targetChannelId);
  console.log('💬 Discussion group ID:', process.env.DISCUSSION_GROUP_ID);
  console.log('💬 Comment system enabled:', commentSystem.isCommentSystemEnabled());

  // Tombol Kirim Menfess dari startCommand
  bot.action('btn_confess', async (ctx) => {
    try {
      console.log('🔘 Button confess clicked by user:', ctx.from.id);
      await ctx.answerCbQuery();
      const userId = ctx.from.id;

      const user = await Database.getUserById(userId);
      if (!user) {
        console.log('❌ User not registered:', userId);
        return ctx.reply(
          '❌ Kamu belum terdaftar!\n\n' +
          'Silakan daftar terlebih dahulu untuk bisa mengirim menfess.',
          Markup.inlineKeyboard([
            [Markup.button.callback('📝 Daftar Sekarang', 'btn_register')],
            [Markup.button.callback('🏠 Kembali ke Menu', 'btn_back_to_start')]
          ])
        );
      }

      // Check rate limit
      const lastTime = lastSent.get(userId) || 0;
      const now = Date.now();

      if (now - lastTime < LIMIT_MS) {
        const nextAllowed = new Date(lastTime + LIMIT_MS);
        console.log('🚫 Rate limit hit for user:', userId);
        return ctx.reply(
          `⏰ Kamu sudah menfess dalam 8 jam terakhir.\n\n` +
          `Coba lagi setelah: *${nextAllowed.toLocaleString('id-ID')}*`,
          { parse_mode: 'Markdown' }
        );
      }

      pending.set(userId, { timestamp: now, user });
      console.log('📝 User added to pending list:', userId);

      const instructionText = commentSystem.isCommentSystemEnabled()
        ? '📝 *Kirim Menfess*\n\n' +
          'Silakan ketik confession kamu. Pastikan menyertakan tag *#fwconfess*\n\n' +
          '⚠️ *Perhatian:*\n' +
          '• Menfess akan ditampilkan dengan gender dan rank kamu\n' +
          '• User lain bisa klik "Hit Me" untuk chat anonymous\n' +
          '• User bisa memberikan komentar di grup diskusi\n' +
          '• Jaga sopan santun dalam menfess\n\n' +
          '💡 *Tips:* Ketik `/cancel` untuk membatalkan'
        : '📝 *Kirim Menfess*\n\n' +
          'Silakan ketik confession kamu. Pastikan menyertakan tag *#fwconfess*\n\n' +
          '⚠️ *Perhatian:*\n' +
          '• Menfess akan ditampilkan dengan gender dan rank kamu\n' +
          '• User lain bisa klik "Hit Me" untuk chat anonymous\n' +
          '• Jaga sopan santun dalam menfess\n\n' +
          '💡 *Tips:* Ketik `/cancel` untuk membatalkan';

      await ctx.reply(instructionText, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('❌ Error in btn_confess:', error);
      await ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi nanti.');
    }
  });

  // Command untuk cancel confession
  bot.command('cancel', async (ctx) => {
    const userId = ctx.from.id;
    if (pending.has(userId)) {
      pending.delete(userId);
      await ctx.reply('❌ Confession dibatalkan.');
    } else {
      await ctx.reply('❌ Tidak ada confession yang sedang dibuat.');
    }
  });

  async function handleConfessText(ctx, next) {
    const userId = ctx.from.id;
    const text = ctx.message.text;

    console.log('📨 ===== TEXT MESSAGE RECEIVED =====');
    console.log('👤 User ID:', userId);
    console.log('💬 Message text:', text);
    console.log('📋 Is user in pending?', pending.has(userId));

    if (text.startsWith('/')) {
      console.log('⏭️ Skipping - Message is a command');
      return;
    }

    if (!pending.has(userId)) {
      console.log('⏭️ Skipping - User not in pending list');
      return;
    }

    console.log('🎯 PROCESSING CONFESSION from user:', userId);

    try {
      const pendingData = pending.get(userId);
      const user = pendingData.user;

      // Hapus dari pending setelah dapat data
      pending.delete(userId);

      // Cek rate limit lagi (double check)
      const lastTime = lastSent.get(userId) || 0;
      const now = Date.now();

      if (now - lastTime < LIMIT_MS) {
        const nextAllowed = new Date(lastTime + LIMIT_MS);
        return ctx.reply(
          `⏰ Kamu sudah menfess dalam 8 jam terakhir.\n\n` +
          `Coba lagi setelah: *${nextAllowed.toLocaleString('id-ID')}*`,
          { parse_mode: 'Markdown' }
        );
      }

      if (!text.includes('#fwconfess')) {
        // Kembalikan user ke pending karena tag salah
        pending.set(userId, { timestamp: now, user });
        return ctx.reply(
          '❌ Tag *#fwconfess* tidak ditemukan.\n\n' +
          'Tambahkan tag tersebut agar confession dapat dipublish.\n\n' +
          '💡 Ketik confession kamu lagi dengan tag #fwconfess',
          { parse_mode: 'Markdown' }
        );
      }

      if (text.length > 4000) {
        pending.set(userId, { timestamp: now, user });
        return ctx.reply(
          '❌ Confession terlalu panjang!\n\n' +
          'Maksimal 4000 karakter. Saat ini: ' + text.length + ' karakter'
        );
      }

      const confessionMessage = formatConfessionMessage(text, user);
      console.log('📡 Attempting to send message to channel:', targetChannelId);

      // Kirim ke grup diskusi
      const commentUrl = await commentSystem.sendToDiscussionGroup(ctx, confessionMessage);

      // Buat inline keyboard awal (tanpa Show Me dulu)
      const inlineKeyboard = commentSystem.createInlineKeyboard(commentUrl, userId);

      // Kirim ke channel
      const result = await ctx.telegram.sendMessage(targetChannelId, confessionMessage, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: inlineKeyboard }
      });

      console.log('✅ Message sent successfully to channel, message_id:', result.message_id);

      // ✅ FIX BUG #5: Tambahkan tombol Show Me via edit, dengan try-catch tersendiri
      // agar jika edit gagal, confession yang sudah terkirim tetap valid dan user
      // tetap mendapat pesan sukses — tidak perlu rollback seluruh proses.
      try {
        inlineKeyboard.push(showMeSystem.createShowMeButton(result.message_id));
        await ctx.telegram.editMessageReplyMarkup(
          targetChannelId,
          result.message_id,
          null,
          { inline_keyboard: inlineKeyboard }
        );
        console.log('✅ Show Me button added to message');
      } catch (editErr) {
        // Confession sudah terkirim, hanya tombol Show Me yang gagal ditambah.
        // Log error tapi jangan hentikan proses atau notifikasi error ke user.
        console.error('⚠️ Gagal menambahkan tombol Show Me (confession tetap terkirim):', editErr.message);
      }

      // Simpan timestamp rate limit SETELAH berhasil kirim
      lastSent.set(userId, now);
      console.log('⏰ Rate limit timestamp saved for user:', userId);

      // Save confession to database
      console.log('💾 Saving confession to database...');
      await Database.saveConfession(userId, text, result.message_id);
      console.log('✅ Confession saved to database');

      const successMessage = commentUrl
        ? '🎉 *Menfess berhasil dipublish!*\n\n' +
          '• Menfess kamu sudah tayang di channel\n' +
          '• User lain bisa klik "Hit Me" untuk chat denganmu\n' +
          '• User bisa memberikan komentar melalui tombol "Comment"\n' +
          '• Kamu akan dapat notifikasi jika ada yang tertarik\n\n' +
          '⏰ Kamu bisa menfess lagi dalam 8 jam'
        : '🎉 *Menfess berhasil dipublish!*\n\n' +
          '• Menfess kamu sudah tayang di channel\n' +
          '• User lain bisa klik "Hit Me" untuk chat denganmu\n' +
          '• Kamu akan dapat notifikasi jika ada yang tertarik\n\n' +
          '⏰ Kamu bisa menfess lagi dalam 8 jam';

      await ctx.reply(successMessage, { parse_mode: 'Markdown' });
      console.log('🎉 SUCCESS: Confession processed completely for user:', userId);

    } catch (err) {
      console.error('❌ ===== ERROR PROCESSING CONFESSION =====');
      console.error('👤 User:', userId);
      console.error('💥 Error:', err);
      console.error('🔍 Error code:', err.code);
      console.error('📡 Error response:', err.response);
      console.error('📚 Stack trace:', err.stack);
      console.error('==========================================');

      // Kembalikan user ke pending jika error bukan dari rate limit
      if (err.code !== 429) {
        try {
          const userData = await Database.getUserById(userId);
          if (userData) {
            pending.set(userId, { timestamp: Date.now(), user: userData });
            console.log('🔄 User returned to pending due to error');
          }
        } catch (dbError) {
          console.error('❌ Error getting user data for pending restore:', dbError);
        }
      }

      let errorMessage = '❌ Terjadi kesalahan saat publish confession.\n\n';

      if (err.code === 403) {
        errorMessage += '🚫 Bot tidak memiliki izin untuk mengirim pesan ke channel tersebut.';
      } else if (err.code === 400) {
        errorMessage += '📝 Format pesan tidak valid. Periksa kembali confession kamu.';
      } else if (err.code === 429) {
        errorMessage += '⏰ Terlalu banyak permintaan. Coba lagi dalam beberapa menit.';
      } else if (err.message && err.message.includes('chat not found')) {
        errorMessage += '🔍 Channel tidak ditemukan. Periksa ID channel.';
      } else {
        errorMessage += '🔧 Silakan coba lagi nanti.';
      }

      await ctx.reply(errorMessage);
    }
  }

  // Debug commands untuk testing
  // ✅ FIX MINOR: Hapus hardcoded ID 123456789, hanya gunakan ADMIN_ID dari env
  bot.command('debug_pending', async (ctx) => {
    if (ctx.from.id === parseInt(process.env.ADMIN_ID)) {
      const pendingList = Array.from(pending.entries()).map(([id, data]) =>
        `${id}: ${data.user.gender || 'Unknown'} - ${new Date(data.timestamp).toLocaleString()}`
      );
      await ctx.reply(`Pending users:\n${pendingList.join('\n') || 'None'}`);
    }
  });

  bot.command('debug_ratelimit', async (ctx) => {
    if (ctx.from.id === parseInt(process.env.ADMIN_ID)) {
      const rateList = Array.from(lastSent.entries()).map(([id, time]) =>
        `${id}: ${new Date(time).toLocaleString()}`
      );
      await ctx.reply(`Rate limits:\n${rateList.join('\n') || 'None'}`);
    }
  });

  return {
    handleConfessText,
    isUserPending: (userId) => pending.has(userId),
    getPendingUsers: () => Array.from(pending.keys()),
    getLastSentTimes: () => Array.from(lastSent.entries()),
    clearPending: (userId) => pending.delete(userId),
    clearRateLimit: (userId) => lastSent.delete(userId),
    forceAddPending: async (userId) => {
      const user = await Database.getUserById(userId);
      if (user) {
        pending.set(userId, { timestamp: Date.now(), user });
        return true;
      }
      return false;
    },
    commentSystem,
    showMeSystem
  };
}

// ─── Helper functions ────────────────────────────────────────────────────────

function formatConfessionMessage(text, user) {
  const genderEmoji = getGenderEmoji(user.gender);
  const rankEmoji = getRankEmoji(user.rank);
  const safeGender = user.gender || 'Unknown';
  const safeRank = user.rank || 'Member';
  const safeOrigin = user.origin || 'Unknown';

  return `💭 *ANONYMOUS CONFESSION*\n\n` +
         `${text}\n\n` +
         `━━━━━━━━━━━━━━━━━━━\n` +
         `${genderEmoji} Gender: *${safeGender}*\n` +
         `${rankEmoji} Rank: *${safeRank}*\n` +
         `📍 Origin: *${safeOrigin}*`;
}

function getGenderEmoji(gender) {
  const genderEmojis = {
    'male': '👨', 'female': '👩',
    'laki-laki': '👨', 'perempuan': '👩',
    'pria': '👨', 'wanita': '👩',
    'l': '👨', 'p': '👩'
  };
  return genderEmojis[gender?.toLowerCase()] || '👤';
}

function getRankEmoji(rank) {
  const rankEmojis = {
    'admin': '👑', 'moderator': '🛡️',
    'vip': '⭐', 'premium': '💎',
    'member': '👤', 'newbie': '🌱'
  };
  return rankEmojis[rank?.toLowerCase()] || '👤';
}