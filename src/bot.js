import { Telegraf, session } from 'telegraf';
import dotenv from 'dotenv';
import { configService } from './services/config.service.js';
import startCommand from './commands/start.js';
import registerCommand from './commands/register.js';
import confessCommand from './commands/confess.js';
import profileCommand from './commands/profile.js';
import hitMeCommand from './commands/hitme.js';
import dagetCommand from './handlers/daget.js';
import donasiCommand from './handlers/donasi/donasi.js';
import { maintenanceMode } from './middleware/maintenance.js';
import createBanMiddleware from './middleware/ban.js';
import { badgeEnforcer } from './middleware/badge-enforcer.js';
import leaderboardCommand from './commands/leaderboard.js';
import schedule from 'node-schedule';
import { runWeeklyReset } from './jobs/weekly-reset.js';
import { handleExpiredSubscriptions } from './jobs/subscription-cleanup.js';
import searchCommand from './commands/search.js';
import economyCommand from './commands/economy.js';
import rankCommand from './commands/rank.js';
import watchAdCommand from './commands/watchAd.js';
import { ChatManager } from './handlers/chat/chat-manager.js';
import { RequestManager } from './handlers/chat/request-manager.js';


dotenv.config();

export async function startBot() {
  await configService.init();
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.error('Error: BOT_TOKEN tidak ditemukan di environment variables.');
    process.exit(1);
  }

  const bot = new Telegraf(token);
  bot.use(session({ defaultSession: () => ({}) }));
  bot.use(maintenanceMode());
  bot.use(createBanMiddleware());
  bot.use(badgeEnforcer());

  bot.catch((err, ctx) => {
    console.error(`❌ Bot error for update ${ctx.update?.update_id}:`, err.message);
  });

  // Registrasi semua command dan handler
  const hitMe = hitMeCommand(bot);
  const { chatManager } = hitMe;
  startCommand(bot);
  const register = registerCommand(bot);
  const confess = confessCommand(bot, process.env.TARGET_CHANNEL_ID, chatManager);
  const { handleProfileText: handleOriginText } = profileCommand(bot);
  const daget = dagetCommand(bot, process.env.TARGET_CHANNEL_ID, process.env.DISCUSSION_GROUP_ID);
  donasiCommand(bot, process.env.TRAKTEER_URL);
  leaderboardCommand(bot);
  searchCommand(bot);
  economyCommand(bot);
  rankCommand(bot);
  watchAdCommand(bot);
  bot.on('text', handleOriginText);

  // Handler teks global untuk alur percakapan
  bot.on('text', async (ctx, next) => {
    if (await chatManager.isUserInChat(ctx.from.id)) {
        return chatManager.sendAnonymousMessage(ctx, ctx.from.id, ctx.message.text);
    }
    if (ctx.session?.registration?.gender && !ctx.session?.registration?.done) {
      return register.handleRegisterText(ctx, next);
    }

    // 2. Proses confession
    if (confess.isUserPending && confess.isUserPending(ctx.from.id)) {
      return confess.handleConfessText(ctx, next);
    }

    // 3. Proses daget session
    if (daget.isUserInDagetSession(ctx)) {
      const handled = await daget.handleDagetText(ctx);
      if (handled) return;
    }
    const originHandled = await handleOriginText(ctx, () => {});
    if (originHandled) return;

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
      command: 'leaderboard',
      description: 'Lihat Papan Peringkat Mingguan'
    },
    {
      command: 'rank',
      description: 'Pusat Peningkatan Rank'
    },
    {
      command: 'donasi',
      description: 'Support bot dengan donasi'
    },
    {
      command: 'tontoniklan',
      description: 'Dapatkan menfess gratis'
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

  // Jadwalkan reset mingguan
  schedule.scheduleJob('1 0 * * 1', () => {
    console.log('⏰ Menjalankan job reset mingguan...');
    runWeeklyReset(bot, process.env.DISCUSSION_GROUP_ID);
  });
  console.log('🗓️ Job reset mingguan telah dijadwalkan setiap Senin pukul 00:01.');

  // Jadwalkan pembersihan langganan yang kedaluwarsa
  schedule.scheduleJob('0 1 * * *', () => {
    console.log('⏰ Menjalankan job pembersihan langganan...');
    handleExpiredSubscriptions(bot);
  });
  console.log('🗓️ Job pembersihan langganan telah dijadwalkan setiap hari pukul 01:00.');

  // [BARU] Jadwalkan pembersihan sesi chat dan request
  schedule.scheduleJob('*/5 * * * *', async () => {
      console.log('⏰ Menjalankan job pembersihan sesi chat dan request...');
      try {
        await ChatManager.cleanupInactiveSessions();
        await RequestManager.cleanupExpiredRequests();
      } catch(e) {
        console.error("Gagal menjalankan cleanup job:", e);
      }
  });
  console.log('🗓️ Job pembersihan sesi & request telah dijadwalkan setiap 5 menit.');


  console.log('🤖 Bot menfess sudah berjalan (polling)');

  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  return bot;
}
