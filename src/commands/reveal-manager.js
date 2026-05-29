import { Markup } from 'telegraf';
import { Database } from './database.js';

/**
 * Reveal Manager - Handles identity reveal functionality
 */
export class RevealManager {
  constructor(bot, chatManager) {
    this.bot = bot;
    this.chatManager = chatManager;
  }

  /**
   * Setup reveal handlers
   */
  setupHandlers() {
    // Handler untuk reveal request via command
    this.bot.command('reveal', async (ctx) => {
      // Only process in private chat
      if (ctx.chat.type !== 'private') {
        return;
      }
      await this.handleRevealRequest(ctx, ctx.from.id);
    });

    // Handler untuk reveal request via button
    this.bot.action(/^reveal_request_(\d+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      const sessionId = parseInt(ctx.match[1]);
      await this.handleRevealRequest(ctx, ctx.from.id, sessionId);
    });

    // Handler untuk reveal accept
    this.bot.action(/^reveal_accept_(\d+)$/, async (ctx) => {
      try {
        await ctx.answerCbQuery();
        const sessionId = parseInt(ctx.match[1]);
        await this.acceptRevealRequest(ctx, sessionId);
      } catch (error) {
        console.error('Error in reveal accept:', error);
        await ctx.reply('❌ Terjadi kesalahan saat reveal identitas.');
      }
    });

    // Handler untuk reveal decline
    this.bot.action(/^reveal_decline_(\d+)$/, async (ctx) => {
      try {
        await ctx.answerCbQuery();
        const sessionId = parseInt(ctx.match[1]);
        await this.declineRevealRequest(ctx, sessionId);
      } catch (error) {
        console.error('Error in reveal decline:', error);
        await ctx.reply('❌ Terjadi kesalahan.');
      }
    });
  }

  /**
   * Handle reveal request
   */
  async handleRevealRequest(ctx, userId, sessionId = null) {
    try {
      if (!this.chatManager.isUserInChat(userId)) {
        return ctx.reply('❌ Kamu tidak sedang dalam chat anonymous.');
      }

      const userChatData = this.chatManager.getUserChatInfo(userId);
      if (!userChatData) {
        return ctx.reply('❌ Data chat tidak ditemukan.');
      }

      const actualSessionId = sessionId || userChatData.sessionId;

      const session = await Database.getChatSessionById(actualSessionId);
      if (!session || !session.is_active) {
        return ctx.reply('❌ Chat session tidak aktif.');
      }

      const receiverId = userChatData.partnerId;
      const senderRole = userChatData.role;
      const senderLabel = senderRole === 'confessor' ? '👤 Confessor' : '💝 Hitter';

      // Check if already revealed
      const isRevealed = await Database.checkRevealStatus(actualSessionId, userId);
      if (isRevealed) {
        return ctx.reply('🎭 Identitas kamu sudah di-reveal sebelumnya.');
      }

      // Check if partner already revealed
      const partnerRevealed = await Database.checkRevealStatus(actualSessionId, receiverId);
      if (partnerRevealed) {
        // If partner already revealed, automatically reveal this user too
        await this.performMutualReveal(ctx, session);
        return;
      }

      // Send reveal request to receiver
      await ctx.telegram.sendMessage(
        receiverId,
        `🎭 *Reveal Identity Request*\n\n` +
        `**${senderLabel}** ingin reveal identitas!\n\n` +
        `🤔 Apakah kamu setuju untuk saling reveal identitas?\n\n` +
        `⚠️ *Perhatian:* Setelah reveal, identitas kalian akan terlihat dan chat tetap berlanjut!`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback('✅ Setuju Reveal', `reveal_accept_${actualSessionId}`),
              Markup.button.callback('❌ Tolak', `reveal_decline_${actualSessionId}`)
            ]
          ])
        }
      );

      await ctx.reply(
        '🎭 *Permintaan Reveal Terkirim*\n\n' +
        '⏳ Permintaan reveal identitas telah dikirim ke lawan chat\n' +
        '🔔 Tunggu respon dari mereka\n\n' +
        '💡 Jika mereka setuju, identitas kalian akan terbuka dan chat berlanjut.',
        { parse_mode: 'Markdown' }
      );

    } catch (error) {
      console.error('Error in reveal request:', error);
      await ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi.');
    }
  }

  /**
   * Accept reveal request
   */
  async acceptRevealRequest(ctx, sessionId) {
    try {
      const session = await Database.getChatSessionById(sessionId);
      if (!session || !session.is_active) {
        return ctx.editMessageText('❌ Session tidak ditemukan atau tidak aktif.');
      }

      await this.performMutualReveal(ctx, session);

    } catch (error) {
      console.error('Error in accept reveal request:', error);
      await ctx.editMessageText('❌ Terjadi kesalahan saat memproses reveal.');
    }
  }

  /**
   * Decline reveal request
   */
  async declineRevealRequest(ctx, sessionId) {
    try {
      const session = await Database.getChatSessionById(sessionId);
      if (!session) {
        return ctx.editMessageText('❌ Session tidak ditemukan.');
      }

      // Find who sent the reveal request (the one who is NOT the current user)
      const requesterId = session.confessor_id === ctx.from.id ? session.hitter_id : session.confessor_id;

      await ctx.telegram.sendMessage(
        requesterId,
        '❌ *Reveal Ditolak*\n\n' +
        'Permintaan reveal identitas ditolak oleh lawan chat.\n\n' +
        '💬 Chat anonymous akan dilanjutkan tanpa reveal identitas.\n' +
        '🤖 Bot tetap menjadi perantara pesan kalian.\n\n' +
        '💡 Kamu bisa mencoba request reveal lagi nanti.',
        { parse_mode: 'Markdown' }
      );

      await ctx.editMessageText(
        '❌ *Permintaan Reveal Ditolak*\n\n' +
        '👋 Kamu telah menolak permintaan reveal identitas.\n' +
        '💬 Chat anonymous akan dilanjutkan tanpa reveal.',
        { parse_mode: 'Markdown' }
      );

    } catch (error) {
      console.error('Error in decline reveal request:', error);
      await ctx.editMessageText('❌ Terjadi kesalahan.');
    }
  }

  /**
   * Perform mutual reveal between both users
   */
  async performMutualReveal(ctx, session) {
    try {
      // Get both users data
      const confessor = await Database.getUserById(session.confessor_id);
      const hitter = await Database.getUserById(session.hitter_id);

      if (!confessor || !hitter) {
        return ctx.editMessageText('❌ Data user tidak ditemukan.');
      }

      // Get Telegram user info
      let confessionUser, hitterUser;

      try {
        confessionUser = await ctx.telegram.getChat(session.confessor_id);
        hitterUser = await ctx.telegram.getChat(session.hitter_id);
      } catch (error) {
        console.error('Error getting user info:', error);
        return ctx.editMessageText('❌ Gagal mendapatkan informasi user.');
      }

      // Prepare user display info
      const confessionUserName = `${confessionUser.first_name}${confessionUser.last_name ? ' ' + confessionUser.last_name : ''}`;
      const hitterUserName = `${hitterUser.first_name}${hitterUser.last_name ? ' ' + hitterUser.last_name : ''}`;

      const endChatButton = Markup.inlineKeyboard([
        [Markup.button.callback('❌ End Chat', 'end_chat')]
      ]);

      // Send revealed identities to confessor
      await ctx.telegram.sendMessage(
        session.confessor_id,
        `🎭 *IDENTITAS REVEALED!*\n\n` +
        `💝 **Hitter Identity:**\n` +
        `• Nama: ${hitterUserName}\n` +
        `• Username: ${hitterUser.username ? '@' + hitterUser.username : 'Tidak ada'}\n` +
        `• ID: \`${session.hitter_id}\`\n` +
        `• Gender: ${hitter.gender || 'Unknown'}\n` +
        `• Rank: ${hitter.rank || 'Member'}\n` +
        `• Origin: ${hitter.origin || 'Unknown'}\n\n` +
        `💬 Chat akan dilanjutkan dengan identitas terbuka!\n` +
        `🤖 Bot tetap menjadi perantara pesan kalian.\n\n` +
        `✉️ Sekarang pesan akan menampilkan nama asli pengirim.`,
        { 
          parse_mode: 'Markdown',
          ...endChatButton
        }
      );

      // Send revealed identities to hitter
      await ctx.telegram.sendMessage(
        session.hitter_id,
        `🎭 *IDENTITAS REVEALED!*\n\n` +
        `👤 **Confessor Identity:**\n` +
        `• Nama: ${confessionUserName}\n` +
        `• Username: ${confessionUser.username ? '@' + confessionUser.username : 'Tidak ada'}\n` +
        `• ID: \`${session.confessor_id}\`\n` +
        `• Gender: ${confessor.gender || 'Unknown'}\n` +
        `• Rank: ${confessor.rank || 'Member'}\n` +
        `• Origin: ${confessor.origin || 'Unknown'}\n\n` +
        `💬 Chat akan dilanjutkan dengan identitas terbuka!\n` +
        `🤖 Bot tetap menjadi perantara pesan kalian.\n\n` +
        `✉️ Sekarang pesan akan menampilkan nama asli pengirim.`,
        { 
          parse_mode: 'Markdown',
          ...endChatButton
        }
      );

      // Update reveal status for both users in database
      await Database.updateRevealStatus(session.id, session.confessor_id, true);
      await Database.updateRevealStatus(session.id, session.hitter_id, true);

      // Update the original message if this was triggered by a button
      if (ctx.callbackQuery) {
        await ctx.editMessageText(
          '✅ *Identitas Berhasil Di-reveal!*\n\n' +
          '🎭 Identitas kedua belah pihak telah terbuka\n' +
          '💬 Chat akan dilanjutkan dengan nama asli\n' +
          '🤖 Bot tetap menjadi perantara pesan',
          { parse_mode: 'Markdown' }
        );
      }

      console.log(`Identities revealed for session ${session.id}: ${session.confessor_id} <-> ${session.hitter_id}`);

    } catch (error) {
      console.error('Error in perform mutual reveal:', error);
      if (ctx.callbackQuery) {
        await ctx.editMessageText('❌ Terjadi kesalahan saat reveal identitas.');
      } else {
        await ctx.reply('❌ Terjadi kesalahan saat reveal identitas.');
      }
    }
  }

  /**
   * Check if both users have revealed their identities
   */
  async checkMutualRevealStatus(sessionId) {
    try {
      const session = await Database.getChatSessionById(sessionId);
      if (!session) return { confessorRevealed: false, hitterRevealed: false, bothRevealed: false };

      const confessorRevealed = await Database.checkRevealStatus(sessionId, session.confessor_id);
      const hitterRevealed = await Database.checkRevealStatus(sessionId, session.hitter_id);

      return {
        confessorRevealed,
        hitterRevealed,
        bothRevealed: confessorRevealed && hitterRevealed
      };
    } catch (error) {
      console.error('Error checking mutual reveal status:', error);
      return { confessorRevealed: false, hitterRevealed: false, bothRevealed: false };
    }
  }

  /**
   * Get display name for user (handles revealed vs anonymous)
   */
  async getUserDisplayName(userId, sessionId, role) {
    try {
      const revealStatus = await this.checkMutualRevealStatus(sessionId);

      if (revealStatus.bothRevealed) {
        const userInfo = await this.bot.telegram.getChat(userId);
        return `${userInfo.first_name}${userInfo.last_name ? ' ' + userInfo.last_name : ''}`;
      } else {
        return role === 'confessor' ? '👤 Confessor' : '💝 Hitter';
      }
    } catch (error) {
      console.error('Error getting user display name:', error);
      return role === 'confessor' ? '👤 Confessor' : '💝 Hitter';
    }
  }
}