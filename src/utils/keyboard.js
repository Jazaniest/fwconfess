import { Markup } from 'telegraf';

/**
 * Utility: keyboard.js
 *
 * Semua preset keyboard yang dipakai berulang di banyak handler.
 * Setiap fungsi mengembalikan object Markup.inlineKeyboard siap pakai.
 */

// ─── Navigation ───────────────────────────────────────────────────────────────

/**
 * Tombol tunggal "Kembali ke Menu Utama".
 * @returns {Object} Markup.inlineKeyboard
 */
export function createBackToStartKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🏠 Kembali ke Menu', 'btn_back_to_start')]
  ]);
}

/**
 * Tombol tunggal "Menu Utama" (callback: back_to_main).
 * Dipakai di start.js dan handler lain yang menggunakan back_to_main.
 * @returns {Object} Markup.inlineKeyboard
 */
export function createBackToMainKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🏠 Menu Utama', 'back_to_main')]
  ]);
}

// ─── Registration ─────────────────────────────────────────────────────────────

/**
 * Tombol "Daftar Sekarang" + opsional "Kembali ke Menu".
 * @param {boolean} withBack - sertakan tombol kembali (default: true)
 * @returns {Object} Markup.inlineKeyboard
 */
export function createRegisterKeyboard(withBack = true) {
  const rows = [
    [Markup.button.callback('📝 Daftar Sekarang', 'btn_register')]
  ];
  if (withBack) {
    rows.push([Markup.button.callback('🏠 Kembali ke Menu', 'btn_back_to_start')]);
  }
  return Markup.inlineKeyboard(rows);
}

/**
 * Keyboard pilihan gender untuk flow registrasi.
 * @returns {Object} Markup.inlineKeyboard
 */
export function createGenderKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Laki-laki', 'gender_male')],
    [Markup.button.callback('Perempuan', 'gender_female')],
    [Markup.button.callback('Lainnya',   'gender_other')],
  ]);
}

// ─── Chat Actions ─────────────────────────────────────────────────────────────

/**
 * Tombol "End Chat" tunggal.
 * @returns {Object} Markup.inlineKeyboard
 */
export function createEndChatKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('❌ End Chat', 'end_chat')]
  ]);
}

/**
 * Keyboard untuk user yang sudah memiliki session aktif saat mencoba hit confession baru.
 * @returns {Object} Markup.inlineKeyboard
 */
export function createActiveSessionKeyboard(userId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('💬 Lanjut Chat',     'continue_chat')],
    [Markup.button.callback('❌ End Chat',         'end_chat')],
    [Markup.button.callback('🔧 Force Cleanup',   `force_cleanup_${userId}`)]
  ]);
}

// ─── Report ───────────────────────────────────────────────────────────────────

/**
 * Keyboard untuk flow report confession.
 * @param {Array<{label: string, value: string}>} reasons - daftar alasan
 * @returns {Object} raw reply_markup (inline_keyboard array), bukan Markup object,
 *                   karena report.js membutuhkan format ini untuk sendMessage manual.
 */
export function createReportReasonsKeyboard(reasons) {
  const rows = reasons.map(r => ([
    Markup.button.callback(r.label, `report_reason_${r.value}`)
  ]));
  rows.push([Markup.button.callback('❌ Batal', 'report_cancel')]);
  return { inline_keyboard: rows };
}

// ─── Reveal ───────────────────────────────────────────────────────────────────

/**
 * Keyboard accept/decline untuk permintaan reveal identitas.
 * @param {number} sessionId
 * @returns {Object} Markup.inlineKeyboard
 */
export function createRevealRequestKeyboard(sessionId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Setuju Reveal', `reveal_accept_${sessionId}`),
      Markup.button.callback('❌ Tolak',          `reveal_decline_${sessionId}`)
    ]
  ]);
}