import { Markup } from 'telegraf';
import adminPanel from './admin.js';

/**
 * Fungsi untuk memeriksa apakah user sudah bergabung di channel dan grup
 * @param {Context} ctx - Context dari Telegraf
 * @param {string} userId - ID user yang akan dicek
 * @returns {Object} - Status keanggotaan
 */
async function checkMembership(ctx, userId) {
  const channelId = process.env.TARGET_CHANNEL_ID;
  const groupId = process.env.DISCUSSION_GROUP_ID;
  
  try {
    // Cek keanggotaan di channel
    const channelMember = await ctx.telegram.getChatMember(channelId, userId);
    const isChannelMember = ['member', 'administrator', 'creator'].includes(channelMember.status);
    
    // Cek keanggotaan di grup
    const groupMember = await ctx.telegram.getChatMember(groupId, userId);
    const isGroupMember = ['member', 'administrator', 'creator'].includes(groupMember.status);
    
    return {
      isChannelMember,
      isGroupMember,
      channelId,
      groupId
    };
  } catch (error) {
    console.error('Error checking membership:', error);
    return {
      isChannelMember: false,
      isGroupMember: false,
      channelId,
      groupId
    };
  }
}

/**
 * Fungsi untuk menampilkan pesan join requirement
 * @param {Context} ctx - Context dari Telegraf
 * @param {Object} membershipStatus - Status keanggotaan user
 */
async function showJoinRequirement(ctx, membershipStatus) {
  const { isChannelMember, isGroupMember, channelId, groupId } = membershipStatus;
  
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

/**
 * Fungsi untuk menampilkan menu utama untuk user biasa
 * @param {Context} ctx - Context dari Telegraf
 */
async function showMainMenu(ctx) {
  const welcomeText = `Halo ${ctx.from.first_name}! 🤖\n\nSelamat datang di FWB Confess Bot.\nPilih opsi di bawah ini:`;
  const buttons = [
    [Markup.button.callback('📣 Kirim Menfess', 'btn_confess')],
    [
      Markup.button.callback('👤 Lihat Profile', 'btn_profile'),
      Markup.button.callback('📜 Lihat Menfess', 'btn_view')
    ],
    [Markup.button.callback('ℹ️ Bantuan', 'btn_help')]
  ];
  await ctx.reply(welcomeText, Markup.inlineKeyboard(buttons));
}

/**
 * Middleware untuk memeriksa keanggotaan sebelum mengakses fitur
 * @param {Context} ctx - Context dari Telegraf
 * @param {Function} next - Fungsi next untuk melanjutkan
 */
async function membershipMiddleware(ctx, next) {
  const userId = ctx.from.id;
  
  // Admin bypass membership check
  if (adminSystem.isAdmin(userId)) {
    console.log('👑 Admin bypassing membership check:', userId);
    return next();
  }
  
  const membershipStatus = await checkMembership(ctx, userId);
  
  if (!membershipStatus.isChannelMember || !membershipStatus.isGroupMember) {
    await showJoinRequirement(ctx, membershipStatus);
    return;
  }
  
  return next();
}

/**
 * Handler untuk perintah /start: menampilkan panel pilihan dengan inline keyboard
 * @param {Telegraf} bot
 */
export default function startCommand(bot) {
  // Initialize admin system
  const adminSystem = adminPanel(bot);

  // Handler untuk perintah /start dengan deteksi admin
  bot.start(async (ctx) => {
    const userId = ctx.from.id;
    
    console.log(`🚀 Start command from user: ${userId} (${ctx.from.first_name})`);
    
    // Cek apakah user adalah admin
    if (adminSystem.isAdmin(userId)) {
      console.log('👑 Admin detected, showing admin menu');
      await adminSystem.showAdminMenu(ctx);
      return;
    }
    
    // Untuk user biasa, cek membership dulu
    const membershipStatus = await checkMembership(ctx, userId);
    
    if (!membershipStatus.isChannelMember || !membershipStatus.isGroupMember) {
      await showJoinRequirement(ctx, membershipStatus);
      return;
    }
    
    await showMainMenu(ctx);
  });

  // Handler untuk tombol cek keanggotaan
  bot.action('check_membership', async (ctx) => {
    await ctx.answerCbQuery('Mengecek keanggotaan...');
    
    const userId = ctx.from.id;
    const membershipStatus = await checkMembership(ctx, userId);
    
    if (!membershipStatus.isChannelMember || !membershipStatus.isGroupMember) {
      await ctx.editMessageText(
        "❌ Anda masih belum bergabung di semua channel/grup yang direkomendasikan. Silakan bergabung terlebih dahulu.",
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Cek Lagi', 'check_membership')]
        ])
      );
      return;
    }
    
    await ctx.editMessageText("✅ Keanggotaan berhasil diverifikasi! Selamat datang!");
    setTimeout(async () => {
      await showMainMenu(ctx);
    }, 1500);
  });

  // === USER MENU HANDLERS ===

  // Handler untuk tombol 'Lihat Profile' dengan middleware
  bot.action('btn_profile', membershipMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    
    try {
      // TODO: Implement profile logic
      const userId = ctx.from.id;
      
      // Placeholder profile data
      const profileText = `👤 *Profile Anda*\n\n` +
        `🆔 User ID: \`${userId}\`\n` +
        `👤 Nama: ${ctx.from.first_name || 'Tidak diketahui'}\n` +
        `📅 Bergabung: Loading...\n` +
        `📝 Total Menfess: Loading...\n` +
        `💬 Total Komentar: Loading...\n` +
        `🎯 Status: Member\n` +
        `📍 Origin: Loading...\n\n` +
        `_Data sedang dimuat dari database..._`;
      
      await ctx.reply(profileText, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📝 Edit Profile', callback_data: 'edit_profile' },
              { text: '📊 My Stats', callback_data: 'my_stats' }
            ],
            [{ text: '🏠 Menu Utama', callback_data: 'back_to_main' }]
          ]
        }
      });
      
    } catch (error) {
      console.error('Error showing profile:', error);
      await ctx.reply('❌ Error memuat profile. Silakan coba lagi.');
    }
  });

  // Handler untuk tombol 'Lihat Menfess' dengan middleware
  bot.action('btn_view', membershipMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    
    try {
      // TODO: Implement view menfess logic
      const viewText = `📜 *Menfess Terbaru*\n\n` +
        `Berikut adalah daftar menfess terbaru:\n\n` +
        `_Fitur sedang dalam pengembangan..._\n\n` +
        `💡 Sementara ini, Anda bisa melihat menfess langsung di channel atau grup diskusi.`;
      
      await ctx.reply(viewText, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📣 Ke Channel', url: 'https://t.me/fwb_confess' },
              { text: '💬 Ke Grup', url: 'https://t.me/fwb_confesschat' }
            ],
            [
              { text: '📝 My Menfess', callback_data: 'my_menfess' },
              { text: '🔄 Refresh', callback_data: 'btn_view' }
            ],
            [{ text: '🏠 Menu Utama', callback_data: 'back_to_main' }]
          ]
        }
      });
      
    } catch (error) {
      console.error('Error showing menfess list:', error);
      await ctx.reply('❌ Error memuat daftar menfess. Silakan coba lagi.');
    }
  });

  // Handler untuk tombol 'Bantuan'
  bot.action('btn_help', async (ctx) => {
    await ctx.answerCbQuery();
    
    const isUserAdmin = adminSystem.isAdmin(ctx.from.id);
    
    const helpText = `ℹ️ *Bantuan FWB Confess Bot*\n\n` +
      `🔹 *Cara Menggunakan:*\n` +
      `1. Klik "Kirim Menfess" untuk membuat confession\n` +
      `2. Tulis confession dengan tag #fwconfess\n` +
      `3. Confession akan dipublish secara anonymous\n\n` +
      `🔹 *Fitur Utama:*\n` +
      `• Anonymous confession dengan gender & rank\n` +
      `• Hit Me untuk chat anonymous dengan pembuat menfess\n` +
      `• Sistem komentar di grup diskusi\n` +
      `• Rate limit 8 jam per confession\n` +
      `• Profile dan statistik personal\n\n` +
      `🔹 *Aturan Penting:*\n` +
      `• Gunakan bahasa yang sopan dan tidak menyinggung\n` +
      `• Jangan spam atau flood confession\n` +
      `• Patuhi peraturan channel dan grup\n` +
      `• Dilarang share informasi pribadi\n` +
      `• Jangan membuat confession yang melanggar hukum\n\n` +
      `🔹 *Cara Melaporkan:*\n` +
      `Jika menemukan confession yang melanggar aturan, segera laporkan ke admin.\n\n` +
      `📞 *Kontak:*\n` +
      `Admin: @SanzJzx\n` +
      `Channel: @fwb_confess\n` +
      `Grup: @fwb_confesschat`;
    
    const backButton = isUserAdmin ? 'back_to_admin' : 'back_to_main';
    const backText = isUserAdmin ? '👑 Admin Panel' : '🏠 Menu Utama';
    
    await ctx.reply(helpText, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📣 Channel', url: 'https://t.me/fwb_confess' },
            { text: '💬 Grup', url: 'https://t.me/fwb_confesschat' }
          ],
          [
            { text: '📞 Kontak Admin', url: 'https://t.me/SanzJzx' },
            { text: '📋 FAQ', callback_data: 'show_faq' }
          ],
          [{ text: backText, callback_data: backButton }]
        ]
      }
    });
  });

  // Handler untuk FAQ
  bot.action('show_faq', async (ctx) => {
    await ctx.answerCbQuery();
    
    const faqText = `❓ *Frequently Asked Questions*\n\n` +
      `*Q: Bagaimana cara kirim menfess?*\n` +
      `A: Klik "Kirim Menfess", tulis confession dengan tag #fwconfess\n\n` +
      `*Q: Kenapa menfess saya tidak muncul?*\n` +
      `A: Pastikan sudah include tag #fwconfess dan tidak melanggar aturan\n\n` +
      `*Q: Berapa lama cooldown untuk kirim menfess lagi?*\n` +
      `A: 8 jam setelah menfess terakhir berhasil dipublish\n\n` +
      `*Q: Bagaimana cara menggunakan fitur "Hit Me"?*\n` +
      `A: Klik tombol "Hit Me" di menfess yang menarik, bot akan membantu menghubungkan secara anonymous\n\n` +
      `*Q: Data saya aman tidak?*\n` +
      `A: Ya, semua confession bersifat anonymous. Hanya admin yang bisa melihat identitas asli untuk keperluan moderasi\n\n` +
      `*Q: Bagaimana cara melaporkan menfess yang tidak pantas?*\n` +
      `A: Hubungi admin melalui @SanzJzx dengan screenshot dan alasan pelaporan`;
    
    const isUserAdmin = adminSystem.isAdmin(ctx.from.id);
    const backButton = isUserAdmin ? 'back_to_admin' : 'btn_help';
    
    await ctx.reply(faqText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Kembali ke Bantuan', callback_data: backButton }]
        ]
      }
    });
  });

  // Handler untuk kembali ke menu utama (user biasa)
  bot.action('back_to_main', async (ctx) => {
    await ctx.answerCbQuery();
    await showMainMenu(ctx);
  });

  // Handler untuk edit profile
  bot.action('edit_profile', membershipMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    
    const editText = `📝 *Edit Profile*\n\n` +
      `Pilih data yang ingin diubah:\n\n` +
      `⚠️ *Catatan:* Perubahan gender dan origin akan mempengaruhi tampilan menfess Anda selanjutnya.`;
    
    await ctx.reply(editText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '👤 Gender', callback_data: 'edit_gender' },
            { text: '📍 Origin', callback_data: 'edit_origin' }
          ],
          [
            { text: '🏆 Rank Info', callback_data: 'rank_info' },
            { text: '🎯 Status', callback_data: 'edit_status' }
          ],
          [{ text: '🏠 Menu Utama', callback_data: 'back_to_main' }]
        ]
      }
    });
  });

  // Handler untuk my stats
  bot.action('my_stats', membershipMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    
    // TODO: Implement actual database queries
    const statsText = `📊 *Statistik Anda*\n\n` +
      `👤 User ID: \`${userId}\`\n` +
      `📅 Member sejak: Loading...\n` +
      `📝 Total Menfess: Loading...\n` +
      `💬 Total Komentar: Loading...\n` +
      `💝 Hit Me diterima: Loading...\n` +
      `📈 Engagement Rate: Loading...\n` +
      `🏆 Rank: Member\n` +
      `⭐ Points: Loading...\n\n` +
      `📈 *Aktivitas 30 Hari Terakhir:*\n` +
      `• Menfess: Loading...\n` +
      `• Komentar: Loading...\n` +
      `• Hit Me: Loading...\n\n` +
      `_Data sedang dimuat dari database..._`;
    
    await ctx.reply(statsText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📊 Detail Stats', callback_data: 'detailed_stats' },
            { text: '🏆 Leaderboard', callback_data: 'leaderboard' }
          ],
          [{ text: '🏠 Menu Utama', callback_data: 'back_to_main' }]
        ]
      }
    });
  });

  // Handler untuk my menfess
  bot.action('my_menfess', membershipMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    
    // TODO: Implement actual database queries to get user's confessions
    const menfessText = `📝 *Menfess Saya*\n\n` +
      `Berikut adalah daftar menfess yang pernah Anda kirim:\n\n` +
      `_Sedang memuat data dari database..._\n\n` +
      `💡 *Tips:* Anda dapat melihat statistik engagement untuk setiap menfess Anda.`;
    
    await ctx.reply(menfessText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📊 Stats Menfess', callback_data: 'menfess_stats' },
            { text: '🔄 Refresh', callback_data: 'my_menfess' }
          ],
          [{ text: '🏠 Menu Utama', callback_data: 'back_to_main' }]
        ]
      }
    });
  });

  // Export middleware dan functions agar bisa digunakan oleh modul lain
  return {
    membershipMiddleware,
    checkMembership,
    showJoinRequirement,
    showMainMenu,
    adminSystem
  };
}