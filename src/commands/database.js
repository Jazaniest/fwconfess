/**
 * Backward-compatibility shim.
 *
 * This file re-exports every function from the split repository files as
 * static methods on the `Database` class so that existing callers don't break
 * during the migration.  Once all files have been updated to import directly
 * from the `repositories/` modules, this shim can be deleted.
 *
 * DO NOT add new business logic here — put it in the appropriate repo file.
 */

import * as userRepo       from '../repositories/user.repo.js';
import * as confessionRepo from '../repositories/confession.repo.js';
import * as chatRepo       from '../repositories/chat.repo.js';
import * as reportRepo     from '../repositories/report.repo.js';
import * as banRepo        from '../repositories/ban.repo.js';
import * as configRepo     from '../repositories/config.repo.js';

export class Database {
  // ─── User ────────────────────────────────────────────────────────────────
  static getUserById(id)                          { return userRepo.getUserById(id); }
  static getUserFullProfile(id)                   { return userRepo.getUserFullProfile(id); }
  static getUsersPaginated(limit, offset)         { return userRepo.getUsersPaginated(limit, offset); }
  static countAllUsers()                          { return userRepo.countAllUsers(); }
  static getTotalUsers()                          { return userRepo.getTotalUsers(); }
  static searchUsers(q, limit, offset)            { return userRepo.searchUsers(q, limit, offset); }
  static countSearchUsers(q)                      { return userRepo.countSearchUsers(q); }
  static getBannedUsersPaginated(limit, offset)   { return userRepo.getBannedUsersPaginated(limit, offset); }
  static getBannedUsersCount()                    { return userRepo.getBannedUsersCount(); }
  static countNewUsers()                          { return userRepo.countNewUsers(); }
  static getActiveUsersToday()                    { return userRepo.getActiveUsersToday(); }
  static updateUserRank(id, rank)                 { return userRepo.updateUserRank(id, rank); }
  static setUserActive(id, active)                { return userRepo.setUserActive(id, active); }
  static updateUsername(id, username)             { return userRepo.updateUsername(id, username); }
  static getTopUsersByAction(type, limit)         { return userRepo.getTopUsersByAction(type, limit); }
  static getTotalUserConfessions(id)              { return userRepo.getTotalUserConfessions(id); }

  // Legacy name used in server.js admin panel
  static banUser(id)                              { return banRepo.banUser(id); }
  static unbanUser(id)                            { return banRepo.unbanUser(id); }

  // ─── Confession ──────────────────────────────────────────────────────────
  static saveConfession(id, text, msgId)                          { return confessionRepo.saveConfession(id, text, msgId); }
  static getConfessionsByUserId(id, limit)                        { return confessionRepo.getConfessionsByUserId(id, limit); }
  static getConfessionByChannelMessageId(msgId)                   { return confessionRepo.getConfessionByChannelMessageId(msgId); }
  static getLatestConfessionByUserId(id)                          { return confessionRepo.getLatestConfessionByUserId(id); }
  static getTotalConfessions()                                     { return confessionRepo.getTotalConfessions(); }
  static countRecentConfessions(id, windowMs)                     { return confessionRepo.countRecentConfessions(id, windowMs); }
  static getLastConfessionTime(id, windowMs)                      { return confessionRepo.getLastConfessionTime(id, windowMs); }
  static recordConfessionSent(id)                                  { return confessionRepo.recordConfessionSent(id); }
  static countRecentActions(id, type, windowMs)                   { return confessionRepo.countRecentActions(id, type, windowMs); }
  static getOldestActionTime(id, type, windowMs)                  { return confessionRepo.getOldestActionTime(id, type, windowMs); }
  static recordActionSent(id, type)                               { return confessionRepo.recordActionSent(id, type); }
  static cleanupOldRateLimits(windowMs)                           { return confessionRepo.cleanupOldRateLimits(windowMs); }
  static getActionLimitByRank(rank, type)                         { return confessionRepo.getActionLimitByRank(rank, type); }
  static getConfessionLimitByRank(rank)                           { return confessionRepo.getConfessionLimitByRank(rank); }
  static getAllRankLimits()                                        { return confessionRepo.getAllRankLimits(); }
  static updateRankLimit(rank, type, max, active)                 { return confessionRepo.updateRankLimit(rank, type, max, active); }
  static getActiveRanks()                                         { return confessionRepo.getActiveRanks(); }
  static getEffectiveRank(id)                                     { return confessionRepo.getEffectiveRank(id); }

  // ─── Chat ────────────────────────────────────────────────────────────────
  static createChatSession(confId, confessorId, hitterId)         { return chatRepo.createChatSession(confId, confessorId, hitterId); }
  static getActiveChatSession(userId)                             { return chatRepo.getActiveChatSession(userId); }
  static getActiveSessions()                                      { return chatRepo.getActiveSessions(); }
  static getChatSessionByCode(code)                               { return chatRepo.getChatSessionByCode(code); }
  static getChatSessionById(id)                                   { return chatRepo.getChatSessionById(id); }
  static endChatSession(id)                                       { return chatRepo.endChatSession(id); }
  static saveAnonymousMessage(sessionId, senderId, text, type)    { return chatRepo.saveAnonymousMessage(sessionId, senderId, text, type); }
  static getChatHistory(sessionId, limit)                         { return chatRepo.getChatHistory(sessionId, limit); }
  static checkRevealStatus(sessionId, userId)                     { return chatRepo.checkRevealStatus(sessionId, userId); }
  static updateRevealStatus(sessionId, userId, revealed)          { return chatRepo.updateRevealStatus(sessionId, userId, revealed); }
  static getSessionRevealStatus(sessionId)                        { return chatRepo.getSessionRevealStatus(sessionId); }
  static updateChatSessionRevealStatus(sessionId, userId, val)    { return chatRepo.updateChatSessionRevealStatus(sessionId, userId, val); }
  static getSessionStats()                                        { return chatRepo.getSessionStats(); }
  static getChatStats()                                           { return chatRepo.getChatStats(); }
  static cleanupInactiveSessions()                                { return chatRepo.cleanupInactiveSessions(); }
  static getUserActiveSessionDetailed(userId)                     { return chatRepo.getUserActiveSessionDetailed(userId); }

  // ─── Report ──────────────────────────────────────────────────────────────
  static saveReport(reporterId, targetId, reason)                 { return reportRepo.saveReport(reporterId, targetId, reason); }
  static hasUserReported(reporterId, confessionId)                { return reportRepo.hasUserReported(reporterId, confessionId); }
  static getReportWithDetail(id)                                  { return reportRepo.getReportWithDetail(id); }
  static getReportsPaginated(status, limit, offset)               { return reportRepo.getReportsPaginated(status, limit, offset); }
  static getTotalReports()                                        { return reportRepo.getTotalReports(); }
  static countAllReports()                                        { return reportRepo.countAllReports(); }
  static getReportStats()                                         { return reportRepo.getReportStats(); }
  static getRecentReports(limit)                                  { return reportRepo.getRecentReports(limit); }
  static updateReportStatus(id, status)                           { return reportRepo.updateReportStatus(id, status); }
  static deleteReport(id)                                         { return reportRepo.deleteReport(id); }

  // ─── Ban ─────────────────────────────────────────────────────────────────
  static getActiveBan(id)                                         { return banRepo.getActiveBan(id); }
  static createBan(id, type, reason, expiresAt, bannedBy)         { return banRepo.createBan(id, type, reason, expiresAt, bannedBy); }
  static createBanRecord(id, type, reason, expiresAt, bannedBy)   { return banRepo.createBanRecord(id, type, reason, expiresAt, bannedBy); }
  static removeBan(id, unbannedBy)                                { return banRepo.removeBan(id, unbannedBy); }
  static getBanHistory(id, limit)                                 { return banRepo.getBanHistory(id, limit); }
  static getActiveBansCount()                                     { return banRepo.getActiveBansCount(); }

  // ─── Config ──────────────────────────────────────────────────────────────
  static getConfig(key, defaultValue)                             { return configRepo.getConfig(key, defaultValue); }
  static getConfigs(keys)                                         { return configRepo.getConfigs(keys); }
  static setConfig(key, value)                                    { return configRepo.setConfig(key, value); }
}