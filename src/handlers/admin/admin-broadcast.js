/**
 * Admin broadcast handler — business logic untuk broadcast.
 */
export async function handleAdminBroadcast(ctx) {
  await ctx.editMessageText(
    '📢 *Broadcast Message*\n\nPilih jenis broadcast yang ingin dikirim:\n\n⚠️ *Perhatian:* Gunakan fitur ini dengan bijak!',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📢 Broadcast Umum', callback_data: 'admin_broadcast_all' },
            { text: '👥 Broadcast Target', callback_data: 'admin_broadcast_target' }
          ],
          [
            { text: '📊 Preview Audience', callback_data: 'admin_broadcast_preview' },
            { text: '📝 Draft Message', callback_data: 'admin_broadcast_draft' }
          ],
          [{ text: '🏠 Kembali', callback_data: 'back_to_admin' }]
        ]
      }
    }
  );
}
