import { Database } from '../../commands/database.js';

/**
 * Setup handler ban/unban user
 * @param {Telegraf} bot
 * @param {Function} adminMiddleware
 * @param {Map} adminInputState - shared state map dari admin.js
 */
export function setupAdminBan(bot, adminMiddleware, adminInputState) {

  // ─── Menu Ban/Unban ───────────────────────────────────────────────────────

  bot.action('admin_ban', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      '🚫 *Ban/Unban User*\n\nPilih aksi yang ingin dilakukan:',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🚫 Ban User',       callback_data: 'admin_ban_user'       },
              { text: '✅ Unban User',      callback_data: 'admin_unban_user'     }
            ],
            [
              { text: '📋 Daftar Banned',  callback_data: 'admin_banned_users_0' },
              { text: '⏰ Temporary Ban',   callback_data: 'admin_tempban_user'   }
            ],
            [{ text: '🔍 Cek Status Ban',  callback_data: 'admin_check_ban' }],
            [{ text: '🏠 Kembali',         callback_data: 'back_to_admin'   }]
          ]
        }
      }
    );
  });

  // ─── Ban User (permanent) ─────────────────────────────────────────────────

  bot.action('admin_ban_user', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    adminInputState.set(ctx.from.id, { action: 'ban_user_id', banType: 'permanent' });

    await ctx.editMessageText(
      `🚫 *Ban User (Permanent)*\n\n` +
      `Kirimkan Telegram ID user yang ingin di-ban.\n\n` +
      `_Ketik /cancel untuk membatalkan_`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'admin_ban' }]] }
      }
    );
  });

  // ─── Temporary Ban ────────────────────────────────────────────────────────

  bot.action('admin_tempban_user', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    adminInputState.set(ctx.from.id, { action: 'ban_user_id', banType: 'temporary' });

    await ctx.editMessageText(
      `⏰ *Temporary Ban User*\n\n` +
      `Kirimkan Telegram ID user yang ingin di-ban sementara.\n\n` +
      `_Ketik /cancel untuk membatalkan_`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'admin_ban' }]] }
      }
    );
  });

  // Pilih durasi temporary ban
  bot.action(/^admin_tempban_duration_(\d+)_(.+)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const targetId = ctx.match[1];
    const hours    = parseInt(ctx.match[2]);

    adminInputState.set(ctx.from.id, {
      action:   'ban_reason',
      banType:  'temporary',
      targetId: parseInt(targetId),
      hours
    });

    const durationLabel = hours < 24
      ? `${hours} jam`
      : hours < 168
      ? `${hours / 24} hari`
      : `${hours / 168} minggu`;

    await ctx.editMessageText(
      `⏰ *Temporary Ban — ${durationLabel}*\n\n` +
      `Target: \`${targetId}\`\n\n` +
      `Kirimkan alasan ban, atau ketik \`-\` untuk skip.\n\n` +
      `_Ketik /cancel untuk membatalkan_`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '⏭️ Skip Alasan', callback_data: `admin_ban_skip_reason_${targetId}_temporary_${hours}` }],
            [{ text: '❌ Batal', callback_data: 'admin_ban' }]
          ]
        }
      }
    );
  });

  // Input durasi custom temporary ban
  bot.action(/^admin_tempban_custom_(\d+)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const targetId = ctx.match[1];
    adminInputState.set(ctx.from.id, {
      action: 'ban_duration_custom',
      banType: 'temporary',
      targetId: parseInt(targetId)
    });

    await ctx.editMessageText(
      `⏰ *Input Durasi Custom*\n\n` +
      `Target: \`${targetId}\`\n\n` +
      `Kirimkan durasi dalam jam. Contoh:\n` +
      `• \`2\` → 2 jam\n` +
      `• \`48\` → 2 hari\n` +
      `• \`168\` → 7 hari\n\n` +
      `_Ketik /cancel untuk membatalkan_`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'admin_ban' }]] }
      }
    );
  });

  // Skip alasan → langsung konfirmasi
  bot.action(/^admin_ban_skip_reason_(\d+)_(permanent|temporary)_?(\d*)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const targetId = parseInt(ctx.match[1]);
    const banType  = ctx.match[2];
    const hours    = ctx.match[3] ? parseInt(ctx.match[3]) : null;

    await showBanConfirmation(ctx, targetId, banType, null, hours);
  });

  // Eksekusi ban
  bot.action(/^admin_ban_exec_(\d+)_(permanent|temporary)_?(\d*)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery('🚫 Memban...');
    const targetId = parseInt(ctx.match[1]);
    const banType  = ctx.match[2];
    const hours    = ctx.match[3] ? parseInt(ctx.match[3]) : null;
    const adminId  = ctx.from.id;

    const state   = adminInputState.get(adminId);
    const reason  = state?.pendingReason || null;
    adminInputState.delete(adminId);

    const expiresAt = (banType === 'temporary' && hours)
      ? new Date(Date.now() + hours * 60 * 60 * 1000)
      : null;

    await Database.createBan(targetId, banType, reason, expiresAt, adminId);

    // Restrict di discussion group
    const groupId = process.env.DISCUSSION_GROUP_ID;
    let restrictSuccess = false;
    if (groupId) {
      try {
        await ctx.telegram.restrictChatMember(groupId, targetId, {
          permissions: {
            can_send_messages         : false,
            can_send_audios           : false,
            can_send_documents        : false,
            can_send_photos           : false,
            can_send_videos           : false,
            can_send_video_notes      : false,
            can_send_voice_notes      : false,
            can_send_polls            : false,
            can_send_other_messages   : false,
            can_add_web_page_previews : false,
            can_change_info           : false,
            can_invite_users          : false,
            can_pin_messages          : false,
          },
          ...(expiresAt ? { until_date: Math.floor(expiresAt.getTime() / 1000) } : {})
        });
        restrictSuccess = true;
      } catch (err) {
        console.error('⚠️ Gagal restrict di grup:', err.message);
      }
    }

    const durationText = banType === 'permanent'
      ? 'Permanent'
      : `${hours} jam (sampai ${expiresAt.toLocaleString('id-ID')})`;

    const groupStatus = !groupId
      ? '_DISCUSSION_GROUP_ID tidak di-set_'
      : restrictSuccess
      ? '✅ Berhasil di-restrict di grup'
      : '⚠️ Gagal restrict di grup (user mungkin belum pernah join)';

    await ctx.editMessageText(
      `✅ *User berhasil di-ban!*\n\n` +
      `🆔 Target: \`${targetId}\`\n` +
      `⛔ Tipe: *${banType}*\n` +
      `⏱️ Durasi: ${durationText}\n` +
      `📝 Alasan: ${reason || '-'}\n` +
      `💬 Grup: ${groupStatus}`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali ke Ban Menu', callback_data: 'admin_ban' }]] }
      }
    );
  });

  // ─── Unban User ───────────────────────────────────────────────────────────

  bot.action('admin_unban_user', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    adminInputState.set(ctx.from.id, { action: 'unban_user_id' });

    await ctx.editMessageText(
      `✅ *Unban User*\n\n` +
      `Kirimkan Telegram ID user yang ingin di-unban.\n\n` +
      `_Ketik /cancel untuk membatalkan_`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'admin_ban' }]] }
      }
    );
  });

  // Eksekusi unban
  bot.action(/^admin_unban_exec_(\d+)$/, adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery('✅ Unban...');
    const targetId = parseInt(ctx.match[1]);
    const adminId  = ctx.from.id;

    await Database.removeBan(targetId, adminId);

    // Restore permission di discussion group
    const groupId = process.env.DISCUSSION_GROUP_ID;
    let unrestrictSuccess = false;
    if (groupId) {
      try {
        await ctx.telegram.restrictChatMember(groupId, targetId, {
          permissions: {
            can_send_messages         : true,
            can_send_audios           : true,
            can_send_documents        : true,
            can_send_photos           : true,
            can_send_videos           : true,
            can_send_video_notes      : true,
            can_send_voice_notes      : true,
            can_send_polls            : true,
            can_send_other_messages   : true,
            can_add_web_page_previews : true,
            can_change_info           : false,
            can_invite_users          : true,
            can_pin_messages          : false,
          }
        });
        unrestrictSuccess = true;
      } catch (err) {
        console.error('⚠️ Gagal unrestrict di grup:', err.message);
      }
    }

    const groupStatus = !groupId
      ? '_DISCUSSION_GROUP_ID tidak di-set_'
      : unrestrictSuccess
      ? '✅ Permission grup dipulihkan'
      : '⚠️ Gagal unrestrict di grup (user mungkin belum pernah join)';

    await ctx.editMessageText(
      `✅ *User berhasil di-unban!*\n\n` +
      `🆔 Target: \`${targetId}\`\n` +
      `💬 Grup: ${groupStatus}`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali ke Ban Menu', callback_data: 'admin_ban' }]] }
      }
    );
  });

  // ─── Cek Status Ban ───────────────────────────────────────────────────────

  bot.action('admin_check_ban', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    adminInputState.set(ctx.from.id, { action: 'check_ban_id' });

    await ctx.editMessageText(
      `🔍 *Cek Status Ban*\n\n` +
      `Kirimkan Telegram ID user yang ingin dicek.\n\n` +
      `_Ketik /cancel untuk membatalkan_`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'admin_ban' }]] }
      }
    );
  });
}

// ─── Shared helper (dipakai juga oleh text handler di admin.js) ───────────────

export async function showTempBanDurationMenu(ctx, targetId) {
  await ctx.editMessageText(
    `⏰ *Pilih Durasi Temporary Ban*\n\nTarget: \`${targetId}\``,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '1 Jam',     callback_data: `admin_tempban_duration_${targetId}_1`   },
            { text: '6 Jam',     callback_data: `admin_tempban_duration_${targetId}_6`   },
            { text: '12 Jam',    callback_data: `admin_tempban_duration_${targetId}_12`  }
          ],
          [
            { text: '1 Hari',   callback_data: `admin_tempban_duration_${targetId}_24`  },
            { text: '3 Hari',   callback_data: `admin_tempban_duration_${targetId}_72`  },
            { text: '7 Hari',   callback_data: `admin_tempban_duration_${targetId}_168` }
          ],
          [
            { text: '30 Hari',  callback_data: `admin_tempban_duration_${targetId}_720` },
            { text: '✏️ Custom', callback_data: `admin_tempban_custom_${targetId}`       }
          ],
          [{ text: '❌ Batal', callback_data: 'admin_ban' }]
        ]
      }
    }
  );
}

export async function showBanConfirmation(ctx, targetId, banType, reason, hours = null) {
  const durationText = banType === 'permanent'
    ? '♾️ Permanent'
    : (() => {
        const exp   = new Date(Date.now() + hours * 60 * 60 * 1000);
        const label = hours < 24   ? `${hours} jam`
                    : hours < 168  ? `${hours / 24} hari`
                    :                `${hours / 168} minggu`;
        return `⏰ ${label} (sampai ${exp.toLocaleString('id-ID')})`;
      })();

  const execCb = banType === 'permanent'
    ? `admin_ban_exec_${targetId}_permanent`
    : `admin_ban_exec_${targetId}_temporary_${hours}`;

  const text =
    `⚠️ *Konfirmasi Ban*\n\n` +
    `🆔 Target: \`${targetId}\`\n` +
    `⛔ Tipe: *${banType}*\n` +
    `⏱️ Durasi: ${durationText}\n` +
    `📝 Alasan: ${reason || '-'}\n\n` +
    `_Tindakan ini akan langsung berlaku._`;

  const markup = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Ya, Ban', callback_data: execCb      },
        { text: '❌ Batal',   callback_data: 'admin_ban' }
      ]]
    }
  };

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, markup);
  } else {
    await ctx.reply(text, markup);
  }
}