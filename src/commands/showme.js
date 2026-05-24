import { Markup } from 'telegraf';
import { Database } from './database.js';

/**
 * Handler untuk fitur Show Me
 * @param {Telegraf} bot
 */
export default function showMeHandler(bot) {
  const pendingRequests = new Map();
  const REQUEST_EXPIRY = 24 * 60 * 60 * 1000; // 24 jam

  console.log('👁️ Show Me handler initialized');

  function generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Handle show me button click
   */
  bot.action(/^show_me:(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();

      const messageId = ctx.match[1];
      const requesterId = ctx.from.id;

      console.log('👁️ Show Me button clicked by user:', requesterId, 'for message:', messageId);

      // Check if requester is registered
      const requesterUser = await Database.getUserById(requesterId);
      if (!requesterUser) {
        return ctx.reply(
          '❌ Kamu belum terdaftar!\n\n' +
          'Silakan daftar terlebih dahulu untuk menggunakan fitur Show Me.',
          Markup.inlineKeyboard([
            [Markup.button.callback('📝 Daftar Sekarang', 'btn_register')]
          ])
        );
      }

      // ✅ FIX BUG #2: Nama method yang benar adalah getConfessionByChannelMessageId,
      // bukan getConfessionByMessageId (yang tidak ada di database.js).
      const confession = await Database.getConfessionByChannelMessageId(messageId);
      if (!confession) {
        console.log('❌ Confession not found for message:', messageId);
        return ctx.reply('❌ Confession tidak ditemukan.');
      }

      // ✅ FIX BUG #2 (lanjutan): Field di tabel confessions adalah `telegram_id`, bukan `user_id`
      const confessionOwnerId = confession.telegram_id;

      // Check if user trying to show themselves
      if (requesterId === confessionOwnerId) {
        return ctx.reply('❌ Kamu tidak bisa melakukan Show Me pada confession sendiri.');
      }

      // Check if there's already a pending request
      const existingRequest = Array.from(pendingRequests.values()).find(
        req => req.fromUserId === requesterId && req.toUserId === confessionOwnerId && req.messageId === messageId
      );

      if (existingRequest) {
        return ctx.reply('⏳ Kamu sudah mengirim permintaan Show Me untuk confession ini. Tunggu balasan dari pengirim menfess.');
      }

      const requestId = generateRequestId();
      pendingRequests.set(requestId, {
        fromUserId: requesterId,
        toUserId: confessionOwnerId,
        messageId: messageId,
        timestamp: Date.now(),
        requesterData: requesterUser
      });

      console.log('📨 Show Me request created:', requestId);

      const notificationMessage =
        `👁️ *PERMINTAAN SHOW ME*\n\n` +
        `Seseorang ingin melihat data diri kamu dari confession yang kamu kirim.\n\n` +
        `👤 **Data Peminta:**\n` +
        `• Gender: ${getGenderEmoji(requesterUser.gender)} ${requesterUser.gender || 'Unknown'}\n` +
        `• Rank: ${getRankEmoji(requesterUser.rank)} ${requesterUser.rank || 'Member'}\n` +
        `• Origin: 📍 ${requesterUser.origin || 'Unknown'}\n\n` +
        `⚠️ **Yang akan dibagikan jika kamu setuju:**\n` +
        `• Username Telegram kamu\n` +
        `• Data profil lengkap (gender, rank, origin)\n` +
        `• Mereka bisa mengirim pesan langsung ke kamu\n\n` +
        `🕐 Permintaan ini akan kedaluwarsa dalam 24 jam.`;

      try {
        await ctx.telegram.sendMessage(confessionOwnerId, notificationMessage, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                Markup.button.callback('✅ Setuju', `approve_show:${requestId}`),
                Markup.button.callback('❌ Tolak', `reject_show:${requestId}`)
              ]
            ]
          }
        });

        await ctx.reply(
          '📤 **Permintaan Show Me terkirim!**\n\n' +
          '⏳ Menunggu persetujuan dari pengirim menfess...\n' +
          '🕐 Permintaan akan kedaluwarsa dalam 24 jam.\n\n' +
          '💡 Kamu akan mendapat notifikasi jika ada balasan.'
        );

        console.log('✅ Show Me request sent successfully');

      } catch (error) {
        console.error('❌ Error sending show me request:', error);
        pendingRequests.delete(requestId);

        if (error.code === 403) {
          await ctx.reply('❌ Pengirim confession telah memblokir bot. Show Me tidak dapat dilakukan.');
        } else {
          await ctx.reply('❌ Gagal mengirim permintaan Show Me. Silakan coba lagi nanti.');
        }
      }

    } catch (error) {
      console.error('❌ Error in show me handler:', error);
      await ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi nanti.');
    }
  });

  /**
   * Handle approve show me request
   */
  bot.action(/^approve_show:(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();

      const requestId = ctx.match[1];
      const approverId = ctx.from.id;

      console.log('✅ Show Me request approved by:', approverId, 'for request:', requestId);

      const request = pendingRequests.get(requestId);
      if (!request) {
        return ctx.reply('❌ Permintaan Show Me tidak ditemukan atau sudah kedaluwarsa.');
      }

      if (request.toUserId !== approverId) {
        return ctx.reply('❌ Kamu tidak memiliki otoritas untuk menyetujui permintaan ini.');
      }

      // ✅ FIX BUG #3: Ambil info Telegram (username, nama) dari Telegram API,
      // karena getUserById tidak menyimpan username di database.
      const approverDbData = await Database.getUserById(approverId);
      if (!approverDbData) {
        return ctx.reply('❌ Data kamu tidak ditemukan di database.');
      }

      let approverTelegramInfo;
      try {
        approverTelegramInfo = await ctx.telegram.getChat(approverId);
      } catch (err) {
        console.error('❌ Error fetching Telegram info for approver:', err);
        return ctx.reply('❌ Gagal mengambil data Telegram kamu. Silakan coba lagi.');
      }

      pendingRequests.delete(requestId);

      // ✅ FIX BUG #3: username diambil dari Telegram API, bukan dari DB
      const username = approverTelegramInfo.username;
      const approverDataMessage =
        `✅ **PERMINTAAN SHOW ME DISETUJUI!**\n\n` +
        `Pengirim menfess telah menyetujui untuk membagikan data diri mereka.\n\n` +
        `👤 **Data Pengirim Menfess:**\n` +
        `• Username: ${username ? '@' + username : 'Tidak tersedia'}\n` +
        `• Gender: ${getGenderEmoji(approverDbData.gender)} ${approverDbData.gender || 'Unknown'}\n` +
        `• Rank: ${getRankEmoji(approverDbData.rank)} ${approverDbData.rank || 'Member'}\n` +
        `• Origin: 📍 ${approverDbData.origin || 'Unknown'}\n\n` +
        `🎉 Sekarang kamu bisa mengirim pesan langsung atau berinteraksi dengan mereka!`;

      // ✅ FIX BUG #3: Tombol URL hanya ditampilkan jika username tersedia,
      // dan fallback menggunakan telegram_id (bukan user_id yang tidak ada)
      const replyMarkup = username
        ? {
            inline_keyboard: [
              [Markup.button.url('💌 Kirim Pesan Langsung', `https://t.me/${username}`)]
            ]
          }
        : {
            inline_keyboard: [
              [Markup.button.url('💌 Kirim Pesan via ID', `tg://user?id=${approverDbData.telegram_id}`)]
            ]
          };

      try {
        await ctx.telegram.sendMessage(request.fromUserId, approverDataMessage, {
          parse_mode: 'Markdown',
          reply_markup: replyMarkup
        });

        await ctx.reply(
          '✅ **Data kamu berhasil dibagikan!**\n\n' +
          `📤 Data diri kamu telah dikirim ke peminta Show Me.\n` +
          `👤 Mereka sekarang bisa mengirim pesan langsung ke kamu.\n\n` +
          `💡 **Tips:** Pastikan pengaturan privasi Telegram kamu memungkinkan pesan dari orang yang tidak dikenal.`
        );

        console.log('✅ Show Me data shared successfully');

      } catch (error) {
        console.error('❌ Error sharing show me data:', error);
        await ctx.reply('❌ Gagal membagikan data. Silakan coba lagi nanti.');
      }

    } catch (error) {
      console.error('❌ Error in approve show me:', error);
      await ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi nanti.');
    }
  });

  /**
   * Handle reject show me request
   */
  bot.action(/^reject_show:(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();

      const requestId = ctx.match[1];
      const rejecterId = ctx.from.id;

      console.log('❌ Show Me request rejected by:', rejecterId, 'for request:', requestId);

      const request = pendingRequests.get(requestId);
      if (!request) {
        return ctx.reply('❌ Permintaan Show Me tidak ditemukan atau sudah kedaluwarsa.');
      }

      if (request.toUserId !== rejecterId) {
        return ctx.reply('❌ Kamu tidak memiliki otoritas untuk menolak permintaan ini.');
      }

      pendingRequests.delete(requestId);

      try {
        await ctx.telegram.sendMessage(request.fromUserId,
          '❌ **Permintaan Show Me Ditolak**\n\n' +
          'Pengirim menfess telah menolak permintaan Show Me kamu.\n\n' +
          '💡 Kamu masih bisa menggunakan fitur "Hit Me" untuk chat anonymous dengan mereka.'
        );

        await ctx.reply(
          '❌ **Permintaan Show Me berhasil ditolak.**\n\n' +
          'Peminta telah diberitahu bahwa kamu menolak permintaan Show Me.\n\n' +
          '🔒 Data diri kamu tetap aman dan tidak dibagikan.'
        );

        console.log('✅ Show Me request rejected successfully');

      } catch (error) {
        console.error('❌ Error notifying rejection:', error);
        await ctx.reply('❌ Gagal memproses penolakan. Silakan coba lagi nanti.');
      }

    } catch (error) {
      console.error('❌ Error in reject show me:', error);
      await ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi nanti.');
    }
  });

  // Cleanup expired requests setiap 1 jam
  setInterval(() => {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [requestId, request] of pendingRequests.entries()) {
      if (now - request.timestamp > REQUEST_EXPIRY) {
        pendingRequests.delete(requestId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired Show Me requests`);
    }
  }, 60 * 60 * 1000);

  // Debug command untuk admin
  bot.command('debug_showme', async (ctx) => {
    if (ctx.from.id === parseInt(process.env.ADMIN_ID)) {
      const requestsList = Array.from(pendingRequests.entries()).map(([id, data]) =>
        `${id}: ${data.fromUserId} -> ${data.toUserId} (${new Date(data.timestamp).toLocaleString()})`
      );
      await ctx.reply(`Pending Show Me requests:\n${requestsList.join('\n') || 'None'}`);
    }
  });

  return {
    createShowMeButton: (messageId) => {
      return [Markup.button.callback('👁️ Show Me', `show_me:${messageId}`)];
    },
    getPendingRequestsCount: () => pendingRequests.size,
    clearRequest: (requestId) => pendingRequests.delete(requestId),
    getAllRequests: () => Array.from(pendingRequests.entries())
  };
}

// ─── Helper functions ────────────────────────────────────────────────────────

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