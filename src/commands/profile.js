import { Markup } from 'telegraf';
import { Database } from './database.js';
import { isAdmin } from '../middleware/admin-auth.js';
import { checkMembership, showJoinRequirement } from '../middleware/membership.js';
import {
  showProfile, showEditProfile, showGenderOptions, setGender, askOrigin,
  cancelEditOrigin, showPrivacyMenu, togglePrivacy, handleOriginText,
} from '../handlers/profile.handler.js';
import * as AchievementRepo from '../repositories/achievement.repo.js';

export default function profileCommand(bot) {
  async function membershipMiddleware(ctx, next) {
    if (isAdmin(ctx.from.id)) return next();
    const membershipStatus = await checkMembership(ctx, ctx.from.id);
    if (!membershipStatus.isChannelMember || !membershipStatus.isGroupMember) {
      await showJoinRequirement(ctx, membershipStatus);
      return;
    }
    return next();
  }

  bot.action('btn_profile', async (ctx) => {
    await ctx.answerCbQuery('📋 Memuat profile...');
    try {
      await showProfile(ctx, true);
    } catch (error) {
      console.error('Error showing profile:', error);
      await ctx.editMessageText('❌ Error memuat profile.', { reply_markup: Markup.inlineKeyboard([[{ text: '🔄 Coba Lagi', callback_data: 'btn_profile' }], [{ text: '🏠 Menu Utama', callback_data: 'back_to_main' }]]) });
    }
  });

  bot.command('profile', async (ctx) => {
    const msg = await ctx.reply('⏳ Memuat profile...');
    try {
      const userId = ctx.from.id;
      await Database.updateUsername(userId, ctx.from.username);
      const userProfile = await Database.getUserFullProfile(userId);
      if (!userProfile) {
        return await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '❌ Profile tidak ditemukan!', { reply_markup: Markup.inlineKeyboard([[Markup.button.callback('📝 Daftar Sekarang', 'btn_register')]]) });
      }
      const [totalConfessions, privacy, achievements] = await Promise.all([
          Database.getTotalUserConfessions(userId),
          Database.getPrivacySettings(userId),
          AchievementRepo.getUserAchievements(userId)
      ]);
      const joinDate = new Date(userProfile.registered_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
      const memberStatus = userProfile.is_active === 1 ? '✅ Active' : '❌ Inactive';
      let achievementText = achievements.length > 0 ? `\n\n🏅 *Achievements:*\n${achievements.map(ach => `${ach.icon} ${ach.title}`).join('\n')}` : '';
      const profileText = `👤 *Profile Anda*\n\n` + `🆔 User ID: \`${userId}\`\n` + `👤 Username: ${ctx.from.username ? `@${ctx.from.username.replace(/_/g, '\\_')}` : '_Tidak ada_'}\n` + `📅 Bergabung: ${joinDate}\n` + `📝 Total Menfess: *${totalConfessions}*\n` + `🎯 Status: ${memberStatus}\n` + `📍 Origin: ${userProfile.origin || 'Tidak diisi'}\n` + `👥 Gender: ${userProfile.gender || 'Tidak diisi'}\n` + `🏆 Rank: ${userProfile.rank || 'Member'}\n` + `${achievementText}\n\n` + `🔒 *Privacy:*\n` + `• Username : ${privacy.hide_username ? '🙈 Tersembunyi' : '👁 Terlihat'}\n` + `• Gender   : ${privacy.hide_gender ? '🙈 Tersembunyi' : '👁 Terlihat'}\n` + `• Origin   : ${privacy.hide_origin ? '🙈 Tersembunyi' : '👁 Terlihat'}`;
      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, profileText, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '✏️ Edit Profile', callback_data: 'edit_profile' }, { text: '🔒 Atur Privacy', callback_data: 'privacy_settings' }], [{ text: '🏆 Upgrade Rank', callback_data: 'show_rank_menu' }], [{ text: '🏠 Menu Utama', callback_data: 'back_to_main' }]] } });
    } catch (error) {
      console.error('Error loading profile via command:', error);
      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '❌ Terjadi kesalahan saat memuat profile.');
    }
  });

  bot.action('edit_profile', membershipMiddleware, async (ctx) => { await ctx.answerCbQuery(); await showEditProfile(ctx); });
  bot.action('edit_gender', membershipMiddleware, async (ctx) => { await ctx.answerCbQuery(); await showGenderOptions(ctx); });
  bot.action(/^set_gender_(.+)$/, membershipMiddleware, async (ctx) => { await ctx.answerCbQuery(); await setGender(ctx, ctx.match[1]); });
  bot.action('edit_origin', membershipMiddleware, async (ctx) => { await ctx.answerCbQuery(); await askOrigin(ctx); });
  bot.action('cancel_edit_origin', async (ctx) => { await cancelEditOrigin(ctx); });
  bot.action('privacy_settings', membershipMiddleware, async (ctx) => { await ctx.answerCbQuery(); const p = await Database.getPrivacySettings(ctx.from.id); await showPrivacyMenu(ctx, p, false); });
  bot.action(/^toggle_hide_(username|gender|origin)$/, membershipMiddleware, async (ctx) => { await ctx.answerCbQuery(); await togglePrivacy(ctx, `hide_${ctx.match[1]}`); });
  bot.action('btn_back_to_start', async (ctx) => {
      await ctx.answerCbQuery();
      // ... logic
  });

  return { handleProfileText: handleOriginText };
}
