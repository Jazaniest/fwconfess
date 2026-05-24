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

      const requesterUser = await Database.getUserById(requesterId);
      if (!requesterUser) {
        // ✅ Kirim ke private peminta, bukan grup
        return ctx.telegram.sendMessage(requesterId,
          '❌ Kamu belum terdaftar!\n\nSilakan daftar terlebih dahulu.',
          Markup.inlineKeyboard([[Markup.button.callback('📝 Daftar Sekarang', 'btn_register')]])
        );
      }

      const confession = await Database.getConfessionByChannelMessageId(messageId);
      if (!confession) {
        return ctx.telegram.sendMessage(requesterId, '❌ Confession tidak ditemukan.');
      }

      const confessionOwnerId = confession.telegram_id;

      if (requesterId === confessionOwnerId) {
        return ctx.telegram.sendMessage(requesterId,
          '❌ Kamu tidak bisa melakukan Show Me pada confession sendiri.'
        );
      }

      const existingRequest = Array.from(pendingRequests.values()).find(
        req => req.fromUserId === requesterId && req.toUserId === confessionOwnerId && req.messageId === messageId
      );
      if (existingRequest) {
        return ctx.telegram.sendMessage(requesterId,
          '⏳ Kamu sudah mengirim permintaan Show Me untuk confession ini.'
        );
      }

      const requestId = generateRequestId();

      // ✅ Kirim pesan "menunggu" ke private peminta, simpan messageId-nya
      const sentMsg = await ctx.telegram.sendMessage(requesterId,
        '📤 *Permintaan Show Me terkirim\\!*\n\n' +
        '⏳ Menunggu persetujuan dari pengirim menfess\\.\\.\\.\n' +
        '🕐 Permintaan akan kedaluwarsa dalam 24 jam\\.\n\n' +
        '💡 Pesan ini akan diperbarui otomatis jika ada balasan\\.',
        { parse_mode: 'MarkdownV2' }
      );

      pendingRequests.set(requestId, {
        fromUserId: requesterId,
        toUserId: confessionOwnerId,
        messageId: messageId,
        timestamp: Date.now(),
        requesterData: requesterUser,
        // ✅ Simpan messageId pesan "menunggu" untuk diedit nanti
        pendingMsgId: sentMsg.message_id
      });

      // Kirim notif ke owner confession
      try {
        const notificationMessage =
          `👁️ *PERMINTAAN SHOW ME*\n\n` +
          `Seseorang ingin melihat data diri kamu dari confession yang kamu kirim\\.\n\n` +
          `👤 *Data Peminta:*\n` +
          `• Gender: ${getGenderEmoji(requesterUser.gender)} ${requesterUser.gender || 'Unknown'}\n` +
          `• Rank: ${getRankEmoji(requesterUser.rank)} ${requesterUser.rank || 'Member'}\n` +
          `• Origin: 📍 ${requesterUser.origin || 'Unknown'}\n\n` +
          `🕐 Permintaan kedaluwarsa dalam 24 jam\\.`;

        await ctx.telegram.sendMessage(confessionOwnerId, notificationMessage, {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [[
              Markup.button.callback('✅ Setuju', `approve_show:${requestId}`),
              Markup.button.callback('❌ Tolak', `reject_show:${requestId}`)
            ]]
          }
        });

      } catch (error) {
        pendingRequests.delete(requestId);
        const errMsg = error.code === 403
          ? '❌ Pengirim confession telah memblokir bot. Show Me tidak dapat dilakukan.'
          : '❌ Gagal mengirim permintaan Show Me. Silakan coba lagi nanti.';

        // ✅ Edit pesan "menunggu" menjadi pesan error
        await ctx.telegram.editMessageText(
          requesterId, sentMsg.message_id, undefined, errMsg
        ).catch(() => ctx.telegram.sendMessage(requesterId, errMsg));
      }

    } catch (error) {
      console.error('❌ Error in show me handler:', error);
      // Fallback tetap ke private
      await ctx.telegram.sendMessage(ctx.from.id, '❌ Terjadi kesalahan. Silakan coba lagi nanti.')
        .catch(() => {});
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

      const request = pendingRequests.get(requestId);
      if (!request) {
        return ctx.reply('❌ Permintaan Show Me tidak ditemukan atau sudah kedaluwarsa.');
      }
      if (request.toUserId !== approverId) {
        return ctx.reply('❌ Kamu tidak memiliki otoritas untuk menyetujui permintaan ini.');
      }

      const approverDbData = await Database.getUserById(approverId);
      if (!approverDbData) {
        return ctx.reply('❌ Data kamu tidak ditemukan di database.');
      }

      let approverTelegramInfo;
      try {
        approverTelegramInfo = await ctx.telegram.getChat(approverId);
      } catch (err) {
        return ctx.reply('❌ Gagal mengambil data Telegram kamu. Silakan coba lagi.');
      }

      pendingRequests.delete(requestId);

      const username = approverTelegramInfo.username;
      const approverDataMessage =
        `✅ *PERMINTAAN SHOW ME DISETUJUI\\!*\n\n` +
        `Pengirim menfess telah menyetujui permintaan kamu\\.\n\n` +
        `👤 *Data Pengirim Menfess:*\n` +
        `• Username: ${username ? '@' + username : 'Tidak tersedia'}\n` +
        `• Gender: ${getGenderEmoji(approverDbData.gender)} ${approverDbData.gender || 'Unknown'}\n` +
        `• Rank: ${getRankEmoji(approverDbData.rank)} ${approverDbData.rank || 'Member'}\n` +
        `• Origin: 📍 ${approverDbData.origin || 'Unknown'}\n\n` +
        `🎉 Sekarang kamu bisa mengirim pesan langsung ke mereka\\!`;

      const replyMarkup = username
        ? { inline_keyboard: [[Markup.button.url('💌 Kirim Pesan Langsung', `https://t.me/${username}`)]] }
        : { inline_keyboard: [[Markup.button.url('💌 Kirim Pesan via ID', `tg://user?id=${approverDbData.telegram_id}`)]] };

      try {
        // ✅ Edit pesan "menunggu" yang sudah ada → ganti dengan data owner
        await ctx.telegram.editMessageText(
          request.fromUserId,
          request.pendingMsgId,  // messageId pesan "menunggu" yang disimpan tadi
          undefined,
          approverDataMessage,
          { parse_mode: 'MarkdownV2', reply_markup: replyMarkup }
        );
      } catch (editErr) {
        // Fallback: kirim pesan baru jika edit gagal (pesan terlalu lama, dsb)
        await ctx.telegram.sendMessage(request.fromUserId, approverDataMessage, {
          parse_mode: 'MarkdownV2',
          reply_markup: replyMarkup
        });
      }

      // Balas ke owner di private mereka sendiri
      await ctx.reply(
        '✅ Data kamu berhasil dibagikan\\!\n\n' +
        'Mereka sekarang bisa mengirim pesan langsung ke kamu\\.',
        { parse_mode: 'MarkdownV2' }
      );

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

      const request = pendingRequests.get(requestId);
      if (!request) {
        return ctx.reply('❌ Permintaan Show Me tidak ditemukan atau sudah kedaluwarsa.');
      }
      if (request.toUserId !== rejecterId) {
        return ctx.reply('❌ Kamu tidak memiliki otoritas untuk menolak permintaan ini.');
      }

      pendingRequests.delete(requestId);

      const rejectionMsg =
        '❌ *Permintaan Show Me Ditolak*\n\n' +
        'Pengirim menfess menolak permintaan Show Me kamu\\.\n\n' +
        '💡 Kamu masih bisa menggunakan fitur "Hit Me" untuk chat anonymous\\.';

      try {
        // ✅ Edit pesan "menunggu" → ganti dengan notif penolakan
        await ctx.telegram.editMessageText(
          request.fromUserId,
          request.pendingMsgId,
          undefined,
          rejectionMsg,
          { parse_mode: 'MarkdownV2' }
        );
      } catch {
        await ctx.telegram.sendMessage(request.fromUserId, rejectionMsg, { parse_mode: 'MarkdownV2' });
      }

      await ctx.reply(
        '❌ Permintaan Show Me berhasil ditolak\\.\n\n🔒 Data diri kamu tetap aman\\.',
        { parse_mode: 'MarkdownV2' }
      );

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