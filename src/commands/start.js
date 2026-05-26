import { Markup } from 'telegraf';
import adminPanel from './admin.js';
import { Database } from './database.js';

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
    const channelMember = await ctx.telegram.getChatMember(channelId, userId);
    const isChannelMember = ['member', 'administrator', 'creator'].includes(channelMember.status);

    const groupMember = await ctx.telegram.getChatMember(groupId, userId);
    const isGroupMember = ['member', 'administrator', 'creator'].includes(groupMember.status);

    return { isChannelMember, isGroupMember, channelId, groupId };
  } catch (error) {
    console.error('Error checking membership:', error);
    return { isChannelMember: false, isGroupMember: false, channelId, groupId };
  }
}

/**
 * Fungsi untuk menampilkan pesan join requirement
 */
async function showJoinRequirement(ctx, membershipStatus) {
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

/**
 * Fungsi untuk menampilkan menu utama untuk user biasa
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
 * Handler untuk perintah /start
 * @param {Telegraf} bot
 */
export default function startCommand(bot) {
  // ✅ FIX BUG #1: adminSystem dibuat PERTAMA di dalam startCommand(),
  // sehingga bisa diakses oleh membershipMiddleware yang juga di dalam scope yang sama.
  const adminSystem = adminPanel(bot);

  /**
   * ✅ FIX BUG #1: membershipMiddleware DIPINDAHKAN ke dalam startCommand()
   * agar adminSystem berada dalam scope yang benar.
   * Sebelumnya fungsi ini ada di luar dan menyebabkan ReferenceError.
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

  // Handler untuk perintah /start dengan deteksi admin
  bot.start(async (ctx) => {
    const userId = ctx.from.id;
    console.log(`🚀 Start command from user: ${userId} (${ctx.from.first_name})`);

    if (adminSystem.isAdmin(userId)) {
      console.log('👑 Admin detected, showing admin menu');
      await adminSystem.showAdminMenu(ctx);
      return;
    }

    const membershipStatus = await checkMembership(ctx, userId);

    if (!membershipStatus.isChannelMember || !membershipStatus.isGroupMember) {
      await showJoinRequirement(ctx, membershipStatus);
      return;
    }

    await showMainMenu(ctx);
  });

  bot.command('menfess', membershipMiddleware, async (ctx) => {
    const userId = ctx.from.id;
    console.log(`📣 Menfess command from user: ${userId}`);

    // Trigger action yang sama dengan btn_confess
    await ctx.reply('📣 *Kirim Menfess*\n\nKlik tombol di bawah untuk mulai menulis confession kamu:', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [Markup.button.callback('✍️ Tulis Menfess', 'btn_confess')]
        ]
      }
    });
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

  bot.action('btn_profile', membershipMiddleware, async (ctx) => {
    await ctx.answerCbQuery('📋 Memuat profile...');

    try {
      const userId = ctx.from.id;

      // Ambil data user dari database
      const userProfile = await Database.getUserFullProfile(userId);
      const totalConfessions = await Database.getTotalUserConfessions(userId);

      // Format tanggal bergabung
      const joinDate = userProfile?.registered_at
        ? new Date(userProfile.registered_at).toLocaleDateString('id-ID', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
        : 'Tidak diketahui';

      // Tentukan status member
      const memberStatus = userProfile?.is_active === 1 ? '✅ Active' : '❌ Inactive';

      const profileText = `👤 *Profile Anda*\n\n` +
        `🆔 User ID: \`${userId}\`\n` +
        `👤 Nama: ${ctx.from.first_name || 'Tidak diketahui'}\n` +
        `📅 Bergabung: ${joinDate}\n` +
        `📝 Total Menfess: *${totalConfessions}*\n` +
        `🎯 Status: ${memberStatus}\n` +
        `📍 Origin: ${userProfile?.origin || 'Tidak diisi'}\n` +
        `👥 Gender: ${userProfile?.gender || 'Tidak diisi'}\n` +
        `🏆 Rank: ${userProfile?.rank || 'Member'}`;

      await ctx.editMessageText(profileText, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              // Fitur ini memerlukan pertimbangan lebih lanjut untuk di update di masa depan, karena melibatkan perubahan data user yang sensitif.
              // { text: '📝 Edit Profile', callback_data: 'edit_profile' },
              // { text: '📊 My Stats', callback_data: 'my_stats' }
            ],
            [{ text: '🏠 Menu Utama', callback_data: 'back_to_main' }]
          ]
        }
      });

    } catch (error) {
      console.error('Error showing profile:', error);
      await ctx.editMessageText(
        '❌ Error memuat profile. Silakan coba lagi.',
        Markup.inlineKeyboard([
          [{ text: '🔄 Coba Lagi', callback_data: 'btn_profile' }],
          [{ text: '🏠 Menu Utama', callback_data: 'back_to_main' }]
        ])
      );
    }
  });

  bot.action('btn_view', membershipMiddleware, async (ctx) => {
    await ctx.answerCbQuery();

    try {
      const telegramId = ctx.from.id; // Mengambil ID Telegram user yang menekan tombol

      // 1. Ambil data menfess dari database (Misal nama class-nya ConfessionModel)
      // Sesuai dengan nama class tempat fungsi saveConfession kamu berada
      const confessions = await Database.getConfessionsByUserId(telegramId, 5);

      // 2. Buat teks dinamis berdasarkan data yang didapat
      let listText = '';
      
      if (confessions.length === 0) {
        listText = `_Kamu belum pernah mengirim menfess atau data tidak ditemukan._\n\n`;
      } else {
        confessions.forEach((cf, index) => {
          // Memotong teks jika terlalu panjang agar chat tidak penuh
          const shortText = cf.message_text.length > 60 
            ? cf.message_text.substring(0, 60) + '...' 
            : cf.message_text;

          listText += `${index + 1}. *ID:* #${cf.id}\n` +
                      `📝 "${shortText}"\n` +
                      `🔗 [Lihat di Channel](https://t.me/fwb_confess/${cf.channel_message_id})\n\n`;
        });
      }

      const viewText = `📜 *Menfess Terbaru Anda*\n\n` +
        `${listText}` +
        `💡 Gunakan tombol di bawah untuk menyegarkan halaman atau kembali ke menu.`;

      // 3. Kirim/Edit pesan dengan data terbaru
      await ctx.reply(viewText, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true, // Agar link preview telegram tidak menumpuk di chat
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📣 Ke Channel', url: 'https://t.me/fwb_confess' },
              { text: '💬 Ke Grup', url: 'https://t.me/fwb_confesschat' }
            ],
            [
              // Tombol My Menfess bisa diaktifkan jika kamu punya handler 'my_menfess'
              // { text: '📝 My Menfess', callback_data: 'my_menfess' }, 
              { text: '🔄 Refresh', callback_data: 'btn_view' },
              { text: '🏠 Menu Utama', callback_data: 'back_to_main' }
            ]
          ]
        }
      });

    } catch (error) {
      console.error('Error showing menfess list:', error);
      await ctx.reply('❌ Error memuat daftar menfess. Silakan coba lagi.');
    }
  });

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
      `A: Klik tombol "Hit Me" di menfess yang menarik\n\n` +
      `*Q: Data saya aman tidak?*\n` +
      `A: Ya, semua confession bersifat anonymous\n\n` +
      `*Q: Bagaimana cara melaporkan menfess yang tidak pantas?*\n` +
      `A: Hubungi admin melalui @SanzJzx`;

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

  bot.action('back_to_main', async (ctx) => {
    await ctx.answerCbQuery();
    await showMainMenu(ctx);
  });

  bot.action('edit_profile', membershipMiddleware, async (ctx) => {
    await ctx.answerCbQuery();

    await ctx.reply(`📝 *Edit Profile*\n\nPilih data yang ingin diubah:`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '👤 Gender', callback_data: 'edit_gender' },
            { text: '📍 Origin', callback_data: 'edit_origin' }
          ],
          [{ text: '🏠 Menu Utama', callback_data: 'back_to_main' }]
        ]
      }
    });
  });

  bot.action('my_stats', membershipMiddleware, async (ctx) => {
    await ctx.answerCbQuery();

    const userId = ctx.from.id;

    const statsText = `📊 *Statistik Anda*\n\n` +
      `👤 User ID: \`${userId}\`\n` +
      `🏆 Rank: Member\n\n` +
      `_Data sedang dimuat dari database..._`;

    await ctx.reply(statsText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🏠 Menu Utama', callback_data: 'back_to_main' }]
        ]
      }
    });
  });

  bot.action('my_menfess', membershipMiddleware, async (ctx) => {
    await ctx.answerCbQuery();

    const menfessText = `📝 *Menfess Saya*\n\n_Sedang memuat data dari database..._`;

    await ctx.reply(menfessText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔄 Refresh', callback_data: 'my_menfess' },
            { text: '🏠 Menu Utama', callback_data: 'back_to_main' }
          ]
        ]
      }
    });
  });

  return {
    membershipMiddleware,
    checkMembership,
    showJoinRequirement,
    showMainMenu,
    adminSystem
  };
}