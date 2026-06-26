/**
 * Utility formatter functions — shared across all modules.
 * Phase 1 extraction: single source of truth untuk fungsi format/emoji/helper.
 */

// ─── ALL_RANKS (dari daget.js) ──────────────────────────────────────────────

export const ALL_RANKS = [
  'ascendant', 'bronze', 'diamond', 'gold',
  'member', 'mythos', 'platinum', 'silver',
];

// ─── Confession formatters (dari confess.js) ────────────────────────────────

/**
 * Format pesan confession untuk dikirim ke channel.
 */
export function formatConfessionMessage(text, user) {
  const genderEmoji = getGenderEmoji(user.gender);
  const rankEmoji = getRankEmoji(user.rank);

  const displayUsername = user.hide_username || !user.username
    ? '*xxxxx*'
    : `@${escMd(user.username)}`;

  const displayGender = user.hide_gender
    ? '*xxxxx*'
    : `*${user.gender || 'Unknown'}*`;

  const displayOrigin = user.hide_origin
    ? '*xxxxx*'
    : `*${user.origin || 'Unknown'}*`;

  const safeRank = user.rank || 'member';

  return `💭 *ANONYMOUS CONFESSION*\n\n` +
    `${escMd(text)}\n\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `👤 By: ${displayUsername}\n` +
    `${genderEmoji} Gender: ${displayGender}\n` +
    `${rankEmoji} Rank: *${safeRank}*\n` +
    `📍 Origin: ${displayOrigin}`;
}

/**
 * Dapatkan emoji berdasarkan gender.
 */
export function getGenderEmoji(gender) {
  const genderEmojis = {
    'male': '👨', 'female': '👩',
    'laki-laki': '👨', 'perempuan': '👩',
    'pria': '👨', 'wanita': '👩',
    'l': '👨', 'p': '👩'
  };
  return genderEmojis[gender?.toLowerCase()] || '👤';
}

/**
 * Dapatkan emoji berdasarkan rank.
 */
export function getRankEmoji(rank) {
  const rankEmojis = {
    'admin': '👑',
    'moderator': '🛡️',
    'vip': '⭐',
    'premium': '💎',
    'member': '👤',
    'newbie': '🌱',
    'bronze': '🥉',
    'silver': '🥈',
    'gold': '🥇',
    'platinum': '💠',
    'diamond': '💎',
    'ascendant': '🪽',
    'mythos': '🌌'
  };
  return rankEmojis[rank?.toLowerCase()] || '👤';
}

/**
 * Render template string dengan placeholder {key}.
 */
export function renderMsg(template, vars = {}) {
  return Object.entries(vars).reduce(
    (str, [k, v]) => str.replaceAll(`{${k}}`, v),
    template
  );
}

// ─── Rupiah formatter (dari donasi.js / routes/donation.js) ─────────────────

/** Format angka ke Rupiah */
export function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0
  }).format(amount);
}

// ─── Date formatters (dari daget.js) ────────────────────────────────────────

/** Format Date ke string lokal Indonesia + WIB */
export function formatDate(date) {
  return new Date(date).toLocaleString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }) + ' WIB';
}

/** Format Date ke string YYYY-MM-DD HH:MM:SS untuk MySQL */
export function formatMySqlDateTime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

// ─── Markdown helpers (dari daget.js) ───────────────────────────────────────

/** Escape karakter Markdown Telegram v2 (kurang agresif) */
export function escMd(text) {
  if (!text) return '';
  return String(text)
    .replace(/([_*\[\]()~`>#+=|{}.!-])/g, '\\$1');
}

/** Label rank untuk ditampilkan */
export function ranksLabel(ranks) {
  return ranks.length === ALL_RANKS.length ? 'Semua rank' : ranks.join(', ');
}
