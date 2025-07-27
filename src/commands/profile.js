import { Markup } from 'telegraf';
import { supabase } from '../services/db.js';

/**
 * Handler untuk menampilkan profile user
 * @param {Telegraf} bot
 */
export default function profileCommand(bot) {
  
  // Handler untuk tombol 'Lihat Profile'
  bot.action('btn_profile', async (ctx) => {
    await ctx.answerCbQuery();
    await showUserProfile(ctx);
  });

  // Command /profile untuk akses langsung
  bot.command('profile', async (ctx) => {
    await showUserProfile(ctx);
  });

  /**
   * Fungsi untuk menampilkan data profile user
   * @param {Context} ctx
   */
  async function showUserProfile(ctx) {
    const userId = ctx.from.id;
    
    try {
      // Loading message
      const loadingMsg = await ctx.reply('⏳ Memuat profile...');
      
      // Query data user dari Supabase
      const { data: user, error } = await supabase
        .from('users')
        .select('telegram_id, rank, gender, origin')
        .eq('telegram_id', userId)
        .single();
      
      // Hapus loading message
      await ctx.deleteMessage(loadingMsg.message_id).catch(() => {});
      
      if (error && error.code === 'PGRST116') {
        // User tidak ditemukan
        await ctx.reply(
          '❌ Profile tidak ditemukan!\n\n' +
          'Sepertinya kamu belum terdaftar. Silakan daftar terlebih dahulu dengan menggunakan perintah /register.',
          Markup.inlineKeyboard([
            [Markup.button.callback('📝 Daftar Sekarang', 'btn_register')],
            [Markup.button.callback('🏠 Kembali ke Menu', 'btn_back_to_start')]
          ])
        );
        return;
      }
      
      if (error) {
        throw error;
      }
      
      if (!user) {
        await ctx.reply(
          '❌ Profile tidak ditemukan!\n\n' +
          'Sepertinya kamu belum terdaftar. Silakan daftar terlebih dahulu dengan menggunakan perintah /register.',
          Markup.inlineKeyboard([
            [Markup.button.callback('📝 Daftar Sekarang', 'btn_register')],
            [Markup.button.callback('🏠 Kembali ke Menu', 'btn_back_to_start')]
          ])
        );
        return;
      }
      
      // Format data profile
      const profileText = formatProfile(user, ctx.from);
      
      await ctx.reply(
        profileText,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('✏️ Edit Profile', 'btn_edit_profile')],
            [Markup.button.callback('🏠 Kembali ke Menu', 'btn_back_to_start')]
          ])
        }
      );
      
    } catch (error) {
      console.error('Error loading user profile:', error);
      await ctx.reply(
        '❌ Terjadi kesalahan saat memuat profile.\n' +
        'Silakan coba lagi nanti atau hubungi admin jika masalah berlanjut.\n\n' +
        `Error: ${error.message || 'Unknown error'}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🏠 Kembali ke Menu', 'btn_back_to_start')]
        ])
      );
    }
  }

  // Handler untuk tombol 'Edit Profile'
  bot.action('btn_edit_profile', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
      '✏️ Fitur edit profile sedang dalam pengembangan.\n' +
      'Untuk saat ini, silakan hubungi admin jika ingin mengubah data profile.',
      Markup.inlineKeyboard([
        [Markup.button.callback('🏠 Kembali ke Menu', 'btn_back_to_start')]
      ])
    );
  });

  // Handler untuk tombol 'Kembali ke Menu'
  bot.action('btn_back_to_start', async (ctx) => {
    await ctx.answerCbQuery();
    const welcomeText = `Halo ${ctx.from.first_name}! 🤖\nPilih opsi di bawah ini:`;
    const buttons = [
      [Markup.button.callback('📣 Kirim Menfess', 'btn_confess')],
      [Markup.button.callback('👤 Lihat Profile', 'btn_profile')],
      [Markup.button.callback('📜 Lihat Menfess', 'btn_view')],
      [Markup.button.callback('ℹ️ Bantuan', 'btn_help')]
    ];
    
    try {
      await ctx.editMessageText(welcomeText, Markup.inlineKeyboard(buttons));
    } catch (error) {
      // Jika gagal edit message, kirim pesan baru
      await ctx.reply(welcomeText, Markup.inlineKeyboard(buttons));
    }
  });
}

/**
 * Format data profile user untuk ditampilkan
 * @param {Object} user - Data user dari database
 * @param {Object} telegramUser - Data user dari Telegram
 * @returns {string} Text profile yang diformat
 */
function formatProfile(user, telegramUser) {
  const rankEmoji = getRankEmoji(user.rank);
  const genderEmoji = getGenderEmoji(user.gender);
  
  return `👤 *PROFILE USER*\n\n` +
         `🆔 *Telegram ID:* \`${user.telegram_id}\`\n` +
         `👤 *Nama:* ${telegramUser.first_name}${telegramUser.last_name ? ' ' + telegramUser.last_name : ''}\n` +
         `${telegramUser.username ? `📧 *Username:* @${telegramUser.username}\n` : ''}` +
         `${rankEmoji} *Rank:* ${user.rank || 'member'}\n` +
         `${genderEmoji} *Gender:* ${user.gender || 'Tidak diset'}\n` +
         `🌍 *Asal:* ${user.origin || 'Tidak diset'}\n\n` +
         `📅 *Profile dilihat:* ${new Date().toLocaleDateString('id-ID', { 
           weekday: 'long', 
           year: 'numeric', 
           month: 'long', 
           day: 'numeric',
           hour: '2-digit',
           minute: '2-digit'
         })}`;
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