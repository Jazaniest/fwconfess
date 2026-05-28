import { setupConfessHandlers } from '../handlers/confession/confess-handler.js';
import commentHandler           from '../handlers/confession/comment.js';
import showMeHandler            from '../handlers/confession/showme.js';
import reportHandler            from '../handlers/confession/report.js';

/**
 * Confess command entry-point.
 *
 * Tanggung jawab file ini hanya:
 *   1. Instantiasi sub-system (comment, showme, report)
 *   2. Memanggil setupConfessHandlers() yang registrasi semua action/command ke bot
 *   3. Meneruskan public interface ke bot.js
 *
 * Semua business logic ada di handlers/confession/confess-handler.js.
 *
 * @param {import('telegraf').Telegraf} bot
 * @param {string|number} targetChannelId
 * @returns {Object} public interface dari setupConfessHandlers + sub-systems
 */
export default function confessCommand(bot, targetChannelId) {
  const commentSystem = commentHandler(bot, process.env.DISCUSSION_GROUP_ID);
  const showMeSystem  = showMeHandler(bot);
  const reportSystem  = reportHandler(bot, targetChannelId);

  console.log('🚀 Confess command initialized with channel:', targetChannelId);
  console.log('💬 Discussion group ID:', process.env.DISCUSSION_GROUP_ID);
  console.log('💬 Comment system enabled:', commentSystem.isCommentSystemEnabled());

  const confessHandler = setupConfessHandlers(
    bot,
    targetChannelId,
    commentSystem,
    showMeSystem,
    reportSystem
  );

  return {
    ...confessHandler,
    commentSystem,
    showMeSystem,
    reportSystem,
  };
}