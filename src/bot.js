// src/bot.js
import { Telegraf, session } from 'telegraf';
import dotenv from 'dotenv';
import startCommand from './commands/start.js';
import registerCommand from './commands/register.js';
import confessCommand from './commands/confess.js';
import profileCommand from './commands/profile.js';
import hitMeCommand from './commands/hitme.js';

dotenv.config();

export async function startBot() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.error('Error: BOT_TOKEN tidak ditemukan di environment variables.');
    process.exit(1);
  }

  const bot = new Telegraf(token);
  bot.use(session());

  bot.use((ctx, next) => {
    if (ctx.message && ctx.message.text) {
      console.log('📝 [GLOBAL TEXT]', ctx.from.id, '->', ctx.message.text);
    }
    return next();
  });

  
  // Daftar semua command
  startCommand(bot);
  const register = registerCommand(bot);
  const confess = confessCommand(bot, process.env.TARGET_CHANNEL_ID);
  profileCommand(bot);
  const hitMe = hitMeCommand(bot);
  
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
      return hitMe.chatManager.sendAnonymousMessage(ctx, ctx.from.id, ctx.message.text);
    }
    // 4. Default
    return next();
  });

  // Jalankan polling
  await bot.launch();
  console.log('🤖 Bot menfess sudah berjalan (polling)');

  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
