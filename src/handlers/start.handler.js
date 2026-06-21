/**
 * Start handler — business logic untuk main menu dan navigasi.
 * Dipanggil dari commands/start.js (registrasi handler ke bot).
 */
import { Markup } from 'telegraf';
import { Database } from '../commands/database.js';

/**
 * Tampilkan menu utama untuk user biasa.
 */
export async function showMainMenu(ctx) {
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
