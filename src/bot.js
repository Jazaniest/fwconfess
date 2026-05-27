import { Telegraf, session } from 'telegraf';
import dotenv from 'dotenv';
import startCommand from './commands/start.js';
import registerCommand from './commands/register.js';
import confessCommand from './commands/confess.js';
import profileCommand from './commands/profile.js';
import hitMeCommand from './commands/hitme.js';
import { Database } from './commands/database.js';

dotenv.config();

export async function startBot() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.error('Error: BOT_TOKEN tidak ditemukan di environment variables.');
    process.exit(1);
  }

  const bot = new Telegraf(token);
  bot.use(session());

  bot.catch((err, ctx) => {
    console.error(`❌ Bot error for update ${ctx.update?.update_id}:`, err.message);
  });

  bot.use((ctx, next) => {
    if (ctx.message && ctx.message.text) {
      console.log('📝 [GLOBAL TEXT]', ctx.from.id, '->', ctx.message.text);
    }
    return next();
  });

  // ─── Ban middleware global ────────────────────────────────────────────────────
  const ADMIN_ID = process.env.ADMIN_ID;
  const DISCUSSION_GROUP_ID = process.env.DISCUSSION_GROUP_ID;

  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return next();

    // Admin tidak pernah kena ban check
    if (ADMIN_ID && userId.toString() === ADMIN_ID.toString()) return next();

    // Hanya berlaku untuk pesan di private chat dan discussion group
    const chatId   = ctx.chat?.id?.toString();
    const chatType = ctx.chat?.type;

    const isPrivate         = chatType === 'private';
    const isDiscussionGroup = DISCUSSION_GROUP_ID && chatId === DISCUSSION_GROUP_ID.toString();

    if (!isPrivate && !isDiscussionGroup) return next();

    try {
      const activeBan = await Database.getActiveBan(userId);
      if (!activeBan) return next();

      // User kena ban — susun pesan notifikasi
      const isPermanent = activeBan.ban_type === 'permanent';
      const expText = isPermanent
        ? 'permanen'
        : `sampai ${new Date(activeBan.expires_at).toLocaleString('id-ID')}`;

      const banMsg =
        `🚫 *Akses Ditolak*\n\n` +
        `Kamu telah di-ban dari bot ini.\n\n` +
        `⛔ Tipe: *${activeBan.ban_type}*\n` +
        `⏱️ Durasi: ${expText}\n` +
        `📝 Alasan: ${activeBan.reason || '-'}\n\n` +
        `_Jika kamu merasa ini kesalahan, hubungi admin._`;

      // Untuk callback query, jawab dulu agar tombol tidak loading terus
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery('🚫 Kamu di-ban dari bot ini.').catch(() => {});
      }

      // Kirim pesan ban hanya jika private (jangan spam di grup)
      if (isPrivate) {
        await ctx.reply(banMsg, { parse_mode: 'Markdown' }).catch(() => {});
      }

      // Jika di discussion group, hapus pesannya diam-diam
      // if (isDiscussionGroup && ctx.message?.message_id) {
      //   await ctx.telegram.deleteMessage(chatId, ctx.message.message_id).catch(() => {});
      // }

      return; // Stop, jangan lanjut ke handler berikutnya
    } catch (err) {
      console.error('❌ Ban middleware error:', err);
      return next(); // Kalau error, fail open (jangan block semua user)
    }
  });

  
  // Daftar semua command
  startCommand(bot);
  const register = registerCommand(bot);
  const confess = confessCommand(bot, process.env.TARGET_CHANNEL_ID);
  profileCommand(bot);
  const hitMe = hitMeCommand(bot);
  await hitMe.chatManager.syncSessionsWithDatabase();
  
  bot.on('text', async (ctx, next) => {
    // 1. Proses registrasi
    if (ctx.session?.registration?.gender && !ctx.session?.registration?.done) {
      if (register.handleRegisterText) return register.handleRegisterText(ctx, next);
    }
    // 2. Proses confession
    if (confess.isUserPending && confess.isUserPending(ctx.from.id)) {
      if (confess.handleConfessText) return confess.handleConfessText(ctx, next);
    }
    // 3. Proses anonymous chat
    if (hitMe.chatManager && hitMe.chatManager.isUserInChat(ctx.from.id)) {
      if (ctx.chat.type !== 'private') return next();
      return hitMe.chatManager.sendAnonymousMessage(ctx, ctx.from.id, ctx.message.text);
    }
    // 4. Default
    return next();
  });

  await bot.telegram.setMyCommands([
    {
      command: 'start',
      description: 'Mulai bot'
    },
    {
      command: 'menfess',
      description: 'Kirim menfess'
    },
    {
      command: 'profile',
      description: 'Lihat profil'
    }
  ]);

  await bot.telegram.setChatMenuButton({
    menu_button: {
      type: 'commands'
    }
  });

  // Jalankan polling
  await bot.launch();
  console.log('🤖 Bot menfess sudah berjalan (polling)');

  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
