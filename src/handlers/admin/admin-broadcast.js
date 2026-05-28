/**
 * Setup handler broadcast message
 * @param {Telegraf} bot
 * @param {Function} adminMiddleware
 */
export function setupAdminBroadcast(bot, adminMiddleware) {

  bot.action('admin_broadcast', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      '📢 *Broadcast Message*\n\n' +
      'Pilih jenis broadcast yang ingin dikirim:\n\n' +
      '⚠️ *Perhatian:* Gunakan fitur ini dengan bijak!',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📢 Broadcast Umum',    callback_data: 'admin_broadcast_all'     },
              { text: '👥 Broadcast Target',  callback_data: 'admin_broadcast_target'  }
            ],
            [
              { text: '📊 Preview Audience', callback_data: 'admin_broadcast_preview' },
              { text: '📝 Draft Message',     callback_data: 'admin_broadcast_draft'   }
            ],
            [{ text: '🏠 Kembali', callback_data: 'back_to_admin' }]
          ]
        }
      }
    );
  });

  // Placeholder handlers — fitur belum diimplementasikan
  bot.action('admin_broadcast_all', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      '📢 *Broadcast Umum*\n\n_Fitur ini sedang dalam pengembangan._',
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'admin_broadcast' }]] }
      }
    );
  });

  bot.action('admin_broadcast_target', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      '👥 *Broadcast Target*\n\n_Fitur ini sedang dalam pengembangan._',
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'admin_broadcast' }]] }
      }
    );
  });

  bot.action('admin_broadcast_preview', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      '📊 *Preview Audience*\n\n_Fitur ini sedang dalam pengembangan._',
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'admin_broadcast' }]] }
      }
    );
  });

  bot.action('admin_broadcast_draft', adminMiddleware, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      '📝 *Draft Message*\n\n_Fitur ini sedang dalam pengembangan._',
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'admin_broadcast' }]] }
      }
    );
  });
}