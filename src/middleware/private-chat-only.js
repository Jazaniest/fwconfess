import { Markup } from 'telegraf';

/**
 * Middleware untuk memastikan sebuah perintah atau action hanya bisa dijalankan di chat pribadi.
 * @param {string} [customMessage] - Pesan kustom untuk ditampilkan jika bukan di private chat.
 */
export function privateChatOnly(customMessage) {
  return (ctx, next) => {
    if (ctx.chat?.type === 'private') {
      return next();
    }

    const defaultMessage = 'ℹ️ Perintah ini hanya bisa digunakan di chat pribadi dengan bot.';
    const message = customMessage || defaultMessage;

    // Untuk callback query (tombol inline)
    if (ctx.callbackQuery) {
      return ctx.answerCbQuery(message, { show_alert: true });
    }

    // Untuk perintah teks
    return ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [[Markup.button.url('Mulai Chat Pribadi', `https://t.me/${ctx.botInfo.username}?start=help`)]]
      }
    });
  };
}
