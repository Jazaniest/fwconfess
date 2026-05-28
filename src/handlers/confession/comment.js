/**
 * Comment Handler — comment via Telegram discussion group.
 *
 * Dipindah dari: src/commands/comment.js
 * Perubahan: import Database dihapus (tidak dipakai aktif), path relatif disesuaikan.
 */

/**
 * @param {import('telegraf').Telegraf} bot
 * @param {string|number} discussionGroupId
 */
export default function commentHandler(bot, discussionGroupId) {
  console.log('💬 Comment handler initialized with discussion group:', discussionGroupId);

  /**
   * Kirim confession ke grup diskusi dan kembalikan URL komentar.
   * @param {import('telegraf').Context} ctx
   * @param {string} confessionMessage
   * @returns {Promise<string|null>}
   */
  async function sendToDiscussionGroup(ctx, confessionMessage) {
    if (!discussionGroupId) {
      console.log('⚠️ DISCUSSION_GROUP_ID not set, skipping comment feature');
      return null;
    }

    try {
      console.log('💬 Sending to discussion group:', discussionGroupId);

      const groupMessage = await ctx.telegram.sendMessage(
        discussionGroupId,
        confessionMessage,
        { parse_mode: 'Markdown' }
      );

      console.log('✅ Message sent to discussion group, message_id:', groupMessage.message_id);

      const groupId    = discussionGroupId.toString().replace('-100', '');
      const commentUrl = `https://t.me/c/${groupId}/${groupMessage.message_id}/${groupMessage.message_id}`;

      console.log('🔗 Comment URL generated:', commentUrl);

      await saveCommentData(groupMessage.message_id, discussionGroupId, commentUrl);

      return commentUrl;

    } catch (groupError) {
      console.error('❌ Error sending to discussion group:', groupError);
      console.error('⚠️ Continuing without comment feature...');
      return null;
    }
  }

  /**
   * Buat inline keyboard dengan atau tanpa tombol Comment.
   * @param {string|null} commentUrl
   * @param {number} userId
   * @returns {Array}
   */
  function createInlineKeyboard(commentUrl, userId) {
    if (commentUrl) {
      return [[
        { text: '💬 Comment', url: commentUrl },
        { text: '💝 Hit Me', callback_data: `hitme_${userId}` },
      ]];
    }
    return [[{ text: '💝 Hit Me', callback_data: `hitme_${userId}` }]];
  }

  /**
   * Simpan data komentar ke database (stub — sesuaikan dengan implementasi DB).
   */
  async function saveCommentData(messageId, groupId, commentUrl) {
    try {
      console.log('💾 Saving comment data to database...');
      // await commentRepo.saveCommentData(messageId, groupId, commentUrl);
      console.log('✅ Comment data saved to database');
    } catch (error) {
      console.error('❌ Error saving comment data:', error);
    }
  }

  /**
   * Handler notifikasi komentar baru (opsional).
   */
  async function handleNewComment(ctx) {
    try {
      console.log('💬 New comment received');
      // Tambahkan logika notifikasi ke pembuat confession di sini jika diperlukan
    } catch (error) {
      console.error('❌ Error handling new comment:', error);
    }
  }

  async function findConfessionAuthor(messageId) {
    try {
      // return await confessionRepo.findConfessionByMessageId(messageId);
      return null;
    } catch (error) {
      console.error('❌ Error finding confession author:', error);
      return null;
    }
  }

  async function getCommentStats(messageId) {
    try {
      // const stats = await commentRepo.getCommentStats(messageId);
      return { count: 0, lastComment: null };
    } catch (error) {
      console.error('❌ Error getting comment stats:', error);
      return { count: 0, lastComment: null };
    }
  }

  // Listener komentar baru di grup diskusi (opsional)
  if (discussionGroupId) {
    bot.on('message', async (ctx, next) => {
      if (ctx.chat.id.toString() === discussionGroupId.toString()) {
        if (ctx.message.reply_to_message) {
          await handleNewComment(ctx);
        }
      }
      return next();
    });
  }

  // Debug command
  bot.command('debug_comments', async (ctx) => {
    if (ctx.from.id === parseInt(process.env.ADMIN_ID)) {
      const stats = await getCommentStats(0);
      await ctx.reply(
        `Comment system status:\nDiscussion Group: ${discussionGroupId}\nStats: ${JSON.stringify(stats)}`
      );
    }
  });

  return {
    sendToDiscussionGroup,
    createInlineKeyboard,
    handleNewComment,
    findConfessionAuthor,
    getCommentStats,
    saveCommentData,
    isCommentSystemEnabled: () => !!discussionGroupId,
  };
}

// ─── Utility exports ──────────────────────────────────────────────────────────

export async function validateDiscussionGroup(telegram, groupId) {
  try {
    const chat = await telegram.getChat(groupId);
    console.log('✅ Discussion group validated:', chat.title);
    return true;
  } catch (error) {
    console.error('❌ Invalid discussion group:', error);
    return false;
  }
}

export function createThreadUrl(groupId, messageId) {
  const cleanGroupId = groupId.toString().replace('-100', '');
  return `https://t.me/c/${cleanGroupId}/${messageId}?thread=${messageId}`;
}