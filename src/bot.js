import { Telegraf, session }      from 'telegraf';
import dotenv                     from 'dotenv';
import { createBanMiddleware }    from './middleware/ban.js';
import startCommand               from './commands/start.js';
import registerCommand            from './commands/register.js';
import confessCommand             from './commands/confess.js';
import profileCommand             from './commands/profile.js';
import hitMeCommand               from './commands/hitme.js';
import adminPanel                 from './commands/admin.js';

dotenv.config();

export async function startBot() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.error('Error: BOT_TOKEN tidak ditemukan di environment variables.');
    process.exit(1);
  }

  const bot = new Telegraf(token);
  bot.use(session());

  // ─── Error handler global ───────────────────────────────────────────────────

  bot.catch((err, ctx) => {
    console.error(`❌ Bot error for update ${ctx.update?.update_id}:`, err.message);
  });

  // ─── Logger global (dev) ────────────────────────────────────────────────────

  bot.use((ctx, next) => {
    if (ctx.message?.text) {
      console.log('📝 [GLOBAL TEXT]', ctx.from.id, '->', ctx.message.text);
    }
    return next();
  });

  // ─── Middleware: ban check ──────────────────────────────────────────────────

  bot.use(createBanMiddleware());

  // ─── Daftar command ─────────────────────────────────────────────────────────

  startCommand(bot);
  const register = registerCommand(bot);
  const confess  = confessCommand(bot, process.env.TARGET_CHANNEL_ID);
  profileCommand(bot);
  const hitMe    = hitMeCommand(bot);
  const admin    = adminPanel(bot, process.env.TARGET_CHANNEL_ID);

  // Sync active chat sessions dari DB saat startup
  await hitMe.chatManager.syncSessionsWithDatabase();

  // ─── Text router ───────────────────────────────────────────────────────────
  //
  // Urutan prioritas:
  //   1. Admin input (multi-step: ban, settings, search)
  //   2. Registrasi
  //   3. Confession pending
  //   4. Anonymous chat
  //   5. Default (tidak diproses)

  bot.on('text', async (ctx, next) => {
    // 1. Admin input
    if (await admin.handleAdminText(ctx)) return;

    // 2. Registrasi
    if (ctx.session?.registration?.gender && !ctx.session?.registration?.done) {
      return register.handleRegisterText(ctx, next);
    }

    // 3. Confession pending
    if (confess.isUserPending?.(ctx.from.id)) {
      return confess.handleConfessText(ctx, next);
    }

    // 4. Anonymous chat (private only)
    if (hitMe.chatManager?.isUserInChat(ctx.from.id)) {
      if (ctx.chat.type !== 'private') return next();
      return hitMe.chatManager.sendAnonymousMessage(ctx, ctx.from.id, ctx.message.text);
    }

    // 5. Default
    return next();
  });

  // ─── Set bot commands di menu Telegram ─────────────────────────────────────

  await bot.telegram.setMyCommands([
    { command: 'start',   description: 'Mulai bot'      },
    { command: 'menfess', description: 'Kirim menfess'  },
    { command: 'profile', description: 'Lihat profil'   },
  ]);

  await bot.telegram.setChatMenuButton({
    menu_button: { type: 'commands' },
  });

  // ─── Launch ─────────────────────────────────────────────────────────────────

  await bot.launch();
  console.log('🤖 Bot menfess sudah berjalan (polling)');

  process.once('SIGINT',  () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}