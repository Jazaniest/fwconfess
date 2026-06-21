/**
 * Admin reports handler — business logic untuk laporan.
 */
import { Database } from '../../commands/database.js';

export async function handleAdminReports(ctx) {
  try {
    const reportStats = await Database.getReportStats();
    const recentReports = await Database.getReportsPaginated('pending', 5, 0);

    let text = `📋 *Laporan User*\n\n`;
    text += `📊 *Ringkasan:*\n`;
    text += `• Total: *${reportStats.total}*  |  ⏰ Pending: *${reportStats.pending}*\n`;
    text += `• ✅ Ditangani: *${reportStats.handled}*  |  ❌ Ditolak: *${reportStats.rejected}*\n\n`;

    if (recentReports.length > 0) {
      text += `🆕 *Laporan Pending Terbaru:*\n`;
      recentReports.forEach((r, i) => {
        text += `${i + 1}. \`#${r.id}\` — ${r.reason} — ${new Date(r.created_at).toLocaleDateString('id-ID')}\n`;
      });
    } else {
      text += `✅ Tidak ada laporan pending.`;
    }

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⏰ Pending', callback_data: 'admin_reports_filter_pending_0' },
            { text: '✅ Ditangani', callback_data: 'admin_reports_filter_handled_0' },
            { text: '❌ Ditolak', callback_data: 'admin_reports_filter_rejected_0' }
          ],
          [{ text: '🏠 Kembali', callback_data: 'back_to_admin' }]
        ]
      }
    });
  } catch (error) {
    console.error('❌ Error getting reports:', error);
    await ctx.editMessageText('❌ Error memuat laporan.', {
      reply_markup: { inline_keyboard: [[{ text: '🏠 Kembali', callback_data: 'back_to_admin' }]] }
    });
  }
}

export async function handleAdminReportsFilter(ctx, status, offset) {
  const limit = 5;
  const reports = await Database.getReportsPaginated(status, limit + 1, offset);
  const hasMore = reports.length > limit;
  const page = reports.slice(0, limit);

  const statusLabel = { pending: '⏰ Pending', handled: '✅ Ditangani', rejected: '❌ Ditolak' }[status];

  let text = `📋 *Laporan — ${statusLabel}*\n\n`;
  if (page.length === 0) {
    text += `Tidak ada laporan dengan status ini.`;
  } else {
    page.forEach((r, i) => {
      text += `*${offset + i + 1}.* ID \`#${r.id}\`\n`;
      text += `   Alasan: ${r.reason}\n`;
      text += `   Tanggal: ${new Date(r.created_at).toLocaleDateString('id-ID')}\n`;
      text += `   [Lihat Detail →]\n\n`;
    });
  }

  const detailButtons = page.map(r => ([{
    text: `🔍 Detail Laporan #${r.id}`,
    callback_data: `admin_report_detail_${r.id}_${status}_${offset}`
  }]));

  const navButtons = [];
  if (offset > 0) navButtons.push({ text: '⬅️ Sebelumnya', callback_data: `admin_reports_filter_${status}_${offset - limit}` });
  if (hasMore) navButtons.push({ text: '➡️ Selanjutnya', callback_data: `admin_reports_filter_${status}_${offset + limit}` });

  const keyboard = [
    ...detailButtons,
    ...(navButtons.length ? [navButtons] : []),
    [{ text: '🔙 Kembali', callback_data: 'admin_reports' }]
  ];

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
}

export async function handleAdminReportDetail(ctx, reportId, backStatus, backOffset) {
  const report = await Database.getReportWithDetail(reportId);
  if (!report) return ctx.editMessageText('❌ Laporan tidak ditemukan.');

  const confessPreview = report.confession_text?.substring(0, 200) + (report.confession_text?.length > 200 ? '...' : '');

  const text =
    `🔍 *Detail Laporan #${report.id}*\n\n` +
    `📌 Status: *${report.status}*\n` +
    `⚠️ Alasan: *${report.reason}*\n` +
    `👤 Reporter ID: \`${report.reporter_id}\`\n` +
    `✍️ Confessor ID: \`${report.confessor_id}\`\n` +
    `📅 Tanggal: ${new Date(report.created_at).toLocaleString('id-ID')}\n\n` +
    `💬 *Isi Confession:*\n${confessPreview}`;

  const actionButtons = report.status === 'pending'
    ? [
        [
          { text: '✅ Tandai Ditangani', callback_data: `admin_report_status_${reportId}_handled_${backStatus}_${backOffset}` },
          { text: '❌ Tolak Laporan', callback_data: `admin_report_status_${reportId}_rejected_${backStatus}_${backOffset}` }
        ],
        [{ text: '🗑️ Hapus Confession dari Channel', callback_data: `admin_report_delete_${reportId}_${backStatus}_${backOffset}` }]
      ]
    : [];

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        ...actionButtons,
        [{ text: '🔙 Kembali', callback_data: `admin_reports_filter_${backStatus}_${backOffset}` }]
      ]
    }
  });
}

export async function handleAdminReportStatus(ctx, reportId, newStatus, backStatus, backOffset) {
  await Database.updateReportStatus(reportId, newStatus);
  const label = newStatus === 'handled' ? '✅ Ditandai sebagai Ditangani' : '❌ Laporan Ditolak';

  await ctx.editMessageText(
    `${label}\n\nLaporan \`#${reportId}\` berhasil diperbarui.`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Kembali ke Daftar', callback_data: `admin_reports_filter_${backStatus}_${backOffset}` }]
        ]
      }
    }
  );
}

export async function handleAdminReportDelete(ctx, reportId, backStatus, backOffset) {
  const report = await Database.getReportWithDetail(reportId);
  if (!report) return ctx.editMessageText('❌ Laporan tidak ditemukan.');

  await ctx.editMessageText(
    `🗑️ *Konfirmasi Hapus*\n\n` +
    `Apakah kamu yakin ingin menghapus confession ini dari channel?\n\n` +
    `ID Laporan: \`#${reportId}\`\n` +
    `Confessor: \`${report.confessor_id}\`\n\n` +
    `⚠️ _Tindakan ini tidak bisa dibatalkan._`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Ya, Hapus', callback_data: `admin_report_delete_confirm_${reportId}_${backStatus}_${backOffset}` },
            { text: '❌ Batal', callback_data: `admin_report_detail_${reportId}_${backStatus}_${backOffset}` }
          ]
        ]
      }
    }
  );
}

export async function handleAdminReportDeleteConfirm(ctx, reportId, targetChannelId, backStatus, backOffset) {
  const report = await Database.getReportWithDetail(reportId);
  if (!report) return ctx.editMessageText('❌ Laporan tidak ditemukan.');

  let deleteSuccess = false;
  try {
    await ctx.telegram.deleteMessage(targetChannelId, report.channel_message_id);
    deleteSuccess = true;
  } catch (err) {
    console.error('❌ Gagal hapus pesan dari channel:', err.message);
  }

  await Database.updateReportStatus(reportId, 'handled');

  await ctx.editMessageText(
    deleteSuccess
      ? `✅ *Confession berhasil dihapus dari channel.*\n\nLaporan \`#${reportId}\` ditandai sebagai Ditangani.`
      : `⚠️ *Gagal menghapus pesan dari channel.*\n\nMungkin sudah dihapus sebelumnya. Laporan tetap ditandai Ditangani.`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Kembali ke Daftar', callback_data: `admin_reports_filter_${backStatus}_${backOffset}` }]
        ]
      }
    }
  );
}
