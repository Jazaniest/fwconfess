import { supabase } from '../services/db.js';

/**
 * Database helper functions
 */
export class Database {

  /**
   * Get user data by telegram ID
   */
  static async getUserById(telegramId) {
    const { data, error } = await supabase
      .from('users')
      .select('telegram_id, rank, gender, origin')
      .eq('telegram_id', telegramId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data;
  }

  /**
   * Save confession to database
   */
  static async saveConfession(telegramId, messageText, channelMessageId) {
    const { data, error } = await supabase
      .from('confessions')
      .insert([{
        telegram_id: telegramId,
        message_text: messageText,
        channel_message_id: channelMessageId
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get confession by channel message ID
   */
  static async getConfessionByChannelMessageId(channelMessageId) {
    const { data, error } = await supabase
      .from('confessions')
      .select('*')
      .eq('channel_message_id', channelMessageId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data;
  }

  /**
   * Get latest confession by user ID
   */
  static async getLatestConfessionByUserId(userId) {
    const { data, error } = await supabase
      .from('confessions')
      .select('*')
      .eq('telegram_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data;
  }

  /**
   * Create anonymous chat session
   */
  static async createChatSession(confessionId, confessorId, hitterId) {
    // Generate unique session code
    const sessionCode = Math.random().toString(36).substring(2, 15) + 
                       Math.random().toString(36).substring(2, 15);

    const { data, error } = await supabase
      .from('chat_sessions')
      .insert([{
        confession_id: confessionId,
        confessor_id: confessorId,
        hitter_id: hitterId,
        session_code: sessionCode
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get active chat session by user ID
   */
  static async getActiveChatSession(userId) {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .or(`confessor_id.eq.${userId},hitter_id.eq.${userId}`)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data;
  }

  /**
   * Get all active sessions
   */
  static async getActiveSessions() {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get chat session by session code
   */
  static async getChatSessionByCode(sessionCode) {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('session_code', sessionCode)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data;
  }

  /**
   * Get chat session by ID
   */
  static async getChatSessionById(sessionId) {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data;
  }

  /**
   * Save anonymous message
   */
  static async saveAnonymousMessage(sessionId, senderId, messageText, messageType = 'text') {
    const { data, error } = await supabase
      .from('anonymous_messages')
      .insert([{
        session_id: sessionId,
        sender_id: senderId,
        message_text: messageText,
        message_type: messageType
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get chat history for session
   */
  static async getChatHistory(sessionId, limit = 50) {
    const { data, error } = await supabase
      .from('anonymous_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /**
   * Check reveal status for user in session
   */
  static async checkRevealStatus(sessionId, userId) {
    const { data, error } = await supabase
      .from('reveal_status')
      .select('revealed')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return false;
    }

    return data ? data.revealed : false;
  }

  /**
   * Update reveal status for user in session
   */
  static async updateRevealStatus(sessionId, userId, revealed) {
    const { data, error } = await supabase
      .from('reveal_status')
      .upsert([{
        session_id: sessionId,
        user_id: userId,
        revealed: revealed,
        updated_at: new Date().toISOString()
      }], {
        onConflict: 'session_id,user_id'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get reveal status for both users in session
   */
  static async getSessionRevealStatus(sessionId) {
    // First get the session to know confessor and hitter IDs
    const session = await this.getChatSessionById(sessionId);
    if (!session) return null;

    const { data, error } = await supabase
      .from('reveal_status')
      .select('user_id, revealed')
      .eq('session_id', sessionId);

    if (error) throw error;

    const revealMap = {};
    if (data) {
      data.forEach(item => {
        revealMap[item.user_id] = item.revealed;
      });
    }

    return {
      confessor_revealed: revealMap[session.confessor_id] || false,
      hitter_revealed: revealMap[session.hitter_id] || false
    };
  }

  /**
   * Update chat session reveal status (legacy method for backward compatibility)
   * This method updates the reveal_status table instead of chat_sessions columns
   */
  static async updateChatSessionRevealStatus(sessionId, userId, isRevealed) {
    return await this.updateRevealStatus(sessionId, userId, isRevealed);
  }

  /**
   * End chat session
   */
  static async endChatSession(sessionId) {
    const { data, error } = await supabase
      .from('chat_sessions')
      .update({ 
        is_active: false, 
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get session statistics
   */
  static async getSessionStats() {
    try {
      // Get total sessions
      const { count: totalSessions } = await supabase
        .from('chat_sessions')
        .select('*', { count: 'exact', head: true });

      // Get active sessions
      const { count: activeSessions } = await supabase
        .from('chat_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Get completed sessions
      const { count: completedSessions } = await supabase
        .from('chat_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', false)
        .not('ended_at', 'is', null);

      // Get total messages
      const { count: totalMessages } = await supabase
        .from('anonymous_messages')
        .select('*', { count: 'exact', head: true });

      // Get total reveals
      const { count: totalReveals } = await supabase
        .from('reveal_status')
        .select('*', { count: 'exact', head: true })
        .eq('revealed', true);

      return {
        total: totalSessions || 0,
        active: activeSessions || 0,
        completed: completedSessions || 0,
        messages: totalMessages || 0,
        reveals: totalReveals || 0
      };
    } catch (error) {
      console.error('Error getting session stats:', error);
      return {
        total: 0,
        active: 0,
        completed: 0,
        messages: 0,
        reveals: 0
      };
    }
  }

  /**
   * Cleanup inactive sessions (sessions older than 24 hours)
   */
  static async cleanupInactiveSessions() {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data, error } = await supabase
      .from('chat_sessions')
      .update({ 
        is_active: false, 
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('is_active', true)
      .lt('created_at', twentyFourHoursAgo.toISOString())
      .is('ended_at', null)
      .select();

    if (error) throw error;
    return data ? data.length : 0;
  }

  /**
   * Get user's active session with detailed info
   */
  static async getUserActiveSessionDetailed(userId) {
    const { data, error } = await supabase
      .rpc('get_user_active_session', { p_user_id: userId });

    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  }

  static async syncSessionsWithDatabase() {
    try {
      console.log('=== SYNCING SESSIONS WITH DATABASE ===');

      // Get all active sessions from database
      const activeSessions = await Database.getActiveSessions();
      console.log('Active sessions in database:', activeSessions.length);

      // Check each session in database
      for (const session of activeSessions) {
        const confessorInMemory = this.activeChatUsers.has(session.confessor_id);
        const hitterInMemory = this.activeChatUsers.has(session.hitter_id);

        console.log(`Session ${session.id}: confessor_in_memory=${confessorInMemory}, hitter_in_memory=${hitterInMemory}`);

        // If session exists in database but both users are not in memory, 
        // it's an orphaned session - clean it up
        if (!confessorInMemory && !hitterInMemory) {
          console.log(`Cleaning up orphaned session ${session.id}`);
          await Database.endChatSession(session.id);
          continue;
        }

        // If only one user is in memory, remove the orphaned memory entry
        if (confessorInMemory && !hitterInMemory) {
          console.log(`Removing orphaned confessor ${session.confessor_id} from memory`);
          this.activeChatUsers.delete(session.confessor_id);
          await Database.endChatSession(session.id);
        } else if (!confessorInMemory && hitterInMemory) {
          console.log(`Removing orphaned hitter ${session.hitter_id} from memory`);
          this.activeChatUsers.delete(session.hitter_id);
          await Database.endChatSession(session.id);
        }
      }

      // Also check memory entries that don't exist in database
      const memoryUserIds = Array.from(this.activeChatUsers.keys());
      for (const userId of memoryUserIds) {
        const userChatData = this.activeChatUsers.get(userId);
        const sessionExists = activeSessions.some(session => 
          session.id === userChatData.sessionId && session.is_active
        );

        if (!sessionExists) {
          console.log(`Removing user ${userId} from memory - session not found in database`);
          this.activeChatUsers.delete(userId);
        }
      }

      console.log('Session sync completed');

    } catch (error) {
      console.error('Error syncing sessions with database:', error);
    }
  }

  /**
   * Force cleanup user session - for when user gets stuck
   */
  static async forceCleanupUserSession(userId) {
    try {
      console.log(`=== FORCE CLEANUP FOR USER ${userId} ===`);

      // Remove from memory
      if (this.activeChatUsers.has(userId)) {
        const chatData = this.activeChatUsers.get(userId);
        console.log(`Removing user ${userId} from memory (session: ${chatData.sessionId})`);

        // Also remove partner if exists
        if (chatData.partnerId && this.activeChatUsers.has(chatData.partnerId)) {
          console.log(`Also removing partner ${chatData.partnerId} from memory`);
          this.activeChatUsers.delete(chatData.partnerId);
        }

        // End session in database
        await Database.endChatSession(chatData.sessionId);
        console.log(`Ended session ${chatData.sessionId} in database`);

        this.activeChatUsers.delete(userId);
      }

      // Also check database for any active sessions for this user
      const userActiveSessions = await Database.getActiveChatSession(userId);
      if (userActiveSessions) {
        console.log(`Found active session in database for user ${userId}, cleaning up...`);
        await Database.endChatSession(userActiveSessions.id);
      }

      console.log(`Force cleanup completed for user ${userId}`);
      return true;

    } catch (error) {
      console.error(`Error in force cleanup for user ${userId}:`, error);
      return false;
    }
  }
}