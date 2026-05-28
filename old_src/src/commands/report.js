import { Markup } from 'telegraf';
import { Database } from './database.js';

const REPORT_REASONS = [
  { label: '🚫 Spam',            value: 'spam' },
  { label: '☠️ SARA / Hate Speech', value: 'sara' },
  { label: '🔞 Konten Tidak Pantas', value: 'inappropriate' },
  { label: '🎭 Identitas Palsu',  value: 'fake_identity' },
  { label: '⚠️ Lainnya',          value: 'other' },
];

/**
 * Handler untuk sistem Report
 * @param {Telegraf} bot
 * @param {string|number} targetChannelId
 */
export default function reportHandler(bot, targetChannelId) {
    // State sementara: userId → { channelMessageId, confessionId }
    const pendingReport = new Map();

    /**
     * Buat tombol Report untuk ditempel di pesan channel.
     * @param {number} channelMessageId
     */
    function createReportButton(channelMessageId) {
        return {
        text: '🚩 Report',
        callback_data: `report_start_${channelMessageId}`
        };
    }

    // ── Langkah 1: User klik tombol Report di channel ──────────────────────────
    bot.action(/^report_start_(\d+)$/, async (ctx) => {
        await ctx.answerCbQuery();
        const channelMessageId = parseInt(ctx.match[1]);
        const userId = ctx.from.id;

        // Cek apakah user terdaftar
        const user = await Database.getUserById(userId);
        if (!user) {
            return ctx.answerCbQuery('❌ Kamu belum terdaftar!\n\nDaftar terlebih dahulu untuk bisa melaporkan confession.', { show_alert: true });
        }

        // Cek confession ada di DB
        const confession = await Database.getConfessionByChannelMessageId(channelMessageId);
        if (!confession) {
            return ctx.answerCbQuery('❌ Confession tidak ditemukan.', { show_alert: true });
        }

        // Cegah self-report
        if (confession.telegram_id === userId) {
            return ctx.answerCbQuery('❌ Kamu tidak bisa melaporkan confession milik sendiri.', { show_alert: true });
        }

        // Cek apakah sudah pernah report confession ini
        const alreadyReported = await Database.hasUserReported(userId, confession.id);
        if (alreadyReported) {
            return ctx.answerCbQuery('⚠️ Kamu sudah pernah melaporkan confession ini sebelumnya.', { show_alert: true });
        }

        // Simpan state
        pendingReport.set(userId, { channelMessageId, confessionId: confession.id });

        // Kirim pilihan alasan ke bot user
        const buttons = REPORT_REASONS.map(r => ([
        Markup.button.callback(r.label, `report_reason_${r.value}`)
        ]));
        buttons.push([Markup.button.callback('❌ Batal', 'report_cancel')]);

        await ctx.telegram.sendMessage(
            ctx.from.id,
            '🚩 *Laporkan Confession*\n\nPilih alasan laporan kamu:',
            {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: buttons }
            }
        );
    });

    // ── Langkah 2: User pilih alasan ───────────────────────────────────────────
    bot.action(/^report_reason_(.+)$/, async (ctx) => {
        await ctx.answerCbQuery();
        const userId = ctx.from.id;
        const reasonValue = ctx.match[1];

        if (!pendingReport.has(userId)) {
        return ctx.editMessageText('⚠️ Sesi report sudah kedaluwarsa. Silakan klik tombol Report lagi.');
        }

        const reason = REPORT_REASONS.find(r => r.value === reasonValue);
        if (!reason) {
        return ctx.editMessageText('❌ Alasan tidak valid.');
        }

        const { confessionId } = pendingReport.get(userId);
        pendingReport.delete(userId);

        try {
        await Database.saveReport(userId, confessionId, reason.value);

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

    // ── Batal ──────────────────────────────────────────────────────────────────
    bot.action('report_cancel', async (ctx) => {
        await ctx.answerCbQuery('❌ Dibatalkan');
        const userId = ctx.from.id;
        pendingReport.delete(userId);
        await ctx.editMessageText('❌ Laporan dibatalkan.');
    });

    return { createReportButton };
}