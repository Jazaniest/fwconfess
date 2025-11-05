import { Markup } from 'telegraf';
import { Database } from './database.js';
import commentHandler from './comment.js';
import showMeHandler from './showme.js';

/**
 * Handler untuk logika menfess dengan debugging extensive
 * @param {Telegraf} bot
 * @param {string|number} targetChannelId - ID channel atau group untuk publish
 */

export default function confessCommand(bot, targetChannelId) {
  // Map untuk menyimpan user yang sedang menulis confession
  const pending = new Map();
  // Map untuk menyimpan timestamp terakhir user mengirim confession
  const lastSent = new Map();
  const LIMIT_MS = 8 * 60 * 60 * 1000; // 8 jam

  // Initialize comment handler
  const commentSystem = commentHandler(bot, process.env.DISCUSSION_GROUP_ID);

  // init showme handler
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
      
      // Check if user is registered
      console.log('🔍 Checking user registration for:', userId);
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
      
      console.log('✅ User registered:', userId, user);
      
      // Check rate limit sebelum meminta confession
      const lastTime = lastSent.get(userId) || 0;
      const now = Date.now();
      console.log('⏰ Rate limit check - Last:', new Date(lastTime), 'Now:', new Date(now));
      
      if (now - lastTime < LIMIT_MS) {
        const nextAllowed = new Date(lastTime + LIMIT_MS);
        console.log('🚫 Rate limit hit for user:', userId);
        return ctx.reply(
          `⏰ Kamu sudah menfess dalam 8 jam terakhir.\n\n` +
          `Coba lagi setelah: *${nextAllowed.toLocaleString('id-ID')}*`,
          { parse_mode: 'Markdown' }
        );
      }
      
      // Set user to pending state
      pending.set(userId, {
        timestamp: now,
        user: user
      });
      console.log('📝 User added to pending list:', userId);
      console.log('📊 Current pending users:', Array.from(pending.keys()));
      
      const instructionText = commentSystem.isCommentSystemEnabled() ? 
        '📝 *Kirim Menfess*\n\n' +
        'Silakan ketik confession kamu. Pastikan menyertakan tag *#fwconfess*\n\n' +
        '⚠️ *Perhatian:*\n' +
        '• Menfess akan ditampilkan dengan gender dan rank kamu\n' +
        '• User lain bisa klik "Hit Me" untuk chat anonymous\n' +
        '• User bisa memberikan komentar di grup diskusi\n' +
        '• Jaga sopan santun dalam menfess\n\n' +
        '💡 *Tips:* Ketik `/cancel` untuk membatalkan' :
        '📝 *Kirim Menfess*\n\n' +
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
    console.log('🚫 Cancel command from user:', userId);
    if (pending.has(userId)) {
      pending.delete(userId);
      console.log('✅ User removed from pending:', userId);
      await ctx.reply('❌ Confession dibatalkan.');
    } else {
      console.log('⚠️ User not in pending list:', userId);
      await ctx.reply('❌ Tidak ada confession yang sedang dibuat.');
    }
  });
  
  async function handleConfessText (ctx, next) {
    const userId = ctx.from.id;
    const text = ctx.message.text;
    
    console.log('📨 ===== TEXT MESSAGE RECEIVED =====');
    console.log('👤 User ID:', userId);
    console.log('💬 Message text:', text);
    console.log('📋 Is user in pending?', pending.has(userId));
    console.log('📊 Current pending users:', Array.from(pending.keys()));
    console.log('🔍 Message starts with /?', text.startsWith('/'));
    console.log('📝 Message type:', ctx.message.type);
    console.log('=======================================');
  
    // Skip jika pesan adalah command
    if (text.startsWith('/')) {
      console.log('⏭️ Skipping - Message is a command');
      return;
    }
  
    // Hanya proses jika user sedang menulis confession
    if (!pending.has(userId)) {
      console.log('⏭️ Skipping - User not in pending list');
      return;
    }
    
    console.log('🎯 PROCESSING CONFESSION from user:', userId);
    
    try {
      // Get user data dari pending map
      const pendingData = pending.get(userId);
      const user = pendingData.user;
      console.log('👤 User data from pending:', user);
      
      // Hapus dari pending setelah dapat data
      pending.delete(userId);
      console.log('✅ User removed from pending after processing');
  
      // Cek rate limit lagi (double check)
      const lastTime = lastSent.get(userId) || 0;
      const now = Date.now();
      console.log('⏰ Double-check rate limit - Last:', new Date(lastTime), 'Now:', new Date(now));
      
      if (now - lastTime < LIMIT_MS) {
        const nextAllowed = new Date(lastTime + LIMIT_MS);
        console.log('🚫 Rate limit hit on double-check for user:', userId);
        return ctx.reply(
          `⏰ Kamu sudah menfess dalam 8 jam terakhir.\n\n` +
          `Coba lagi setelah: *${nextAllowed.toLocaleString('id-ID')}*`,
          { parse_mode: 'Markdown' }
        );
      }
  
      // Cek keberadaan tag
      if (!text.includes('#fwconfess')) {
        console.log('🏷️ Tag #fwconfess not found in message');
        // Kembalikan user ke pending karena tag salah
        pending.set(userId, {
          timestamp: now,
          user: user
        });
        console.log('🔄 User returned to pending due to missing tag');
        return ctx.reply(
          '❌ Tag *#fwconfess* tidak ditemukan.\n\n' +
          'Tambahkan tag tersebut agar confession dapat dipublish.\n\n' +
          '💡 Ketik confession kamu lagi dengan tag #fwconfess',
          { parse_mode: 'Markdown' }
        );
      }
  
      console.log('✅ Tag #fwconfess found');
  
      // Validasi panjang confession
      if (text.length > 4000) {
        console.log('📏 Confession too long:', text.length, 'characters');
        // Kembalikan user ke pending
        pending.set(userId, {
          timestamp: now,
          user: user
        });
        return ctx.reply(
          '❌ Confession terlalu panjang!\n\n' +
          'Maksimal 4000 karakter. Saat ini: ' + text.length + ' karakter'
        );
      }
  
      console.log('📏 Confession length OK:', text.length, 'characters');
  
      // Format confession message dengan gender dan rank
      const confessionMessage = formatConfessionMessage(text, user);
      console.log('📝 Formatted confession message:', confessionMessage);
      console.log('📡 Attempting to send message to channel:', targetChannelId);
      
      // Test koneksi bot terlebih dahulu
      try {
        const botInfo = await ctx.telegram.getMe();
        console.log('🤖 Bot info:', botInfo);
      } catch (botError) {
        console.error('❌ Bot connection error:', botError);
        throw new Error('Bot connection failed');
      }
      
      // Kirim ke grup diskusi terlebih dahulu menggunakan comment system
      const commentUrl = await commentSystem.sendToDiscussionGroup(ctx, confessionMessage);
      
      // Buat inline keyboard menggunakan comment system
      const inlineKeyboard = commentSystem.createInlineKeyboard(commentUrl, userId);

      // Kirim ke channel dengan tombol yang sesuai
      const result = await ctx.telegram.sendMessage(targetChannelId, confessionMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      });

      inlineKeyboard.push(showMeSystem.createShowMeButton(result.message_id));

      await ctx.telegram.editMessageReplyMarkup(
        targetChannelId,
        result.message_id,
        null,
        { inline_keyboard: inlineKeyboard }
      );
      
      
      console.log('✅ Message sent successfully to channel');
      console.log('📋 Message result:', {
        message_id: result.message_id,
        date: result.date,
        chat: result.chat
      });
      
      // Simpan timestamp terakhir SETELAH berhasil kirim
      lastSent.set(userId, now);
      console.log('⏰ Rate limit timestamp saved for user:', userId);
      
      // Save confession to database
      console.log('💾 Saving confession to database...');
      await Database.saveConfession(userId, text, result.message_id);
      console.log('✅ Confession saved to database');
      
      const successMessage = commentUrl ? 
        '🎉 *Menfess berhasil dipublish!*\n\n' +
        '• Menfess kamu sudah tayang di channel\n' +
        '• User lain bisa klik "Hit Me" untuk chat denganmu\n' +
        '• User bisa memberikan komentar melalui tombol "Comment"\n' +
        '• Kamu akan dapat notifikasi jika ada yang tertarik\n\n' +
        '⏰ Kamu bisa menfess lagi dalam 8 jam' :
        '🎉 *Menfess berhasil dipublish!*\n\n' +
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
      console.error('📝 Error description:', err.description);
      console.error('⚙️ Error parameters:', err.parameters);
      console.error('📡 Error response:', err.response);
      console.error('📚 Stack trace:', err.stack);
      console.error('==========================================');
      
      // Kembalikan user ke pending jika error bukan dari rate limit
      if (err.code !== 429) {
        try {
          const userData = await Database.getUserById(userId);
          if (userData) {
            pending.set(userId, {
              timestamp: Date.now(),
              user: userData
            });
            console.log('🔄 User returned to pending due to error');
          }
        } catch (dbError) {
          console.error('❌ Error getting user data for pending restore:', dbError);
        }
      }
      
      // Error message yang lebih spesifik
      let errorMessage = '❌ Terjadi kesalahan saat publish confession.\n\n';
      
      if (err.code === 403) {
        errorMessage += '🚫 Bot tidak memiliki izin untuk mengirim pesan ke channel tersebut.';
        console.error('🚫 PERMISSION ERROR: Bot cannot send to channel:', targetChannelId);
      } else if (err.code === 400) {
        errorMessage += '📝 Format pesan tidak valid. Periksa kembali confession kamu.';
        console.error('📝 BAD REQUEST: Invalid message format');
      } else if (err.code === 429) {
        errorMessage += '⏰ Terlalu banyak permintaan. Coba lagi dalam beberapa menit.';
        console.error('⏰ RATE LIMIT: Too many requests');
      } else if (err.message && err.message.includes('chat not found')) {
        errorMessage += '🔍 Channel tidak ditemukan. Periksa ID channel.';
        console.error('🔍 CHAT NOT FOUND: Channel ID might be wrong:', targetChannelId);
      } else {
        errorMessage += '🔧 Silakan coba lagi nanti.';
        console.error('🔧 UNKNOWN ERROR');
      }
      
      await ctx.reply(errorMessage);
    }
  } 

  // Debug commands untuk testing
  bot.command('debug_pending', async (ctx) => {
    if (ctx.from.id === parseInt(process.env.ADMIN_ID) || ctx.from.id === 123456789) { // Ganti dengan admin ID
      const pendingList = Array.from(pending.entries()).map(([id, data]) => 
        `${id}: ${data.user.gender || 'Unknown'} - ${new Date(data.timestamp).toLocaleString()}`
      );
      await ctx.reply(`Pending users:\n${pendingList.join('\n') || 'None'}`);
    }
  });

  bot.command('debug_ratelimit', async (ctx) => {
    if (ctx.from.id === parseInt(process.env.ADMIN_ID) || ctx.from.id === 123456789) {
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
    // Export comment system methods
    commentSystem,
    showMeSystem
  };
}

/**
 * Format confession message dengan gender dan rank
 * @param {string} text - Text confession asli
 * @param {Object} user - Data user dari database
 * @returns {string} Formatted confession message
 */
function formatConfessionMessage(text, user) {
  const genderEmoji = getGenderEmoji(user.gender);
  const rankEmoji = getRankEmoji(user.rank);
  
  // Jangan escape karakter markdown dulu untuk testing
  // const safeText = text.replace(/[_*\[\]()~`>#+=|{}.!-]/g, '\\$&');
  const safeGender = (user.gender || 'Unknown');
  const safeRank = (user.rank || 'Member');
  const safeOrigin = (user.origin || 'Unknown');
  
  return `💭 *ANONYMOUS CONFESSION*\n\n` +
         `${text}\n\n` +
         `━━━━━━━━━━━━━━━━━━━\n` +
         `${genderEmoji} Gender: *${safeGender}*\n` +
         `${rankEmoji} Rank: *${safeRank}*\n` +
         `📍 Origin: *${safeOrigin}*`;
}

/**
 * Mendapatkan emoji berdasarkan gender
 * @param {string} gender
 * @returns {string} Emoji gender
 */
function getGenderEmoji(gender) {
  const genderEmojis = {
    'male': '👨',
    'female': '👩',
    'laki-laki': '👨',
    'perempuan': '👩',
    'pria': '👨',
    'wanita': '👩',
    'l': '👨',
    'p': '👩'
  };
  return genderEmojis[gender?.toLowerCase()] || '👤';
}

/**
 * Mendapatkan emoji berdasarkan rank
 * @param {string} rank
 * @returns {string} Emoji rank
 */
function getRankEmoji(rank) {
  const rankEmojis = {
    'admin': '👑',
    'moderator': '🛡️', 
    'vip': '⭐',
    'premium': '💎',
    'member': '👤',
    'newbie': '🌱'
  };
  return rankEmojis[rank?.toLowerCase()] || '👤';
}