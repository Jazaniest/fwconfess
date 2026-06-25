import { configService } from '../services/config.service.js';
import { isAdmin } from './admin-auth.js';

/**
 * Middleware untuk mengaktifkan mode pemeliharaan.
 */
export function maintenanceMode() {
  return (ctx, next) => {
    const isMaintenance = configService.isMaintenanceMode();
    const userIsAdmin = isAdmin(ctx.from?.id);

    if (isMaintenance && !userIsAdmin) {
      const message = configService.get('maintenance_mode_message', 'Bot sedang dalam perbaikan.');

      if (ctx.callbackQuery) {
        ctx.answerCbQuery(message, { show_alert: true });
      } else {
        ctx.reply(message);
      }
      // Hentikan pemrosesan lebih lanjut
      return;
    }

    // Lanjutkan jika tidak dalam mode pemeliharaan atau jika pengguna adalah admin
    return next();
  };
}
