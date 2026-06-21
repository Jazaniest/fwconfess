import { Telegraf, session } from 'telegraf';
import dotenv from 'dotenv';
import startCommand from './commands/start.js';
import registerCommand from './commands/register.js';
import confessCommand from './commands/confess.js';
import profileCommand from './commands/profile.js';
import hitMeCommand from './commands/hitme.js';
import dagetCommand from './handlers/daget.js';
import donasiCommand from './handlers/donasi/donasi.js';
import createBanMiddleware from './middleware/ban.js';

dotenv.config();

export async function startBot() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.error('Error: BOT_TOKEN tidak ditemukan di environment variables.');
    process.exit(1);
  }

  const bot = new Telegraf(token);
  bot.use(session({ defaultSession: () => ({}) }));

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
  bot.use(createBanMiddleware());

  // Daftar semua command
  startCommand(bot);
  const register = registerCommand(bot);
  const confess = confessCommand(bot, process.env.TARGET_CHANNEL_ID);
  const { handleProfileText: handleOriginText } = profileCommand(bot);
  const hitMe = hitMeCommand(bot);
  await hitMe.chatManager.syncSessionsWithDatabase();
  const daget = dagetCommand(bot, process.env.TARGET_CHANNEL_ID);
  const donasi = donasiCommand(bot, process.env.TRAKTEER_URL);
  bot.on('text', handleOriginText);

  bot.on('text', async (ctx, next) => {
    // 1. Proses registrasi
    if (ctx.session?.registration?.gender && !ctx.session?.registration?.done) {
      if (register.handleRegisterText) return register.handleRegisterText(ctx, next);
    }

    // 2. Proses confession
    if (confess.isUserPending && confess.isUserPending(ctx.from.id)) {
      if (confess.handleConfessText) return confess.handleConfessText(ctx, next);
    }

    // 3. Proses daget session
    if (daget.isUserInDagetSession(ctx)) {
      const handled = await daget.handleDagetText(ctx);
      if (handled) return;
    }

    // 4. Proses anonymous chat
    if (hitMe.chatManager && hitMe.chatManager.isUserInChat(ctx.from.id)) {
      if (ctx.chat.type !== 'private') return next();
      return hitMe.chatManager.sendAnonymousMessage(ctx, ctx.from.id, ctx.message.text);
    }

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
    },
    {
      command: 'daget',
      description: 'Lihat & buat daget'
    },
    {
      command: 'donasi',
      description: 'Support bot dengan donasi'
    }
  ]);

  await bot.telegram.setChatMenuButton({
    menu_button: {
      type: 'commands'
    }
  });

  // Jalankan polling
  bot.launch().then(() => {
    console.log('✅ bot.launch() resolved (tidak normal, tapi OK)');
  }).catch(err => {
    console.error('❌ bot.launch() error:', err);
    process.exit(1);
  });

  console.log('🤖 Bot menfess sudah berjalan (polling)');

  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  return bot;
}
