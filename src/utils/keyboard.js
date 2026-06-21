/**
 * Keyboard / Markup helper functions — shared across all modules.
 * Phase 1 extraction.
 */
import { Markup } from 'telegraf';

// ─── Single buttons ─────────────────────────────────────────────────────────

/** Tombol "🏠 Menu Utama" → callback back_to_main */
export function mainMenuBtn() {
  return Markup.button.callback('🏠 Menu Utama', 'back_to_main');
}

/** Tombol "👑 Admin Panel" → callback back_to_admin */
export function adminPanelBtn() {
  return Markup.button.callback('👑 Admin Panel', 'back_to_admin');
}

/** Tombol URL */
export function urlBtn(label, url) {
  return Markup.button.url(label, url);
}

/** Tombol callback */
export function cbBtn(label, data) {
  return Markup.button.callback(label, data);
}

// ─── Button groups ──────────────────────────────────────────────────────────

/** Tombol navigasi ke channel dan grup */
export function channelGroupButtons() {
  return [
    urlBtn('📣 Ke Channel', 'https://t.me/fwb_confess'),
    urlBtn('💬 Ke Grup', 'https://t.me/fwb_confesschat'),
  ];
}

/** Tombol hubungi admin */
export function contactAdminBtn() {
  return urlBtn('📞 Kontak Admin', 'https://t.me/jzxty');
}

// ─── Complete keyboards ─────────────────────────────────────────────────────

/** Keyboard: satu baris tombol "Kembali ke Menu Utama" */
export function backToMainKeyboard() {
  return Markup.inlineKeyboard([
    [mainMenuBtn()]
  ]);
}

/** Keyboard: navigasi + kembali */
export function navWithBackKeyboard(backData = 'back_to_main') {
  return Markup.inlineKeyboard([
    channelGroupButtons(),
    [cbBtn('🔙 Kembali', backData)]
  ]);
}
