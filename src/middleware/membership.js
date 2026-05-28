/**
 * Middleware: membership.js
 *
 * Sumber: checkMembership() dan showJoinRequirement() dari start.js,
 * plus blok membershipMiddleware() dari startCommand().
 *
 * Diekstrak agar bisa dipakai oleh handler lain tanpa import dari start.js.
 */

import { Markup }      from 'telegraf';
import { isAdminUser } from './admin-auth.js';

// ─── Core helpers (tidak bergantung ctx) ─────────────────────────────────────

/**
 * Cek apakah user sudah bergabung di channel dan grup.
 *
 * @param {import('telegraf').Context} ctx
 * @param {number|string} userId
 * @returns {Promise<{ isChannelMember: boolean, isGroupMember: boolean, channelId: string, groupId: string }>}
 */
export async function checkMembership(ctx, userId) {
  const channelId = process.env.TARGET_CHANNEL_ID;
  const groupId   = process.env.DISCUSSION_GROUP_ID;

  try {
    const channelMember = await ctx.telegram.getChatMember(channelId, userId);
    const isChannelMember = ['member', 'administrator', 'creator', 'restricted']
      .includes(channelMember.status);

    const groupMember   = await ctx.telegram.getChatMember(groupId, userId);
    const isGroupMember = ['member', 'administrator', 'creator', 'restricted']
      .includes(groupMember.status);

    return { isChannelMember, isGroupMember, channelId, groupId };
  } catch (error) {
    console.error('Error checking membership:', error);
    return { isChannelMember: false, isGroupMember: false, channelId, groupId };
  }
}

/**
 * Kirim pesan "kamu harus join dulu" beserta tombol join yang relevan.
 *
 * @param {import('telegraf').Context} ctx
 * @param {{ isChannelMember: boolean, isGroupMember: boolean }} membershipStatus
 */
export async function showJoinRequirement(ctx, membershipStatus) {
  const { isChannelMember, isGroupMember } = membershipStatus;

  let message = '⚠️ Untuk menggunakan bot ini, Anda harus bergabung terlebih dahulu:\n\n';
  const buttons = [];

  if (!isChannelMember) {
    message += '📣 Channel: Belum bergabung\n';
    buttons.push([Markup.button.url('📣 Join Channel', 'https://t.me/fwb_confess')]);
  } else {
    message += '📣 Channel: ✅ Sudah bergabung\n';
  }

  if (!isGroupMember) {
    message += '💬 Grup Diskusi: Belum bergabung\n';
    buttons.push([Markup.button.url('💬 Join Grup', 'https://t.me/fwb_confesschat')]);
  } else {
    message += '💬 Grup Diskusi: ✅ Sudah bergabung\n';
  }

  message += '\nSetelah bergabung, klik tombol \'Cek Keanggotaan\' di bawah ini:';
  buttons.push([Markup.button.callback('🔄 Cek Keanggotaan', 'check_membership')]);

  await ctx.reply(message, Markup.inlineKeyboard(buttons));
}

// ─── Telegraf middleware factory ──────────────────────────────────────────────

/**
 * Buat Telegraf middleware yang memastikan user sudah join channel & grup.
 * Admin (ADMIN_ID) selalu lolos tanpa pengecekan.
 *
 * Cara pakai di command/action:
 *   const { membershipMiddleware } = createMembershipMiddleware();
 *   bot.command('menfess', membershipMiddleware, async (ctx) => { ... });
 *   bot.action('btn_confess', membershipMiddleware, async (ctx) => { ... });
 *
 * Atau, jika sudah punya instance dari start.js, ekspos lewat return value-nya
 * seperti yang sudah ada sekarang.
 *
 * @returns {{ membershipMiddleware: Function }}
 */
export function createMembershipMiddleware() {
  async function membershipMiddleware(ctx, next) {
    const userId = ctx.from?.id;
    if (!userId) return next();

    // Admin bypass
    if (isAdminUser(userId)) return next();

    const status = await checkMembership(ctx, userId);

    if (!status.isChannelMember || !status.isGroupMember) {
      await showJoinRequirement(ctx, status);
      return; // hentikan chain
    }

    return next();
  }

  return { membershipMiddleware };
}