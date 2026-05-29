import { Markup } from 'telegraf';
import {
    dbCreateDaget,
    dbGetDagetById,
    dbGetActiveDagetan,
    dbMarkDagetDrawn,
    dbMarkDagetCancelled,
    dbSaveDagetWinners,
    dbGetEligibleUsers,
} from './database.js';

// ─── Konstanta ────────────────────────────────────────────────────────────────

const ALL_RANKS = [
    'ascendant', 'bronze', 'diamond', 'gold',
    'member', 'mythos', 'platinum', 'silver',
];

// ─── Utilitas ─────────────────────────────────────────────────────────────────

/** Fisher-Yates shuffle */
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * Parse string tanggal format DD/MM/YYYY HH:MM.
 * Mengembalikan Date atau null jika tidak valid.
 */
function parseDrawTime(str) {
    const match = str.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
    if (!match) return null;
    const [, dd, mm, yyyy, hh, min] = match;
    const date = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00`);
    return isNaN(date.getTime()) ? null : date;
}

/** Format Date ke string lokal Indonesia */
function formatDate(date) {
    return new Date(date).toLocaleString('id-ID', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'Asia/Jakarta',
    }) + ' WIB';
}

/** Escape karakter Markdown Telegram */
function escMd(text) {
    return String(text).replace(/[_*[\]()~`>#+=|{}.!\-]/g, '\\$&');
}

/** Label rank untuk ditampilkan */
function ranksLabel(ranks) {
    return ranks.length === ALL_RANKS.length ? 'Semua rank' : ranks.join(', ');
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

const scheduledTimers = new Map(); // Map<dagetId, NodeJS.Timeout>

/**
 * Jadwalkan undian daget pada waktu yang ditentukan.
 * Jika waktunya sudah lewat, langsung eksekusi.
 */
function scheduleDraw(bot, channelId, dagetId, drawAt) {
    const delay = new Date(drawAt).getTime() - Date.now();

    if (scheduledTimers.has(dagetId)) {
        clearTimeout(scheduledTimers.get(dagetId));
    }

    if (delay <= 0) {
        executeDraw(bot, channelId, dagetId);
        return;
    }

    const timer = setTimeout(() => executeDraw(bot, channelId, dagetId), delay);
    scheduledTimers.set(dagetId, timer);
    console.log(`⏰ [DAGET] ID ${dagetId} dijadwalkan: ${new Date(drawAt).toISOString()}`);
}

/**
 * Jalankan undian: pilih pemenang, simpan, kirim pengumuman.
 */
async function executeDraw(bot, channelId, dagetId) {
    try {
        const daget = await dbGetDagetById(dagetId);
        if (!daget || daget.status !== 'waiting') return;

        const ranks = JSON.parse(daget.ranks);
        const pool = await dbGetEligibleUsers(ranks);

        // Tidak ada peserta → batalkan
        if (pool.length === 0) {
            await dbMarkDagetCancelled(dagetId);
            await bot.telegram.sendMessage(
                channelId,
                `🎲 *Daget "${escMd(daget.title)}" Dibatalkan*\n\n` +
                `Tidak ada peserta yang memenuhi syarat rank.`,
                { parse_mode: 'Markdown' }
            ).catch(() => { });
            return;
        }

        const winners = shuffle(pool).slice(0, Math.min(daget.winner_count, pool.length));

        await dbSaveDagetWinners(dagetId, winners);
        await dbMarkDagetDrawn(dagetId);
        scheduledTimers.delete(dagetId);

        // Pesan pengumuman ke channel
        const winnerLines = winners.map((w, i) => {
            const mention = w.username ? `@${w.username}` : `ID: ${w.telegram_id}`;
            return `${i + 1}. ${mention}`;
        }).join('\n');

        const channelMsg =
            `🎉 *Pengumuman Pemenang Daget!*\n\n` +
            `🎁 *${escMd(daget.title)}*\n` +
            `👥 Rank peserta: ${ranksLabel(ranks)}\n` +
            `🏆 Jumlah pemenang: ${winners.length}\n\n` +
            `🥳 *Pemenang:*\n${winnerLines}\n\n` +
            `_Selamat! Segera hubungi admin untuk klaim hadiah._`;

        await bot.telegram.sendMessage(channelId, channelMsg, { parse_mode: 'Markdown' }).catch(() => { });

        // Notifikasi private ke masing-masing pemenang
        for (const w of winners) {
            await bot.telegram.sendMessage(
                w.telegram_id,
                `🎉 *Selamat, kamu menang Daget!*\n\n` +
                `🎁 *${escMd(daget.title)}*\n\n` +
                `Kamu terpilih sebagai pemenang.\n` +
                `Segera hubungi admin @jzxty untuk klaim hadiahmu!`,
                { parse_mode: 'Markdown' }
            ).catch(() => { });
        }

        console.log(`✅ [DAGET] ID ${dagetId} selesai. Pemenang: ${winners.length}`);
    } catch (err) {
        console.error(`❌ [DAGET] Error undian ID ${dagetId}:`, err);
    }
}

/**
 * Sinkronisasi semua daget aktif dari database ke scheduler.
 * Dipanggil sekali saat bot start.
 */
async function syncScheduler(bot, channelId) {
    const dagetan = await dbGetActiveDagetan();
    for (const d of dagetan) {
        scheduleDraw(bot, channelId, d.id, d.draw_at);
    }
    console.log(`📅 [DAGET] ${dagetan.length} daget disinkronisasi ke scheduler.`);
}

// ─── Keyboard ─────────────────────────────────────────────────────────────────

/** Keyboard toggle rank dengan checkbox visual */
function buildRankKeyboard(selectedRanks = []) {
    const rows = [];

    const allSelected = ALL_RANKS.every(r => selectedRanks.includes(r));
    rows.push([
        Markup.button.callback(
            allSelected ? '✅ Semua Rank (klik untuk batal semua)' : '☑️ Pilih Semua Rank',
            'daget_rank_all'
        ),
    ]);

    for (let i = 0; i < ALL_RANKS.length; i += 2) {
        const row = [];
        for (let j = i; j < Math.min(i + 2, ALL_RANKS.length); j++) {
            const r = ALL_RANKS[j];
            const label = `${selectedRanks.includes(r) ? '✅' : '⬜'} ${r.charAt(0).toUpperCase() + r.slice(1)}`;
            row.push(Markup.button.callback(label, `daget_rank_${r}`));
        }
        rows.push(row);
    }

    rows.push([
        Markup.button.callback('❌ Batal', 'daget_cancel'),
        Markup.button.callback('➡️ Lanjut', 'daget_rank_confirm'),
    ]);

    return Markup.inlineKeyboard(rows);
}

// ─── Session helpers ──────────────────────────────────────────────────────────

function initSession(ctx) {
    if (!ctx.session) ctx.session = {};
    ctx.session.daget = { step: 'title', ranks: [] };
}

function clearSession(ctx) {
    if (!ctx.session) ctx.session = {};
    ctx.session.daget = null;
}

// ─── Tampilan daftar daget aktif ──────────────────────────────────────────────

async function showDagetList(ctx) {
    const dagetan = await dbGetActiveDagetan();

    if (dagetan.length === 0) {
        return ctx.reply(
            '📭 Tidak ada daget yang sedang aktif saat ini.',
            Markup.inlineKeyboard([
                [Markup.button.callback('➕ Buat Daget Baru', 'daget_create')],
                [Markup.button.callback('🏠 Menu Utama', 'back_to_main')],
            ])
        );
    }

    let text = `🎲 *Daget Aktif (${dagetan.length})*\n\n`;
    dagetan.forEach((d, i) => {
        const ranks = JSON.parse(d.ranks);
        text +=
            `*${i + 1}. ${escMd(d.title)}*\n` +
            `⏰ Undian: ${formatDate(d.draw_at)}\n` +
            `🏆 Pemenang: ${d.winner_count} orang\n` +
            `👥 Rank: ${ranksLabel(ranks)}\n\n`;
    });

    await ctx.reply(text, {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('➕ Buat Daget Baru', 'daget_create')],
            [Markup.button.callback('🏠 Menu Utama', 'back_to_main')],
        ]).reply_markup,
    });
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function dagetCommand(bot, channelId) {

    // Sinkronisasi daget aktif saat bot start
    syncScheduler(bot, channelId);

    // ── /daget ──────────────────────────────────────────────────────────────────
    bot.command('daget', async (ctx) => {
        if (ctx.chat.type !== 'private') return;
        clearSession(ctx);
        await showDagetList(ctx);
    });

    // ── Tombol dari menu utama ──────────────────────────────────────────────────
    bot.action('btn_daget', async (ctx) => {
        await ctx.answerCbQuery();
        if (!ctx.session) ctx.session = {};
        clearSession(ctx);
        await showDagetList(ctx);
    });

    // ── Mulai buat daget ────────────────────────────────────────────────────────
    bot.action('daget_create', async (ctx) => {
        await ctx.answerCbQuery();
        initSession(ctx);
        console.log(`🎲 [DAGET] daget_create oleh user ${ctx.from.id}, session:`, ctx.session.daget);

        await ctx.reply(
            `🎲 *Buat Daget Baru*\n\n` +
            `*Langkah 1 dari 4 — Nama Daget*\n\n` +
            `Ketik nama atau judul daget ini.\n` +
            `Contoh: _Giveaway Pulsa 50rb_`,
            {
                parse_mode: 'Markdown',
                reply_markup: Markup.inlineKeyboard([
                    [Markup.button.callback('❌ Batal', 'daget_cancel')],
                ]).reply_markup,
            }
        );
    });

    // ── Batal ───────────────────────────────────────────────────────────────────
    bot.action('daget_cancel', async (ctx) => {
        await ctx.answerCbQuery('Dibatalkan.');
        clearSession(ctx);
        await ctx.reply('❌ Pembuatan daget dibatalkan.', {
            reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback('🏠 Menu Utama', 'back_to_main')],
            ]).reply_markup,
        });
    });

    // ── Toggle "Pilih Semua" rank ───────────────────────────────────────────────
    bot.action('daget_rank_all', async (ctx) => {
        await ctx.answerCbQuery();
        if (!ctx.session?.daget) return;

        const allSelected = ALL_RANKS.every(r => ctx.session.daget.ranks.includes(r));
        ctx.session.daget.ranks = allSelected ? [] : [...ALL_RANKS];

        await ctx.editMessageReplyMarkup(
            buildRankKeyboard(ctx.session.daget.ranks).reply_markup
        ).catch(() => { });
    });

    // ── Toggle rank individual ──────────────────────────────────────────────────
    for (const rank of ALL_RANKS) {
        bot.action(`daget_rank_${rank}`, async (ctx) => {
            await ctx.answerCbQuery();
            if (!ctx.session?.daget) return;

            const idx = ctx.session.daget.ranks.indexOf(rank);
            if (idx === -1) {
                ctx.session.daget.ranks.push(rank);
            } else {
                ctx.session.daget.ranks.splice(idx, 1);
            }

            await ctx.editMessageReplyMarkup(
                buildRankKeyboard(ctx.session.daget.ranks).reply_markup
            ).catch(() => { });
        });
    }

    // ── Konfirmasi pilihan rank → minta jumlah pemenang ─────────────────────────
    bot.action('daget_rank_confirm', async (ctx) => {
        if (!ctx.session?.daget) return;

        if (ctx.session.daget.ranks.length === 0) {
            return ctx.answerCbQuery('⚠️ Pilih minimal 1 rank terlebih dahulu!', { show_alert: true });
        }

        await ctx.answerCbQuery();
        ctx.session.daget.step = 'winner_count';

        await ctx.reply(
            `✅ Rank dipilih: *${ranksLabel(ctx.session.daget.ranks)}*\n\n` +
            `*Langkah 3 dari 4 — Jumlah Pemenang*\n\n` +
            `Masukkan jumlah pemenang (angka 1–100).\n` +
            `Contoh: _3_`,
            {
                parse_mode: 'Markdown',
                reply_markup: Markup.inlineKeyboard([
                    [Markup.button.callback('❌ Batal', 'daget_cancel')],
                ]).reply_markup,
            }
        );
    });

    // ── Konfirmasi simpan daget ──────────────────────────────────────────────────
    bot.action('daget_confirm_yes', async (ctx) => {
        await ctx.answerCbQuery();
        if (!ctx.session?.daget) return;

        const { title, winnerCount, ranks, drawAt } = ctx.session.daget;

        try {
            const pool = await dbGetEligibleUsers(ranks);
            const dagetId = await dbCreateDaget(title, winnerCount, ranks, drawAt, ctx.from.id);
            scheduleDraw(bot, channelId, dagetId, drawAt);
            clearSession(ctx);

            await ctx.reply(
                `🎉 *Daget Berhasil Dibuat!*\n\n` +
                `🎁 Judul: *${escMd(title)}*\n` +
                `👥 Rank peserta: ${ranksLabel(ranks)}\n` +
                `👤 Estimasi peserta: *${pool.length} orang*\n` +
                `🏆 Pemenang: *${winnerCount} orang*\n` +
                `⏰ Waktu undian: *${formatDate(drawAt)}*\n\n` +
                `Bot akan otomatis mengundi pada waktu yang ditentukan.`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: Markup.inlineKeyboard([
                        [Markup.button.callback('🎲 Lihat Daget Aktif', 'btn_daget')],
                        [Markup.button.callback('🏠 Menu Utama', 'back_to_main')],
                    ]).reply_markup,
                }
            );
        } catch (err) {
            console.error('❌ [DAGET] Error membuat daget:', err);
            await ctx.reply('❌ Gagal membuat daget. Silakan coba lagi.');
        }
    });

    bot.action('daget_confirm_no', async (ctx) => {
        await ctx.answerCbQuery('Dibatalkan.');
        clearSession(ctx);
        await ctx.reply('❌ Pembuatan daget dibatalkan.', {
            reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback('🏠 Menu Utama', 'back_to_main')],
            ]).reply_markup,
        });
    });

    // ─── Handler teks (dipanggil dari bot.js) ────────────────────────────────────

    /**
     * Proses input teks selama sesi pembuatan daget.
     * Return true jika pesan sudah ditangani, false jika tidak.
     */
    async function handleDagetText(ctx) {
        const session = ctx.session?.daget;
        if (!session) return false;

        const text = ctx.message.text.trim();

        // ── Langkah 1: Nama daget ─────────────────────────────────────────────────
        if (session.step === 'title') {
            if (text.length < 3) {
                await ctx.reply('⚠️ Nama daget minimal 3 karakter. Coba lagi:');
                return true;
            }
            if (text.length > 200) {
                await ctx.reply('⚠️ Nama daget maksimal 200 karakter. Coba lagi:');
                return true;
            }

            ctx.session.daget.title = text;
            ctx.session.daget.step = 'ranks';

            await ctx.reply(
                `✅ Judul: *${escMd(text)}*\n\n` +
                `*Langkah 2 dari 4 — Pilih Rank Peserta*\n\n` +
                `Pilih rank yang boleh ikut daget ini.\n` +
                `Bisa pilih satu, beberapa, atau semua.`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: buildRankKeyboard([]).reply_markup,
                }
            );
            return true;
        }

        // ── Langkah 3: Jumlah pemenang ────────────────────────────────────────────
        if (session.step === 'winner_count') {
            const num = parseInt(text, 10);
            if (isNaN(num) || num < 1 || num > 100) {
                await ctx.reply('⚠️ Masukkan angka yang valid antara 1 hingga 100:');
                return true;
            }

            ctx.session.daget.winnerCount = num;
            ctx.session.daget.step = 'draw_at';

            await ctx.reply(
                `✅ Jumlah pemenang: *${num} orang*\n\n` +
                `*Langkah 4 dari 4 — Waktu Undian*\n\n` +
                `Masukkan waktu undian dengan format:\n` +
                `\`DD/MM/YYYY HH:MM\`\n\n` +
                `📌 Contoh:\n` +
                `\`25/12/2025 20:00\`\n` +
                `\`01/06/2025 14:30\`\n\n` +
                `_Waktu menggunakan zona WIB (UTC+7)_`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: Markup.inlineKeyboard([
                        [Markup.button.callback('❌ Batal', 'daget_cancel')],
                    ]).reply_markup,
                }
            );
            return true;
        }

        // ── Langkah 4: Waktu undian ───────────────────────────────────────────────
        if (session.step === 'draw_at') {
            const date = parseDrawTime(text);

            if (!date) {
                await ctx.reply(
                    `⚠️ *Format waktu tidak valid!*\n\n` +
                    `Gunakan format: \`DD/MM/YYYY HH:MM\`\n\n` +
                    `📌 Contoh yang benar:\n` +
                    `\`25/12/2025 20:00\`\n` +
                    `\`01/06/2025 14:30\`\n\n` +
                    `Coba masukkan lagi:`,
                    { parse_mode: 'Markdown' }
                );
                return true;
            }

            if (date.getTime() < Date.now() + 60_000) {
                await ctx.reply(
                    '⚠️ Waktu undian harus minimal 1 menit di masa depan. Coba masukkan lagi:',
                    { parse_mode: 'Markdown' }
                );
                return true;
            }

            ctx.session.daget.drawAt = date.toISOString();
            ctx.session.daget.step = 'confirm';

            const { title, winnerCount, ranks } = ctx.session.daget;
            const pool = await dbGetEligibleUsers(ranks);

            await ctx.reply(
                `📋 *Konfirmasi Daget*\n\n` +
                `🎁 Judul: *${escMd(title)}*\n` +
                `👥 Rank peserta: ${ranksLabel(ranks)}\n` +
                `👤 Estimasi peserta: *${pool.length} orang*\n` +
                `🏆 Jumlah pemenang: *${winnerCount} orang*\n` +
                `⏰ Waktu undian: *${formatDate(date)}*\n\n` +
                `Apakah semua data sudah benar?`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: Markup.inlineKeyboard([
                        [
                            Markup.button.callback('✅ Ya, Buat!', 'daget_confirm_yes'),
                            Markup.button.callback('❌ Batal', 'daget_confirm_no'),
                        ],
                    ]).reply_markup,
                }
            );
            return true;
        }

        return false;
    }

    /**
     * Cek apakah user sedang dalam sesi pembuatan daget.
     * @param {object} ctx - Telegraf context
     * @returns {boolean}
     */
    function isUserInDagetSession(ctx) {
        return !!(ctx.session?.daget?.step);
    }

    return { handleDagetText, isUserInDagetSession };
}