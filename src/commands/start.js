import { Markup } from 'telegraf';
import adminPanel from './admin.js';
import { checkMembership, showJoinRequirement } from '../middleware/membership.js';
import { showMainMenu } from '../handlers/start.handler.js';
import { privateChatOnly } from '../middleware/private-chat-only.js';

// --- Teks Bantuan & Kebijakan ---
const LEGAL_TEXTS = {
    privacy: `Pemberitahuan Privasi FWB Confess Bot\n\n` +
        `Terakhir diperbarui: ${new Date().toISOString().split('T')[0]}\n\n` +
        `Kami menghargai privasi Anda. Dokumen ini menjelaskan data apa yang kami kumpulkan dan bagaimana kami menggunakannya.\n\n` +
        `1. *DATA APA YANG KAMI KUMPULKAN?*\n` +
        `   - *ID Pengguna Telegram*: Untuk mengelola rank, koin, dan riwayat menfess Anda.\n` +
        `   - *Informasi Profil (Opsional)*: Gender dan kota asal yang Anda berikan.\n` +
        `   - *Konten Menfess*: Teks menfess yang Anda kirim.\n` +
        `   - *Data Interaksi*: Kami mencatat kapan Anda mengirim menfess atau menggunakan fitur "Hit Me" untuk tujuan pembatasan (rate limiting).\n\n` +
        `2. *BAGAIMANA DATA ANDA DITAMPILKAN?*\n` +
        `   - Saat Anda mengirim menfess, kami HANYA menampilkan gender dan rank Anda. Nama, username, dan ID Telegram Anda TIDAK PERNAH ditampilkan di channel.\n` +
        `   - Saat pengguna lain meminta "Show Me", kami akan meminta persetujuan Anda terlebih dahulu sebelum membagikan username Anda.\n\n` +
        `3. *PENGHAPUSAN DATA*\n` +
        `   - Saat ini, kami belum memiliki fitur penghapusan data otomatis. Jika Anda ingin semua data Anda dihapus, silakan hubungi admin di @${process.env.ADMIN_USERNAME || 'Admin'}.\n\n` +
        `Dengan menggunakan bot ini, Anda setuju dengan kebijakan privasi ini.`,

    rules: `📜 *Aturan Perilaku (Code of Conduct)*\n\n` +
        `Untuk menjaga komunitas tetap aman dan nyaman, harap patuhi aturan berikut:\n\n` +
        `1. *DILARANG KERAS:*\n` +
        `   - Konten pornografi, vulgar, atau menjijikkan.\n` +
        `   - Ujaran kebencian, SARA, atau diskriminasi.\n` +
        `   - Perundungan (bullying), pelecehan, atau ancaman.\n` +
        `   - Menyebarkan informasi pribadi orang lain (doxing).\n` +
        `   - Konten ilegal atau promosi aktivitas ilegal.\n` +
        `   - Spam atau promosi komersial.\n\n` +
        `2. *JAGA KUALITAS KONTEN:*\n` +
        `   - Gunakan bahasa yang sopan.\n` +
        `   - Hindari penggunaan huruf kapital berlebihan.\n\n` +
        `3. *KONSEKUENSI PELANGGARAN:*\n` +
        `   - Menfess yang melanggar akan dihapus.\n` +
        `   - Pelanggaran berulang akan mengakibatkan pemblokiran (ban).\n\n` +
        `Admin berhak mengambil tindakan yang diperlukan untuk menjaga kesehatan komunitas.`,

    help_main: 'ℹ️ *Bantuan FWB Confess Bot*\n\nPilih salah satu topik di bawah ini untuk melihat detailnya.',
    help_menfess: '📝 *Cara Mengirim Menfess*\n\n1. Klik "📣 Kirim Menfess" di menu utama.\n2. Tulis dan kirim confession kamu langsung di chat ini.\n3. Kamu bisa menyertakan hingga 3 tagar (contoh: `#curhat`).',
    help_chat: '💬 *Fitur Chat & Interaksi*\n\n• *Hit Me*: Memulai obrolan anonim dengan pembuat menfess.\n• *Super Hit*: Gunakan koin untuk melewati antrian "Hit Me".\n• *Show Me*: Meminta untuk melihat profil pembuat menfess (butuh persetujuan).\n• *Reveal*: Membuka identitas saat sesi chat berlangsung (butuh persetujuan kedua pihak).',
    help_commands: '🤖 *Daftar Perintah*\n\n• `/start` - Menampilkan menu utama.\n• `/menfess` - Memulai proses pengiriman menfess.\n• `/profile` - Melihat profil, rank, dan statistik.\n• `/leaderboard` - Menampilkan papan peringkat.\n• `/rank` - Melihat dan membeli rank.\n• `/cancel` - Membatalkan proses pengiriman menfess.'
};

// --- Keyboard Bantuan ---
const KEYBOARDS = {
    help_main: Markup.inlineKeyboard([
        [Markup.button.callback('📝 Cara Kirim Menfess', 'help_menfess')],
        [Markup.button.callback('💬 Fitur Chat', 'help_chat')],
        [Markup.button.callback('📜 Aturan', 'help_rules'), Markup.button.callback('🤖 Perintah', 'help_commands')],
        [Markup.button.callback('🔒 Kebijakan Privasi', 'help_privacy')],
        [Markup.button.callback('🏠 Kembali ke Menu', 'back_to_main')]
    ]),
    back_to_help: Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Kembali ke Bantuan', 'btn_help')]
    ])
};

export default function startCommand(bot) {
  const adminSystem = adminPanel(bot, process.env.TARGET_CHANNEL_ID);

  async function membershipMiddleware(ctx, next) {
    const userId = ctx.from.id;
    if (adminSystem.isAdmin(userId)) return next();
    const membershipStatus = await checkMembership(ctx, userId);
    if (!membershipStatus.isChannelMember || !membershipStatus.isGroupMember) {
      return showJoinRequirement(ctx, membershipStatus);
    }
    return next();
  }

  bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const payload = ctx.startPayload;
    if (payload) {
      const referrerId = parseInt(payload.trim(), 10);
      if (!isNaN(referrerId) && referrerId !== userId) {
        ctx.session.referrerId = referrerId;
      }
    }
    if (adminSystem.isAdmin(userId)) {
      return adminSystem.showAdminMenu(ctx);
    }
    const membershipStatus = await checkMembership(ctx, userId);
    if (!membershipStatus.isChannelMember || !membershipStatus.isGroupMember) {
      return showJoinRequirement(ctx, membershipStatus);
    }
    await showMainMenu(ctx);
  });

  // --- Perintah Utama ---
  bot.command('menfess', privateChatOnly('Gunakan perintah /menfess di chat pribadi.'), membershipMiddleware, async (ctx) => {
    await ctx.reply('📣 *Kirim Menfess*...', {
      parse_mode: 'Markdown',
      reply_markup: Markup.inlineKeyboard([[Markup.button.callback('✍️ Tulis Menfess', 'btn_confess')]]).reply_markup
    });
  });

  bot.command('rules', async (ctx) => ctx.reply(LEGAL_TEXTS.rules, { parse_mode: 'Markdown' }));
  bot.command('privacy', async (ctx) => ctx.reply(LEGAL_TEXTS.privacy, { parse_mode: 'Markdown' }));


  // --- Action Handler untuk Menu & Bantuan ---

  bot.action('check_membership', async (ctx) => {
    await ctx.answerCbQuery('Mengecek keanggotaan...');
    const membershipStatus = await checkMembership(ctx, ctx.from.id);
    if (!membershipStatus.isChannelMember || !membershipStatus.isGroupMember) {
      return ctx.editMessageText('❌ Anda masih belum bergabung.', Markup.inlineKeyboard([[Markup.button.callback('🔄 Cek Lagi', 'check_membership')]])).catch(() => {});
    }
    await ctx.editMessageText('✅ Keanggotaan berhasil diverifikasi!').catch(() => {});
    setTimeout(() => showMainMenu(ctx), 1500);
  });

  bot.action('btn_help', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(LEGAL_TEXTS.help_main, {
        parse_mode: 'Markdown',
        reply_markup: KEYBOARDS.help_main.reply_markup
    });
  });

  const helpActions = ['help_menfess', 'help_chat', 'help_rules', 'help_commands', 'help_privacy'];
  helpActions.forEach(action => {
      bot.action(action, async (ctx) => {
          const key = action === 'help_privacy' ? 'privacy' : action.split('_')[1];
          await ctx.answerCbQuery();
          await ctx.editMessageText(LEGAL_TEXTS[key], {
              parse_mode: 'Markdown',
              reply_markup: KEYBOARDS.back_to_help.reply_markup
          });
      });
  });

  bot.action('back_to_main', async (ctx) => {
    await ctx.answerCbQuery();
    // Hapus pesan sebelumnya untuk kebersihan
    try { await ctx.deleteMessage(); } catch(e) {}
    await showMainMenu(ctx);
  });

  return {
    membershipMiddleware,
    checkMembership,
    showJoinRequirement,
    showMainMenu,
    adminSystem
  };
}
