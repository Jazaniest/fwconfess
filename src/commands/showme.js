import { Markup } from 'telegraf';
import { Database } from './database.js';

/**
 * Handler untuk fitur Show Me
 * @param {Telegraf} bot
 */
export default function showMeHandler(bot) {
  const pendingRequests = new Map();
  // ✅ BARU: antrian per owner. key = ownerId, value = [requestId, requestId, ...]
  const ownerQueues = new Map();
  const REQUEST_EXPIRY = 24 * 60 * 60 * 1000;

  // ─── Rate limit helper ───────────────────────────────────────────────────────

  async function getRLConfig(userId) {
    const windowHours = parseFloat(
      await Database.getConfig('confession_window_hours', '8')
    );
    const effectiveRank = await Database.getEffectiveRank(userId);
    const maxCount      = await Database.getActionLimitByRank(effectiveRank, 'showme');
    return {
      maxCount,
      windowMs  : windowHours * 60 * 60 * 1000,
      windowHours,
    };
  }

  // Escape semua karakter reserved MarkdownV2
  function escapeMarkdownV2(text) {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
  }

  // async function getRLConfig(userId) {
  //   const cfg = await Database.getConfigs([
  //     'confession_window_hours',
  //     'ratelimit_msg_hit',
  //   ]);
  //   const effectiveRank = await Database.getEffectiveRank(userId);
  //   const maxCount      = await Database.getActionLimitByRank(effectiveRank, 'showme');
  //   const windowHours   = parseFloat(cfg['confession_window_hours'] || '8');
  //   return {
  //     maxCount,
  //     windowMs   : windowHours * 60 * 60 * 1000,
  //     windowHours,
  //     // Pesan default sudah pakai escape manual, tapi nilai dari DB perlu di-escape saat render
  //     msgHit: cfg['ratelimit_msg_hit'] || '⏰ Kamu sudah melakukan Show Me {count}x dalam {hours} jam terakhir\\.\n\nCoba lagi setelah: *{next_time}*',
  //   };
  // }

  // function renderMsg(template, vars = {}) {
  //   return Object.entries(vars).reduce(
  //     (str, [k, v]) => str.replaceAll(`{${k}}`, v),
  //     template
  //   );
  // }

  function generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ─── Helper: ambil request aktif milik owner (yang sedang menunggu aksi) ───
  function getActiveRequestForOwner(ownerId) {
    const queue = ownerQueues.get(ownerId);
    if (!queue || queue.length === 0) return null;
    // Posisi 0 = selalu yang sedang aktif (sudah dikirim notif ke owner)
    return pendingRequests.get(queue[0]) || null;
  }

  // ─── Helper: kirim notif Show Me ke owner ───────────────────────────────────
  async function sendShowMeNotifToOwner(ctx, requestId, request) {
    const { requesterData, toUserId } = request;

    const notificationMessage =
      `👁️ *PERMINTAAN SHOW ME*\n\n` +
      `Seseorang ingin melihat data diri kamu dari confession yang kamu kirim\\.\n\n` +
      `👤 *Data Peminta:*\n` +
      `• Gender: ${getGenderEmoji(requesterData.gender)} ${requesterData.gender || 'Unknown'}\n` +
      `• Rank: ${getRankEmoji(requesterData.rank)} ${requesterData.rank || 'Member'}\n` +
      `• Origin: 📍 ${requesterData.origin || 'Unknown'}\n\n` +
      `🕐 Permintaan kedaluwarsa dalam 24 jam\\.`;

    await ctx.telegram.sendMessage(toUserId, notificationMessage, {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [[
          Markup.button.callback('✅ Setuju', `approve_show:${requestId}`),
          Markup.button.callback('❌ Tolak', `reject_show:${requestId}`)
        ]]
      }
    });
  }

  // ─── Helper: selesaikan request dan proses antrian berikutnya ───────────────
  async function finishAndDequeue(ctx, ownerId, doneRequestId) {
    const queue = ownerQueues.get(ownerId) || [];

    // Hapus request yang baru selesai dari posisi 0
    const newQueue = queue.filter(id => id !== doneRequestId);
    pendingRequests.delete(doneRequestId);

    if (newQueue.length === 0) {
      ownerQueues.delete(ownerId);
      return;
    }

    ownerQueues.set(ownerId, newQueue);

    // ✅ Ambil request berikutnya (posisi 0 baru) dan kirim notif ke owner
    const nextRequestId = newQueue[0];
    const nextRequest = pendingRequests.get(nextRequestId);
    if (!nextRequest) {
      // Request berikutnya sudah expired, skip dan rekursif
      await finishAndDequeue(ctx, ownerId, nextRequestId);
      return;
    }

    try {
      // Beritahu peminta berikutnya bahwa giliran mereka sedang diproses
      await ctx.telegram.sendMessage(
        nextRequest.fromUserId,
        '⏳ *Permintaan kamu sedang diproses\\!*\n\nPengirim menfess sedang mereview permintaan Show Me kamu\\.',
        { parse_mode: 'MarkdownV2' }
      );

      await sendShowMeNotifToOwner(ctx, nextRequestId, nextRequest);
    } catch (err) {
      console.error('❌ Error sending next queued request:', err);
      // Kalau gagal kirim, skip ke antrian selanjutnya
      await finishAndDequeue(ctx, ownerId, nextRequestId);
    }
  }

  // ─── Handler: user klik Show Me ────────────────────────────────────────────
  bot.action(/^show_me:(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();

      const messageId = ctx.match[1];
      const requesterId = ctx.from.id;

      const requesterUser = await Database.getUserById(requesterId);
      if (!requesterUser) {
        return ctx.telegram.sendMessage(requesterId,
          '❌ Kamu belum terdaftar\\!\n\nSilakan daftar terlebih dahulu\\.',
          {
            parse_mode: 'MarkdownV2',
            reply_markup: Markup.inlineKeyboard([[Markup.button.callback('📝 Daftar Sekarang', 'btn_register')]])
          }
        );
      }

      // ─── Rate limit check ─────────────────────────────────────────────────
      const rlCfg       = await getRLConfig(requesterId);
      const recentCount = await Database.countRecentActions(requesterId, 'showme', rlCfg.windowMs);

      if (recentCount >= rlCfg.maxCount) {
        const oldest      = await Database.getOldestActionTime(requesterId, 'showme', rlCfg.windowMs);
        const nextAllowed = new Date(oldest.getTime() + rlCfg.windowMs);
        const nextTimeStr = escapeMarkdownV2(nextAllowed.toLocaleString('id-ID'));
        return ctx.telegram.sendMessage(
          requesterId,
          `⏰ *Kamu sudah melakukan Show Me ${rlCfg.maxCount}x dalam ${rlCfg.windowHours} jam terakhir\\.*\n\nCoba lagi setelah: ${nextTimeStr}`,
          { parse_mode: 'MarkdownV2' }
        );
      }

      const confession = await Database.getConfessionByChannelMessageId(messageId);
      if (!confession) {
        return ctx.telegram.sendMessage(requesterId, '❌ Confession tidak ditemukan\\.', { parse_mode: 'MarkdownV2' });
      }

      const confessionOwnerId = confession.telegram_id;

      if (requesterId === confessionOwnerId) {
        return ctx.telegram.sendMessage(requesterId,
          '❌ Kamu tidak bisa melakukan Show Me pada confession sendiri\\.',
          { parse_mode: 'MarkdownV2' }
        );
      }

      // Cek duplikat: peminta yang sama ke confession yang sama
      const isDuplicate = Array.from(pendingRequests.values()).some(
        req => req.fromUserId === requesterId && req.toUserId === confessionOwnerId && req.messageId === messageId
      );
      if (isDuplicate) {
        return ctx.telegram.sendMessage(requesterId,
          '⏳ Kamu sudah mengirim permintaan Show Me untuk confession ini\\.',
          { parse_mode: 'MarkdownV2' }
        );
      }

      const requestId = generateRequestId();

      // Kirim pesan "menunggu" ke private peminta, simpan messageId-nya
      const sentMsg = await ctx.telegram.sendMessage(requesterId,
        '📤 *Permintaan Show Me terkirim\\!*\n\n' +
        '⏳ Menunggu persetujuan dari pengirim menfess\\.\n' +
        '🕐 Permintaan akan kedaluwarsa dalam 24 jam\\.',
        { parse_mode: 'MarkdownV2' }
      );

      pendingRequests.set(requestId, {
        fromUserId: requesterId,
        toUserId: confessionOwnerId,
        messageId,
        timestamp: Date.now(),
        requesterData: requesterUser,
        pendingMsgId: sentMsg.message_id
      });

      // ✅ Masukkan ke antrian owner
      const queue = ownerQueues.get(confessionOwnerId) || [];
      queue.push(requestId);
      ownerQueues.set(confessionOwnerId, queue);

      // Catat ke DB
      await Database.recordActionSent(requesterId, 'showme');

      console.log(`📋 Queue owner ${confessionOwnerId}: ${queue.length} request(s)`);

      // ✅ Kirim notif ke owner HANYA jika ini adalah request pertama di antrian
      // (queue.length === 1 berarti baru saja ditambahkan dan tidak ada yang aktif sebelumnya)
      if (queue.length === 1) {
        try {
          await sendShowMeNotifToOwner(ctx, requestId, pendingRequests.get(requestId));
        } catch (error) {
          pendingRequests.delete(requestId);
          ownerQueues.set(confessionOwnerId, queue.filter(id => id !== requestId));

          const errMsg = error.code === 403
            ? '❌ Pengirim confession telah memblokir bot\\. Show Me tidak dapat dilakukan\\.'
            : '❌ Gagal mengirim permintaan Show Me\\. Silakan coba lagi nanti\\.';

          await ctx.telegram.editMessageText(
            requesterId, sentMsg.message_id, undefined, errMsg, { parse_mode: 'MarkdownV2' }
          ).catch(() => ctx.telegram.sendMessage(requesterId, errMsg, { parse_mode: 'MarkdownV2' }));
        }
      } else {
        // ✅ Ada yang sedang aktif, beritahu peminta bahwa mereka sedang antre
        await ctx.telegram.editMessageText(
        requesterId, sentMsg.message_id, undefined,
        '📤 *Permintaan Show Me terkirim\\!*\n\n' +
        '⏳ Menunggu persetujuan dari pengirim menfess\\.\n' +
        '🕐 Permintaan akan kedaluwarsa dalam 24 jam\\.',
        { parse_mode: 'MarkdownV2' }
      ).catch(() => {});
    }

    } catch (error) {
      console.error('❌ Error in show me handler:', error);
      await ctx.telegram.sendMessage(ctx.from.id, '❌ Terjadi kesalahan\\. Silakan coba lagi nanti\\.', { parse_mode: 'MarkdownV2' }).catch(() => {});
    }
  });

  // ─── Handler: owner setuju ──────────────────────────────────────────────────
  bot.action(/^approve_show:(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();

      const requestId = ctx.match[1];
      const approverId = ctx.from.id;

      const request = pendingRequests.get(requestId);
      if (!request) {
        return ctx.reply('❌ Permintaan Show Me tidak ditemukan atau sudah kedaluwarsa\\.');
      }
      if (request.toUserId !== approverId) {
        return ctx.reply('❌ Kamu tidak memiliki otoritas untuk menyetujui permintaan ini\\.');
      }

      const approverDbData = await Database.getUserById(approverId);
      if (!approverDbData) return ctx.reply('❌ Data kamu tidak ditemukan di database\\.');

      let approverTelegramInfo;
      try {
        approverTelegramInfo = await ctx.telegram.getChat(approverId);
      } catch {
        return ctx.reply('❌ Gagal mengambil data Telegram kamu\\. Silakan coba lagi\\.');
      }

      const username = approverTelegramInfo.username;
      const approverDataMessage =
        `✅ *PERMINTAAN SHOW ME DISETUJUI\\!*\n\n` +
        `👤 *Data Pengirim Menfess:*\n` +
        `• Username: ${username ? '@' + username : 'Tidak tersedia'}\n` +
        `• Gender: ${getGenderEmoji(approverDbData.gender)} ${approverDbData.gender || 'Unknown'}\n` +
        `• Rank: ${getRankEmoji(approverDbData.rank)} ${approverDbData.rank || 'Member'}\n` +
        `• Origin: 📍 ${approverDbData.origin || 'Unknown'}\n\n` +
        `🎉 Kamu sekarang bisa menghubungi mereka\\!`;

      const replyMarkup = username
        ? { inline_keyboard: [[Markup.button.url('💌 Kirim Pesan Langsung', `https://t.me/${username}`)]] }
        : { inline_keyboard: [[Markup.button.url('💌 Kirim Pesan via ID', `tg://user?id=${approverDbData.telegram_id}`)]] };

      // Edit pesan "menunggu" di private peminta → tampilkan data
      await ctx.telegram.editMessageText(
        request.fromUserId, request.pendingMsgId, undefined,
        approverDataMessage,
        { parse_mode: 'MarkdownV2', reply_markup: replyMarkup }
      ).catch(() =>
        ctx.telegram.sendMessage(request.fromUserId, approverDataMessage, { parse_mode: 'MarkdownV2', reply_markup: replyMarkup })
      );

      await ctx.reply('✅ Data kamu berhasil dibagikan\\!', { parse_mode: 'MarkdownV2' });

      // ✅ Selesaikan request ini dan proses antrian berikutnya
      await finishAndDequeue(ctx, approverId, requestId);

    } catch (error) {
      console.error('❌ Error in approve show me:', error);
      await ctx.reply('❌ Terjadi kesalahan\\. Silakan coba lagi nanti\\.', { parse_mode: 'MarkdownV2' });
    }
  });

  // ─── Handler: owner tolak ───────────────────────────────────────────────────
  bot.action(/^reject_show:(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();

      const requestId = ctx.match[1];
      const rejecterId = ctx.from.id;

      const request = pendingRequests.get(requestId);
      if (!request) {
        return ctx.reply('❌ Permintaan Show Me tidak ditemukan atau sudah kedaluwarsa\\.');
      }
      if (request.toUserId !== rejecterId) {
        return ctx.reply('❌ Kamu tidak memiliki otoritas untuk menolak permintaan ini\\.');
      }

      const rejectionMsg =
        '❌ *Permintaan Show Me Ditolak*\n\n' +
        'Pengirim menfess menolak permintaan Show Me kamu\\.\n\n' +
        '💡 Kamu masih bisa menggunakan fitur "Hit Me" untuk chat anonymous\\.';

      await ctx.telegram.editMessageText(
        request.fromUserId, request.pendingMsgId, undefined,
        rejectionMsg, { parse_mode: 'MarkdownV2' }
      ).catch(() =>
        ctx.telegram.sendMessage(request.fromUserId, rejectionMsg, { parse_mode: 'MarkdownV2' })
      );

      await ctx.reply('❌ Permintaan Show Me berhasil ditolak\\.\n\n🔒 Data diri kamu tetap aman\\.', { parse_mode: 'MarkdownV2' });

      // ✅ Selesaikan request ini dan proses antrian berikutnya
      await finishAndDequeue(ctx, rejecterId, requestId);

    } catch (error) {
      console.error('❌ Error in reject show me:', error);
      await ctx.reply('❌ Terjadi kesalahan\\. Silakan coba lagi nanti\\.', { parse_mode: 'MarkdownV2' });
    }
  });

  // ─── Cleanup expired requests setiap 1 jam ─────────────────────────────────
  setInterval(() => {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [requestId, request] of pendingRequests.entries()) {
      if (now - request.timestamp > REQUEST_EXPIRY) {
        pendingRequests.delete(requestId);
        cleanedCount++;

        // Bersihkan juga dari ownerQueues
        const ownerId = request.toUserId;
        const queue = ownerQueues.get(ownerId);
        if (queue) {
          const newQueue = queue.filter(id => id !== requestId);
          if (newQueue.length === 0) ownerQueues.delete(ownerId);
          else ownerQueues.set(ownerId, newQueue);
        }
      }
    }

    if (cleanedCount > 0) console.log(`🧹 Cleaned up ${cleanedCount} expired Show Me requests`);
  }, 60 * 60 * 1000);

  // ─── Debug command ──────────────────────────────────────────────────────────
  bot.command('debug_showme', async (ctx) => {
    if (ctx.from.id === parseInt(process.env.ADMIN_ID)) {
      const queues = Array.from(ownerQueues.entries()).map(([ownerId, queue]) =>
        `Owner ${ownerId}: [${queue.join(', ')}]`
      );
      await ctx.reply(
        `Pending requests: ${pendingRequests.size}\n` +
        `Owner queues:\n${queues.join('\n') || 'None'}`
      );
    }
  });

  return {
    createShowMeButton: (messageId) => [Markup.button.callback('👁️ Show Me', `show_me:${messageId}`)],
    getPendingRequestsCount: () => pendingRequests.size,
    getOwnerQueueCount: (ownerId) => (ownerQueues.get(ownerId) || []).length,
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