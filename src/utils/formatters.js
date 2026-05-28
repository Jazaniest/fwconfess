/**
 * Utility: formatters.js
 *
 * Semua helper untuk emoji, format pesan, dan string transformation.
 * Dikumpulkan dari confess.js, profile.js, dan showme.js agar tidak ada duplikasi.
 */

// ─── Emoji Helpers ────────────────────────────────────────────────────────────

/**
 * Kembalikan emoji yang sesuai dengan gender user.
 * @param {string|null} gender
 * @returns {string}
 */
export function getGenderEmoji(gender) {
  const map = {
    'male'      : '👨',
    'female'    : '👩',
    'laki-laki' : '👨',
    'perempuan' : '👩',
    'pria'      : '👨',
    'wanita'    : '👩',
    'l'         : '👨',
    'p'         : '👩',
  };
  return map[gender?.toLowerCase()] || '👤';
}

/**
 * Kembalikan emoji yang sesuai dengan rank user.
 * Gabungan dari semua versi yang ada di confess.js, profile.js, dan showme.js.
 * @param {string|null} rank
 * @returns {string}
 */
export function getRankEmoji(rank) {
  const map = {
    'admin'     : '👑',
    'moderator' : '🛡️',
    'vip'       : '⭐',
    'premium'   : '💎',
    'member'    : '👤',
    'newbie'    : '🌱',
    'bronze'    : '🥉',
    'silver'    : '🥈',
    'gold'      : '🥇',
    'platinum'  : '💠',
    'diamond'   : '💎',
    'ascendant' : '🪽',
    'mythos'    : '🌌',
  };
  return map[rank?.toLowerCase()] || '👤';
}

// ─── String Helpers ───────────────────────────────────────────────────────────

/**
 * Escape semua karakter reserved MarkdownV2 Telegram.
 * Dipakai di showme.js dan mana saja yang kirim parse_mode: 'MarkdownV2'.
 * @param {string} text
 * @returns {string}
 */
export function escapeMarkdownV2(text) {
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

// ─── Message Formatters ───────────────────────────────────────────────────────

/**
 * Format pesan confession untuk dikirim ke channel.
 * Diambil dari confess.js.
 * @param {string} text  - isi confession dari user
 * @param {Object} user  - baris user dari DB (gender, rank, origin)
 * @returns {string}
 */
export function formatConfessionMessage(text, user) {
  const genderEmoji = getGenderEmoji(user.gender);
  const rankEmoji   = getRankEmoji(user.rank);
  const safeGender  = user.gender  || 'Unknown';
  const safeRank    = user.rank    || 'member';
  const safeOrigin  = user.origin  || 'Unknown';

  return (
    `💭 *ANONYMOUS CONFESSION*\n\n` +
    `${text}\n\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `${genderEmoji} Gender: *${safeGender}*\n` +
    `${rankEmoji} Rank: *${safeRank}*\n` +
    `📍 Origin: *${safeOrigin}*`
  );
}

/**
 * Format data profile user untuk ditampilkan di chat.
 * Diambil dari profile.js.
 * @param {Object} user          - baris user dari DB
 * @param {Object} telegramUser  - ctx.from (first_name, last_name, username)
 * @returns {string}
 */
export function formatProfileMessage(user, telegramUser) {
  const rankEmoji   = getRankEmoji(user.rank);
  const genderEmoji = getGenderEmoji(user.gender);

  const fullName = telegramUser.first_name +
    (telegramUser.last_name ? ' ' + telegramUser.last_name : '');

  const usernameLine = telegramUser.username
    ? `📧 *Username:* @${telegramUser.username}\n`
    : '';

  const viewedAt = new Date().toLocaleDateString('id-ID', {
    weekday : 'long',
    year    : 'numeric',
    month   : 'long',
    day     : 'numeric',
    hour    : '2-digit',
    minute  : '2-digit',
  });

  return (
    `👤 *PROFILE USER*\n\n` +
    `🆔 *Telegram ID:* \`${user.telegram_id}\`\n` +
    `👤 *Nama:* ${fullName}\n` +
    `${usernameLine}` +
    `${rankEmoji} *Rank:* ${user.rank || 'member'}\n` +
    `${genderEmoji} *Gender:* ${user.gender || 'Tidak diset'}\n` +
    `🌍 *Asal:* ${user.origin || 'Tidak diset'}\n\n` +
    `📅 *Profile dilihat:* ${viewedAt}`
  );
}