/**
 * Membership middleware — cek keanggotaan user di channel dan grup wajib.
 * Extracted from start.js.
 */
import { Markup } from 'telegraf';

/**
 * Periksa apakah user sudah bergabung di channel dan grup diskusi.
 * @param {import('telegraf').Context} ctx
 * @param {number|string} userId
 * @returns {Promise<{isChannelMember: boolean, isGroupMember: boolean, channelId: string, groupId: string}>}
 */
export async function checkMembership(ctx, userId) {
  const channelId = process.env.TARGET_CHANNEL_ID;
  const groupId = process.env.DISCUSSION_GROUP_ID;

  try {
    const channelMember = await ctx.telegram.getChatMember(channelId, userId);
    const isChannelMember = ['member', 'administrator', 'creator', 'restricted'].includes(channelMember.status);

    const groupMember = await ctx.telegram.getChatMember(groupId, userId);
    const isGroupMember = ['member', 'administrator', 'creator', 'restricted'].includes(groupMember.status);

    return { isChannelMember, isGroupMember, channelId, groupId };
  } catch (error) {
    console.error('Error checking membership:', error);
    return { isChannelMember: false, isGroupMember: false, channelId, groupId };
  }
}

/**
 * Tampilkan pesan join requirement dengan tombol channel/grup + cek.
 * @param {import('telegraf').Context} ctx
 * @param {{isChannelMember: boolean, isGroupMember: boolean, channelId: string, groupId: string}} membershipStatus
 */
export async function showJoinRequirement(ctx, membershipStatus) {
  const { isChannelMember, isGroupMember } = membershipStatus;

  let message = "⚠️ Untuk menggunakan bot ini, Anda harus bergabung terlebih dahulu:\n\n";
  const buttons = [];

  if (!isChannelMember) {
    message += "📣 Channel: Belum bergabung\n";
    buttons.push([Markup.button.url('📣 Join Channel', `https://t.me/fwb_confess`)]);
  } else {
    message += "📣 Channel: ✅ Sudah bergabung\n";
  }

  if (!isGroupMember) {
    message += "💬 Grup Diskusi: Belum bergabung\n";
    buttons.push([Markup.button.url('💬 Join Grup', `https://t.me/fwb_confesschat`)]);
  } else {
    message += "💬 Grup Diskusi: ✅ Sudah bergabung\n";
  }

  message += "\nSetelah bergabung, klik tombol 'Cek Keanggotaan' di bawah ini:";
  buttons.push([Markup.button.callback('🔄 Cek Keanggotaan', 'check_membership')]);

  await ctx.reply(message, Markup.inlineKeyboard(buttons));
}
