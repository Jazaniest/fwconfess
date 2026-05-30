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
  const rankEnabled = await Database.getConfig('rank_system_enabled', '0');
  const welcomeText = `Halo ${ctx.from.first_name}! 🤖\n\nSelamat datang di FWB Confess Bot.\nPilih opsi di bawah ini:`;

  const buttons = [
    [Markup.button.callback('📣 Kirim Menfess', 'btn_confess')],
    [
      Markup.button.callback('👤 Lihat Profile', 'btn_profile'),
      Markup.button.callback('📜 Lihat Menfess', 'btn_view')
    ],
    [
      Markup.button.callback('🎲 Daget', 'btn_daget'),
      Markup.button.callback('💰 Donasi', 'btn_donasi')
    ],
  ];

  if (rankEnabled === '1') {
    buttons.push([Markup.button.callback('🏆 Upgrade Rank', 'btn_upgrade_rank')]);
  }

  buttons.push([Markup.button.callback('ℹ️ Bantuan', 'btn_help')]);
  await ctx.reply(welcomeText, Markup.inlineKeyboard(buttons));
}

/**
 * Handler untuk perintah /start
 * @param {Telegraf} bot
 */
export default function startCommand(bot) {
  const adminSystem = adminPanel(bot, process.env.TARGET_CHANNEL_ID);

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
      // Cek dulu apakah pesan sudah sama — kalau sama, skip edit
      const currentText = ctx.callbackQuery?.message?.text || '';
      const newText = '❌ Anda masih belum bergabung di semua channel/grup yang direkomendasikan. Silakan bergabung terlebih dahulu.';

      if (currentText !== newText) {
        await ctx.editMessageText(
          newText,
          Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Cek Lagi', 'check_membership')]
          ])
        ).catch(() => { });
      }
      return;
    }

    await ctx.editMessageText('✅ Keanggotaan berhasil diverifikasi! Selamat datang!').catch(() => { });
    setTimeout(async () => {
      await showMainMenu(ctx);
    }, 1500);
  });

  // === USER MENU HANDLERS ===

  // bot.action('btn_profile', membershipMiddleware, async (ctx) => {
  //   await ctx.answerCbQuery('📋 Memuat profile...');

  //   try {
  //     const userId = ctx.from.id;

  //     // Sync username dari Telegram ke DB
  //     await Database.updateUsername(userId, ctx.from.username);

  //     const userProfile = await Database.getUserFullProfile(userId);
  //     const totalConfessions = await Database.getTotalUserConfessions(userId);
  //     const privacy = await Database.getPrivacySettings(userId);

  //     const joinDate = userProfile?.registered_at
  //       ? new Date(userProfile.registered_at).toLocaleDateString('id-ID', {
  //         year: 'numeric', month: 'long', day: 'numeric'
  //       })
  //       : 'Tidak diketahui';

  //     const memberStatus = userProfile?.is_active === 1 ? '✅ Active' : '❌ Inactive';

  //     const profileText =
  //       `👤 *Profile Anda*\n\n` +
  //       `🆔 User ID: \`${userId}\`\n` +
  //       `👤 Username: ${ctx.from.username ? `@${ctx.from.username}` : '_Tidak ada_'}\n` +
  //       `📅 Bergabung: ${joinDate}\n` +
  //       `📝 Total Menfess: *${totalConfessions}*\n` +
  //       `🎯 Status: ${memberStatus}\n` +
  //       `📍 Origin: ${userProfile?.origin || 'Tidak diisi'}\n` +
  //       `👥 Gender: ${userProfile?.gender || 'Tidak diisi'}\n` +
  //       `🏆 Rank: ${userProfile?.rank || 'Member'}\n\n` +
  //       `🔒 *Privacy:*\n` +
  //       `• Username: ${privacy.hide_username ? '🙈 Tersembunyi' : '👁 Terlihat'}\n` +
  //       `• Gender: ${privacy.hide_gender ? '🙈 Tersembunyi' : '👁 Terlihat'}\n` +
  //       `• Origin: ${privacy.hide_origin ? '🙈 Tersembunyi' : '👁 Terlihat'}`;

  //     await ctx.editMessageText(profileText, {
  //       parse_mode: 'Markdown',
  //       reply_markup: {
  //         inline_keyboard: [
  //           [
  //             { text: '✏️ Edit Profile', callback_data: 'edit_profile' },
  //             { text: '🔒 Atur Privacy', callback_data: 'privacy_settings' }
  //           ],
  //           [{ text: '🏠 Menu Utama', callback_data: 'back_to_main' }]
  //         ]
  //       }
  //     });

  //   } catch (error) {
  //     console.error('Error showing profile:', error);
  //     await ctx.editMessageText(
  //       '❌ Error memuat profile. Silakan coba lagi.',
  //       Markup.inlineKeyboard([
  //         [{ text: '🔄 Coba Lagi', callback_data: 'btn_profile' }],
  //         [{ text: '🏠 Menu Utama', callback_data: 'back_to_main' }]
  //       ])
  //     );
  //   }
  // });

  bot.action('btn_view', membershipMiddleware, async (ctx) => {
    await ctx.answerCbQuery();

    try {
      const telegramId = ctx.from.id;

      const confessions = await Database.getConfessionsByUserId(telegramId, 5);

      let listText = '';

      if (confessions.length === 0) {
        listText = `_Kamu belum pernah mengirim menfess atau data tidak ditemukan._\n\n`;
      } else {
        confessions.forEach((cf, index) => {
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

      await ctx.reply(viewText, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📣 Ke Channel', url: 'https://t.me/fwb_confess' },
              { text: '💬 Ke Grup', url: 'https://t.me/fwb_confesschat' }
            ],
            [
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
      `• Profile dan statistik personal\n\n` +
      `🔹 *Aturan Penting:*\n` +
      `• Gunakan bahasa yang sopan dan tidak menyinggung\n` +
      `• Jangan spam atau flood confession\n` +
      `• Patuhi peraturan channel dan grup\n` +
      `• Dilarang share informasi pribadi\n` +
      `• Jangan membuat confession yang melanggar hukum\n\n` +
      `📞 *Kontak:*\n` +
      `Admin: @jzxty\n` +
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
            { text: '📞 Kontak Admin', url: 'https://t.me/jzxty' },
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
      `A: Hubungi admin melalui @jzxty`;

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

  // bot.action('edit_profile', membershipMiddleware, async (ctx) => {
  //   await ctx.answerCbQuery();

  //   await ctx.reply(`✏️ *Edit Profile*\n\nPilih data yang ingin diubah:`, {
  //     parse_mode: 'Markdown',
  //     reply_markup: {
  //       inline_keyboard: [
  //         [
  //           { text: '👥 Ubah Gender', callback_data: 'edit_gender' },
  //           { text: '📍 Ubah Origin', callback_data: 'edit_origin' }
  //         ],
  //         [{ text: '🔙 Kembali ke Profile', callback_data: 'btn_profile' }]
  //       ]
  //     }
  //   });
  // });

  // ─── Edit gender ──────────────────────────────────────────────────────────────
  bot.action('edit_gender', membershipMiddleware, async (ctx) => {
    await ctx.answerCbQuery();

    await ctx.reply('👥 *Ubah Gender*\n\nPilih gender kamu:', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Laki-laki', callback_data: 'set_gender_male' },
            { text: 'Perempuan', callback_data: 'set_gender_female' }
          ],
          [{ text: 'Lainnya', callback_data: 'set_gender_other' }],
          [{ text: '🔙 Kembali', callback_data: 'edit_profile' }]
        ]
      }
    });
  });

  bot.action(/^set_gender_(.+)$/, membershipMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const gender = ctx.match[1]; // male / female / other

    await Database.updateGender(ctx.from.id, gender);

    await ctx.editMessageText(
      `✅ Gender berhasil diubah ke *${gender}*.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Kembali ke Profile', callback_data: 'btn_profile' }]
          ]
        }
      }
    );
  });

  // ─── Edit origin ──────────────────────────────────────────────────────────────
  // Gunakan session/Map untuk menandai user sedang menunggu input origin
  const pendingOriginEdit = new Map();

  bot.action('edit_origin', membershipMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    pendingOriginEdit.set(ctx.from.id, true);

    await ctx.reply(
      '📍 *Ubah Origin*\n\nKetik asal kamu yang baru.\nKetik `-` jika ingin mengosongkan.',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Batal', callback_data: 'cancel_edit_origin' }]
          ]
        }
      }
    );
  });

  bot.action('cancel_edit_origin', async (ctx) => {
    await ctx.answerCbQuery();
    pendingOriginEdit.delete(ctx.from.id);
    await ctx.editMessageText('❌ Edit origin dibatalkan.', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Kembali ke Profile', callback_data: 'btn_profile' }]
        ]
      }
    });
  });

  // ─── Privacy settings ─────────────────────────────────────────────────────────
  bot.action('privacy_settings', membershipMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const privacy = await Database.getPrivacySettings(ctx.from.id);

    await ctx.reply(
      `🔒 *Pengaturan Privacy*\n\n` +
      `Pilih field yang ingin kamu sembunyikan atau tampilkan di confession.\n\n` +
      `• Username : ${privacy.hide_username ? '🙈 Tersembunyi' : '👁 Terlihat'}\n` +
      `• Gender   : ${privacy.hide_gender ? '🙈 Tersembunyi' : '👁 Terlihat'}\n` +
      `• Origin   : ${privacy.hide_origin ? '🙈 Tersembunyi' : '👁 Terlihat'}`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: `${privacy.hide_username ? '👁 Tampilkan' : '🙈 Sembunyikan'} Username`, callback_data: 'toggle_hide_username' }],
            [{ text: `${privacy.hide_gender ? '👁 Tampilkan' : '🙈 Sembunyikan'} Gender`, callback_data: 'toggle_hide_gender' }],
            [{ text: `${privacy.hide_origin ? '👁 Tampilkan' : '🙈 Sembunyikan'} Origin`, callback_data: 'toggle_hide_origin' }],
            [{ text: '🔙 Kembali ke Profile', callback_data: 'btn_profile' }]
          ]
        }
      }
    );
  });

  bot.action(/^toggle_hide_(username|gender|origin)$/, membershipMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const field = `hide_${ctx.match[1]}`; // hide_username / hide_gender / hide_origin
    const privacy = await Database.getPrivacySettings(ctx.from.id);
    const newValue = privacy[field] ? 0 : 1;

    await Database.setPrivacyField(ctx.from.id, field, newValue);

    // Refresh tampilan privacy_settings dengan data terbaru
    const updated = await Database.getPrivacySettings(ctx.from.id);

    await ctx.editMessageText(
      `🔒 *Pengaturan Privacy*\n\n` +
      `Pilih field yang ingin kamu sembunyikan atau tampilkan di confession.\n\n` +
      `• Username : ${updated.hide_username ? '🙈 Tersembunyi' : '👁 Terlihat'}\n` +
      `• Gender   : ${updated.hide_gender ? '🙈 Tersembunyi' : '👁 Terlihat'}\n` +
      `• Origin   : ${updated.hide_origin ? '🙈 Tersembunyi' : '👁 Terlihat'}`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: `${updated.hide_username ? '👁 Tampilkan' : '🙈 Sembunyikan'} Username`, callback_data: 'toggle_hide_username' }],
            [{ text: `${updated.hide_gender ? '👁 Tampilkan' : '🙈 Sembunyikan'} Gender`, callback_data: 'toggle_hide_gender' }],
            [{ text: `${updated.hide_origin ? '👁 Tampilkan' : '🙈 Sembunyikan'} Origin`, callback_data: 'toggle_hide_origin' }],
            [{ text: '🔙 Kembali ke Profile', callback_data: 'btn_profile' }]
          ]
        }
      }
    );
  });

  // bot.action('my_stats', membershipMiddleware, async (ctx) => {
  //   await ctx.answerCbQuery();

  //   const userId = ctx.from.id;

  //   const statsText = `📊 *Statistik Anda*\n\n` +
  //     `👤 User ID: \`${userId}\`\n` +
  //     `🏆 Rank: Member\n\n` +
  //     `_Data sedang dimuat dari database..._`;

  //   await ctx.reply(statsText, {
  //     parse_mode: 'Markdown',
  //     reply_markup: {
  //       inline_keyboard: [
  //         [{ text: '🏠 Menu Utama', callback_data: 'back_to_main' }]
  //       ]
  //     }
  //   });
  // });

  // bot.action('my_menfess', membershipMiddleware, async (ctx) => {
  //   await ctx.answerCbQuery();

  //   const menfessText = `📝 *Menfess Saya*\n\n_Sedang memuat data dari database..._`;

  //   await ctx.reply(menfessText, {
  //     parse_mode: 'Markdown',
  //     reply_markup: {
  //       inline_keyboard: [
  //         [
  //           { text: '🔄 Refresh', callback_data: 'my_menfess' },
  //           { text: '🏠 Menu Utama', callback_data: 'back_to_main' }
  //         ]
  //       ]
  //     }
  //   });
  // });

  bot.action('btn_upgrade_rank', membershipMiddleware, async (ctx) => {
    await ctx.answerCbQuery();

    const activeRanks = await Database.getActiveRanks();

    if (activeRanks.length === 0) {
      return ctx.reply('⏳ Belum ada rank yang tersedia untuk upgrade saat ini.');
    }

    let text = `🏆 *Upgrade Rank*\n\nPilih rank yang ingin kamu upgrade:\n\n`;
    activeRanks.forEach(r => {
      text += `• *${r.rank}* — bisa menfess ${r.max_count}x per window\n`;
    });
    text += `\n_Fitur pembayaran akan segera tersedia._`;

    const buttons = activeRanks.map(r => ([
      Markup.button.callback(`⬆️ ${r.rank} (${r.max_count}x)`, `upgrade_to_${r.rank}`)
    ]));
    buttons.push([Markup.button.callback('🏠 Menu Utama', 'back_to_main')]);

    await ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons }
    });
  });

  // Handler tiap pilihan upgrade — dummy
  bot.action(/^upgrade_to_(.+)$/, membershipMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    const rank = ctx.match[1];

    await ctx.reply(
      `⏳ *Upgrade ke rank ${rank}*\n\nFitur pembayaran sedang dalam pengembangan.\nHubungi admin untuk upgrade manual: @jzxty`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.url('📞 Hubungi Admin', 'https://t.me/jzxty')],
            [Markup.button.callback('🔙 Kembali', 'btn_upgrade_rank')]
          ]
        }
      }
    );
  });

  bot.on('text', async (ctx, next) => {
    const userId = ctx.from.id;

    if (!pendingOriginEdit.has(userId)) return next();

    const input = ctx.message.text.trim();
    const origin = input === '-' ? null : input;

    pendingOriginEdit.delete(userId);
    await Database.updateOrigin(userId, origin);

    await ctx.reply(
      `✅ Origin berhasil diubah ke *${origin || 'kosong'}*.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Kembali ke Profile', callback_data: 'btn_profile' }]
          ]
        }
      }
    );
  });

  return {
    membershipMiddleware,
    checkMembership,
    showJoinRequirement,
    showMainMenu,
    adminSystem
  };
}