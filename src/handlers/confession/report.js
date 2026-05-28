import { Markup } from 'telegraf';
import {
  getUserById,
} from '../../repositories/user.repo.js';
import {
  getConfessionByChannelMessageId,
  hasUserReported as dbHasUserReported,
  saveReport as dbSaveReport,
} from '../../repositories/report.repo.js';

/**
 * Dipindah dari: src/commands/report.js
 * Perubahan: import Database diganti dengan named imports dari repositories.
 * Import dari report.repo karena domain-nya di sana (hasUserReported, saveReport).
 */

// Note: report.repo.js mengekspor hasUserReported(reporterId, confessionId)
// dan saveReport(reporterId, targetMessageId, reason) — kita pakai keduanya.
// getConfessionByChannelMessageId ada di confession.repo, tapi kita import
// dari sana secara langsung agar tidak memerlukan Database shim.

import {
  getConfessionByChannelMessageId as getConfessionByChanMsgId,
} from '../../repositories/confession.repo.js';
import {
  hasUserReported,
  saveReport,
} from '../../repositories/report.repo.js';

const REPORT_REASONS = [
  { label: '🚫 Spam',               value: 'spam' },
  { label: '☠️ SARA / Hate Speech', value: 'sara' },
  { label: '🔞 Konten Tidak Pantas', value: 'inappropriate' },
  { label: '🎭 Identitas Palsu',     value: 'fake_identity' },
  { label: '⚠️ Lainnya',             value: 'other' },
];

/**
 * @param {import('telegraf').Telegraf} bot
 * @param {string|number} targetChannelId
 */
export default function reportHandler(bot, targetChannelId) {
  // userId → { channelMessageId, confessionId }
  const pendingReport = new Map();

  /**
   * Buat objek tombol Report untuk ditempel di pesan channel.
   * @param {number} channelMessageId
   * @returns {{ text: string, callback_data: string }}
   */
  function createReportButton(channelMessageId) {
    return {
      text         : '🚩 Report',
      callback_data: `report_start_${channelMessageId}`,
    };
  }

  // ── Langkah 1: User klik tombol Report ──────────────────────────────────────
  bot.action(/^report_start_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const channelMessageId = parseInt(ctx.match[1]);
    const userId           = ctx.from.id;

    const user = await getUserById(userId);
    if (!user) {
      return ctx.answerCbQuery(
        '❌ Kamu belum terdaftar!\n\nDaftar terlebih dahulu untuk bisa melaporkan confession.',
        { show_alert: true }
      );
    }

    const confession = await getConfessionByChanMsgId(channelMessageId);
    if (!confession) {
      return ctx.answerCbQuery('❌ Confession tidak ditemukan.', { show_alert: true });
    }

    if (confession.telegram_id === userId) {
      return ctx.answerCbQuery(
        '❌ Kamu tidak bisa melaporkan confession milik sendiri.',
        { show_alert: true }
      );
    }

    const alreadyReported = await hasUserReported(userId, confession.id);
    if (alreadyReported) {
      return ctx.answerCbQuery(
        '⚠️ Kamu sudah pernah melaporkan confession ini sebelumnya.',
        { show_alert: true }
      );
    }

    pendingReport.set(userId, { channelMessageId, confessionId: confession.id });

    const buttons = REPORT_REASONS.map(r => ([
      Markup.button.callback(r.label, `report_reason_${r.value}`)
    ]));
    buttons.push([Markup.button.callback('❌ Batal', 'report_cancel')]);

    await ctx.telegram.sendMessage(
      ctx.from.id,
      '🚩 *Laporkan Confession*\n\nPilih alasan laporan kamu:',
      {
        parse_mode  : 'Markdown',
        reply_markup: { inline_keyboard: buttons },
      }
    );
  });

  // ── Langkah 2: User pilih alasan ────────────────────────────────────────────
  bot.action(/^report_reason_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId      = ctx.from.id;
    const reasonValue = ctx.match[1];

    if (!pendingReport.has(userId)) {
      return ctx.editMessageText('⚠️ Sesi report sudah kedaluwarsa. Silakan klik tombol Report lagi.');
    }

    const reason = REPORT_REASONS.find(r => r.value === reasonValue);
    if (!reason) return ctx.editMessageText('❌ Alasan tidak valid.');

    const { confessionId } = pendingReport.get(userId);
    pendingReport.delete(userId);

    try {
      await saveReport(userId, confessionId, reason.value);

      await ctx.editMessageText(
        `✅ *Laporan berhasil dikirim!*\n\n` +
        `Alasan: ${reason.label}\n\n` +
        `_Terima kasih, tim kami akan meninjau laporan ini._`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('❌ Error saving report:', error);
      await ctx.editMessageText('❌ Gagal mengirim laporan. Silakan coba lagi nanti.');
    }
  });

  // ── Batal ────────────────────────────────────────────────────────────────────
  bot.action('report_cancel', async (ctx) => {
    await ctx.answerCbQuery('❌ Dibatalkan');
    pendingReport.delete(ctx.from.id);
    await ctx.editMessageText('❌ Laporan dibatalkan.');
  });

  return { createReportButton };
}