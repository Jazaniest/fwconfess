/**
 * Admin broadcast handler — full broadcast functionality via Telegram admin panel.
 */
import { db } from '../../services/db.js';

const pendingBroadcasts = new Map(); // adminId → { target, text, step }

/**
 * Tampilkan menu broadcast.
 */
export async function handleAdminBroadcast(ctx) {
  const pending = pendingBroadcasts.get(ctx.from.id);
  if (!pending) {
    pendingBroadcasts.set(ctx.from.id, { step: 'menu' });
  }

  const { Markup } = await import('telegraf');
  await ctx.editMessageText(
    '📢 *Broadcast Message*\n\n' +
    'Pilih jenis broadcast yang ingin dikirim:\n\n' +
    '⚠️ *Perhatian:* Gunakan fitur ini dengan bijak!',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📢 Broadcast Baru', callback_data: 'admin_broadcast_all' },
            { text: '📊 Preview Audience', callback_data: 'admin_broadcast_preview' }
          ],
          [
            { text: '📝 Tulis Pesan Langsung', callback_data: 'admin_broadcast_write' }
          ],
          [{ text: '🏠 Kembali', callback_data: 'back_to_admin' }]
        ]
      }
    }
  );
}

/**
 * Preview audience — estimasi jumlah penerima broadcast.
 */
export async function handleAdminBroadcastPreview(ctx) {
  try {
    const [[{ totalUsers }]] = await db.query('SELECT COUNT(*) AS totalUsers FROM users');
    const [[{ activeUsers }]] = await db.query('SELECT COUNT(*) AS activeUsers FROM users WHERE is_active = 1');
    const [[{ bannedUsers }]] = await db.query('SELECT COUNT(*) AS bannedUsers FROM users WHERE is_active = 0');

    const text =
      `📊 *Estimasi Audience Broadcast*\n\n` +
      `👥 Total semua user: *${totalUsers}*\n` +
      `✅ User aktif: *${activeUsers}*\n` +
      `🚫 User banned: *${bannedUsers}*\n\n` +
      `📢 *Rekomendasi target:*\n` +
      `• "Semua User" → ${totalUsers} penerima\n` +
      `• "User Aktif" → ${activeUsers} penerima`;

    const { Markup } = await import('telegraf');
    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📢 Lanjut Broadcast', callback_data: 'admin_broadcast_all' }],
          [{ text: '🔙 Kembali', callback_data: 'admin_broadcast' }]
        ]
      }
    });
  } catch (error) {
    console.error('❌ Error preview audience:', error);
    await ctx.editMessageText('❌ Gagal memuat estimasi audience.');
  }
}

/**
 * Mulai alur broadcast: minta target.
 */
export async function handleAdminBroadcastAll(ctx) {
  const { Markup } = await import('telegraf');
  pendingBroadcasts.set(ctx.from.id, { step: 'target' });

  await ctx.editMessageText(
    '📢 *Broadcast — Pilih Target*\n\n' +
    'Pilih target penerima broadcast:',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '👥 Semua User', callback_data: 'admin_bc_target_all' }],
          [{ text: '✅ User Aktif Saja', callback_data: 'admin_bc_target_active' }],
          [{ text: '🚫 User Banned Saja', callback_data: 'admin_bc_target_banned' }],
          [{ text: '🔙 Kembali', callback_data: 'admin_broadcast' }]
        ]
      }
    }
  );
}

/**
 * Set target dan minta input teks pesan.
 */
async function askForMessage(ctx, target) {
  const { Markup } = await import('telegraf');
  pendingBroadcasts.set(ctx.from.id, { step: 'message', target });

  const targetLabel = { all: '👥 Semua User', active: '✅ User Aktif', banned: '🚫 User Banned' }[target] || target;

  await ctx.editMessageText(
    `📢 *Broadcast ke ${targetLabel}*\n\n` +
    'Kirimkan teks pesan broadcast.\n\n' +
    '💡 *Support Markdown Telegram:*\n' +
    '• *bold* • _italic_ • `code`\n\n' +
    '_Ketik /cancel untuk membatalkan_',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ Batal', callback_data: 'admin_broadcast' }]
        ]
      }
    }
  );
}

export async function handleAdminBcTargetAll(ctx) {
  await ctx.answerCbQuery();
  await askForMessage(ctx, 'all');
}

export async function handleAdminBcTargetActive(ctx) {
  await ctx.answerCbQuery();
  await askForMessage(ctx, 'active');
}

export async function handleAdminBcTargetBanned(ctx) {
  await ctx.answerCbQuery();
  await askForMessage(ctx, 'banned');
}

/**
 * Alur tulis pesan langsung (dari menu).
 */
export async function handleAdminBroadcastWrite(ctx) {
  const { Markup } = await import('telegraf');
  pendingBroadcasts.set(ctx.from.id, { step: 'write_target' });

  await ctx.editMessageText(
    '📝 *Tulis Pesan Broadcast*\n\n' +
    'Pilih target penerima terlebih dahulu:',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '👥 Semua User', callback_data: 'admin_bc_write_all' }],
          [{ text: '✅ User Aktif', callback_data: 'admin_bc_write_active' }],
          [{ text: '🚫 User Banned', callback_data: 'admin_bc_write_banned' }],
          [{ text: '🔙 Kembali', callback_data: 'admin_broadcast' }]
        ]
      }
    }
  );
}

export async function handleAdminBcWriteAll(ctx) {
  await ctx.answerCbQuery();
  await askForMessage(ctx, 'all');
}

export async function handleAdminBcWriteActive(ctx) {
  await ctx.answerCbQuery();
  await askForMessage(ctx, 'active');
}

export async function handleAdminBcWriteBanned(ctx) {
  await ctx.answerCbQuery();
  await askForMessage(ctx, 'banned');
}

/**
 * Proses input teks dari admin (dipanggil dari text handler di admin.js).
 * Return true jika pesan diproses, false jika bukan.
 */
export async function handleAdminBroadcastText(ctx) {
  const userId = ctx.from.id;
  const pending = pendingBroadcasts.get(userId);
  if (!pending || !pending.step || !['message', 'write_target'].includes(pending.step)) return false;

  const text = ctx.message.text.trim();

  if (text === '/cancel') {
    pendingBroadcasts.delete(userId);
    await ctx.reply('❌ Broadcast dibatalkan.');
    return true;
  }

  // If step is write_target, they haven't selected target yet - but they sent text, treat as 'all'
  const target = pending.target || 'all';

  if (text.length < 5) {
    await ctx.reply('⚠️ Pesan terlalu pendek. Minimal 5 karakter.\n\n_Ketik /cancel untuk membatalkan_');
    return true;
  }

  // Save to pending with confirmation
  pendingBroadcasts.set(userId, { step: 'confirm', target, text });

  const targetLabel = { all: '👥 Semua User', active: '✅ User Aktif', banned: '🚫 User Banned' }[target] || target;

  const { Markup } = await import('telegraf');
  await ctx.reply(
    `📋 *Konfirmasi Broadcast*\n\n` +
    `📢 Target: ${targetLabel}\n` +
    `📝 Pesan:\n${text}\n\n` +
    `_Apakah kamu yakin ingin mengirim broadcast ini?_`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Kirim', callback_data: 'admin_bc_confirm_yes' },
            { text: '❌ Batal', callback_data: 'admin_bc_confirm_no' }
          ]
        ]
      }
    }
  );
  return true;
}

/**
 * Eksekusi broadcast.
 */
export async function handleAdminBroadcastConfirmYes(ctx) {
  const userId = ctx.from.id;
  const pending = pendingBroadcasts.get(userId);
  if (!pending || pending.step !== 'confirm') {
    return ctx.reply('❌ Tidak ada broadcast yang menunggu konfirmasi.');
  }

  const { target, text } = pending;
  const { Markup } = await import('telegraf');

  await ctx.editMessageText(
    '⏳ *Mengirim broadcast...*\n\n' +
    'Proses pengiriman sedang berlangsung. Tunggu notifikasi selesai.',
    { parse_mode: 'Markdown' }
  );

  try {
    // Fetch user IDs based on target
    let rows;
    if (target === 'all') {
      [rows] = await db.query('SELECT telegram_id FROM users');
    } else if (target === 'active') {
      [rows] = await db.query('SELECT telegram_id FROM users WHERE is_active = 1');
    } else if (target === 'banned') {
      [rows] = await db.query('SELECT telegram_id FROM users WHERE is_active = 0');
    }

    const userIds = rows.map(r => r.telegram_id);
    const total = userIds.length;

    // Send broadcast
    let sent = 0, failed = 0;
    for (const uid of userIds) {
      try {
        await ctx.telegram.sendMessage(uid, text, { parse_mode: 'Markdown' });
        sent++;
      } catch (err) {
        failed++;
        if (err.code === 403) {
          // User blocked bot — maybe mark as inactive?
          await db.query('UPDATE users SET is_active = 0 WHERE telegram_id = ?', [uid]);
        }
      }
    }

    // Log ke admin_logs
    await db.query(
      'INSERT INTO admin_logs (admin_action, target) VALUES (?, ?)',
      ['broadcast_send', `${target} — ${sent} sent, ${failed} failed`]
    );

    // Simpan ke tabel broadcasts
    await db.query(
      'INSERT INTO broadcasts (message_text) VALUES (?)',
      [`[${target}] ${text}`]
    );

    pendingBroadcasts.delete(userId);

    await ctx.editMessageText(
      `✅ *Broadcast Selesai!*\n\n` +
      `📊 *Hasil:*\n` +
      `• Total target: *${total}*\n` +
      `• ✅ Terkirim: *${sent}*\n` +
      `• ❌ Gagal: *${failed}*\n\n` +
      `_User yang memblokir bot akan otomatis di-suspend._`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📢 Broadcast Lagi', callback_data: 'admin_broadcast' }],
            [{ text: '🏠 Kembali ke Admin', callback_data: 'back_to_admin' }]
          ]
        }
      }
    );

  } catch (error) {
    console.error('❌ Error sending broadcast:', error);
    pendingBroadcasts.delete(userId);
    await ctx.reply('❌ Gagal mengirim broadcast: ' + error.message);
  }
}

/**
 * Batal broadcast.
 */
export async function handleAdminBroadcastConfirmNo(ctx) {
  pendingBroadcasts.delete(ctx.from.id);
  await ctx.editMessageText('❌ Broadcast dibatalkan.', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📢 Broadcast Lagi', callback_data: 'admin_broadcast' }],
        [{ text: '🏠 Kembali ke Admin', callback_data: 'back_to_admin' }]
      ]
    }
  });
}
