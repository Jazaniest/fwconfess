import { Database } from './database.js';

/**
 * Handler untuk sistem komentar confession
 * @param {Telegraf} bot
 * @param {string|number} discussionGroupId - ID grup diskusi untuk komentar
 */

export default function commentHandler(bot, discussionGroupId) {
  console.log('💬 Comment handler initialized with discussion group:', discussionGroupId);

  /**
   * Mengirim confession ke grup diskusi dan mendapatkan URL komentar
   * @param {Object} ctx - Telegraf context
   * @param {string} confessionMessage - Pesan confession yang sudah diformat
   * @returns {Promise<string|null>} URL komentar atau null jika gagal
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
      
      // Format URL untuk thread komentar
      // Hapus tanda minus dari group ID jika ada
      const groupId = discussionGroupId.toString().replace('-100', '');
      const commentUrl = `https://t.me/c/${groupId}/${groupMessage.message_id}/${groupMessage.message_id}`;
      
      console.log('🔗 Comment URL generated:', commentUrl);
      
      // Simpan data komentar ke database jika diperlukan
      await saveCommentData(groupMessage.message_id, discussionGroupId, commentUrl);
      
      return commentUrl;
      
    } catch (groupError) {
      console.error('❌ Error sending to discussion group:', groupError);
      console.error('⚠️ Continuing without comment feature...');
      return null;
    }
  }

  /**
   * Membuat inline keyboard dengan atau tanpa tombol comment
   * @param {string|null} commentUrl - URL komentar
   * @param {number} userId - ID user yang membuat confession
   * @returns {Array} Inline keyboard array
   */
  function createInlineKeyboard(commentUrl, userId) {
    if (commentUrl) {
      return [
        [
          { text: '💬 Comment', url: commentUrl },
          { text: '💝 Hit Me', callback_data: `hitme_${userId}` }
        ]
      ];
    } else {
      return [
        [
          { text: '💝 Hit Me', callback_data: `hitme_${userId}` }
        ]
      ];
    }
  }

  /**
   * Menyimpan data komentar ke database
   * @param {number} messageId - ID pesan di grup diskusi
   * @param {string} groupId - ID grup diskusi
   * @param {string} commentUrl - URL komentar
   */
  async function saveCommentData(messageId, groupId, commentUrl) {
    try {
      // Implementasi penyimpanan data komentar ke database
      // Sesuaikan dengan struktur database Anda
      console.log('💾 Saving comment data to database...');
      
      // Contoh implementasi - sesuaikan dengan Database class Anda
      // await Database.saveCommentData(messageId, groupId, commentUrl);
      
      console.log('✅ Comment data saved to database');
    } catch (error) {
      console.error('❌ Error saving comment data:', error);
    }
  }

  /**
   * Handler untuk notifikasi komentar baru (opsional)
   * @param {Object} ctx - Telegraf context
   */
  async function handleNewComment(ctx) {
    try {
      // Implementasi untuk menangani komentar baru
      // Misalnya memberikan notifikasi ke pembuat confession
      console.log('💬 New comment received');
      
      // Logic untuk memberikan notifikasi ke user yang membuat confession
      // const confessionAuthor = await findConfessionAuthor(ctx.message.reply_to_message.message_id);
      // if (confessionAuthor) {
      //   await ctx.telegram.sendMessage(confessionAuthor.userId, 
      //     '💬 Ada komentar baru di confession kamu!'
      //   );
      // }
      
    } catch (error) {
      console.error('❌ Error handling new comment:', error);
    }
  }

  /**
   * Mencari pembuat confession berdasarkan message ID (helper function)
   * @param {number} messageId - ID pesan confession
   * @returns {Promise<Object|null>} Data pembuat confession
   */
  async function findConfessionAuthor(messageId) {
    try {
      // Implementasi pencarian pembuat confession
      // return await Database.findConfessionByMessageId(messageId);
      return null;
    } catch (error) {
      console.error('❌ Error finding confession author:', error);
      return null;
    }
  }

  /**
   * Mendapatkan statistik komentar untuk confession tertentu
   * @param {number} messageId - ID pesan confession
   * @returns {Promise<Object>} Statistik komentar
   */
  async function getCommentStats(messageId) {
    try {
      // Implementasi mendapatkan statistik komentar
      // const stats = await Database.getCommentStats(messageId);
      // return stats || { count: 0, lastComment: null };
      return { count: 0, lastComment: null };
    } catch (error) {
      console.error('❌ Error getting comment stats:', error);
      return { count: 0, lastComment: null };
    }
  }

  // Event listener untuk komentar baru di grup diskusi (opsional)
  if (discussionGroupId) {
    bot.on('message', async (ctx, next) => {
      // Hanya proses pesan dari grup diskusi
      if (ctx.chat.id.toString() === discussionGroupId.toString()) {
        // Cek apakah ini adalah reply ke confession
        if (ctx.message.reply_to_message) {
          await handleNewComment(ctx);
        }
      }
      return next();
    });
  }

  // Debug command untuk testing comment system
  bot.command('debug_comments', async (ctx) => {
    if (ctx.from.id === parseInt(process.env.ADMIN_ID)) {
      const stats = await getCommentStats(0); // Example
      await ctx.reply(`Comment system status:\nDiscussion Group: ${discussionGroupId}\nStats: ${JSON.stringify(stats)}`);
    }
  });

  // Return public methods
  return {
    sendToDiscussionGroup,
    createInlineKeyboard,
    handleNewComment,
    findConfessionAuthor,
    getCommentStats,
    saveCommentData,
    isCommentSystemEnabled: () => !!discussionGroupId
  };
}

/**
 * Utility function untuk memvalidasi grup diskusi
 * @param {Object} telegram - Telegram bot instance
 * @param {string} groupId - ID grup diskusi
 * @returns {Promise<boolean>} True jika grup valid
 */
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

/**
 * Utility function untuk membuat link thread Telegram
 * @param {string} groupId - ID grup (dengan atau tanpa -100)
 * @param {number} messageId - ID pesan
 * @returns {string} URL thread
 */
export function createThreadUrl(groupId, messageId) {
  const cleanGroupId = groupId.toString().replace('-100', '');
  return `https://t.me/c/${cleanGroupId}/${messageId}?thread=${messageId}`;
}