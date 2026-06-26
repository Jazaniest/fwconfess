/**
 * database.js — BARREL RE-EXPORT
 *
 * Semua query database telah dipindah ke src/repositories/ per domain.
 * File ini tetap ada untuk backward compatibility.
 *
 * 11 file masih mengimpor Database class dari sini.
 * Jika nanti semua impor diarahkan ke repo langsung,
 * file ini bisa dihapus.
 */
import * as UserRepo from '../repositories/user.repo.js';
import * as ConfessionRepo from '../repositories/confession.repo.js';
import * as ChatRepo from '../repositories/chat.repo.js';
import * as ReportRepo from '../repositories/report.repo.js';
import * as BanRepo from '../repositories/ban.repo.js';
import * as ConfigRepo from '../repositories/config.repo.js';
import {
  dbCreateDaget,
  dbGetDagetById,
  dbGetActiveDagetan,
  dbMarkDagetDrawn,
  dbMarkDagetCancelled,
  dbSaveDagetWinners,
  dbGetDagetWinners,
  dbGetEligibleUsers,
} from '../repositories/daget.repo.js';

// ─── Database class — backward-compatible wrapper ───────────────────────────

export class Database {
  // ── User ──
  static getUserById             = UserRepo.getUserById;
  static getUserFullProfile      = UserRepo.getUserFullProfile;
  static getUsersPaginated       = UserRepo.getUsersPaginated;
  static countAllUsers           = UserRepo.countAllUsers;
  static getTotalUsers           = UserRepo.countAllUsers; // alias
  static searchUsers             = UserRepo.searchUsers;
  static countSearchUsers        = UserRepo.countSearchUsers;
  static getBannedUsersPaginated = UserRepo.getBannedUsersPaginated;
  static countNewUsers           = UserRepo.countNewUsers;
  static getTotalUserConfessions = UserRepo.getTotalUserConfessions;
  static getTopUsersByAction     = UserRepo.getTopUsersByAction;
  static getPrivacySettings      = UserRepo.getPrivacySettings;
  static setPrivacyField         = UserRepo.setPrivacyField;
  static updateOrigin            = UserRepo.updateOrigin;
  static updateGender            = UserRepo.updateGender;
  static updateUsername          = UserRepo.updateUsername;
  static recordReferralPayout    = UserRepo.recordReferralPayout;
  static getCoFounders           = UserRepo.getCoFounders;
  static setUserCoFounderStatus  = UserRepo.setUserCoFounderStatus;
  static getActiveUsersToday     = UserRepo.getActiveUsersToday;
  static getBannedUsersCount     = UserRepo.getBannedUsersCount;

  // ── Confession ──
  static saveConfession               = ConfessionRepo.saveConfession;
  static getConfessionsByUserId       = ConfessionRepo.getConfessionsByUserId;
  static getConfessionByChannelMessageId = ConfessionRepo.getConfessionByChannelMessageId;
  static getTotalConfessions          = ConfessionRepo.getTotalConfessions;
  static getLatestConfessionByUserId  = ConfessionRepo.getLatestConfessionByUserId;
  static countRecentActions           = ConfessionRepo.countRecentActions;
  static getOldestActionTime          = ConfessionRepo.getOldestActionTime;
  static recordActionSent             = ConfessionRepo.recordActionSent;
  static cleanupOldRateLimits         = ConfessionRepo.cleanupOldRateLimits;
  static countRecentConfessions       = ConfessionRepo.countRecentConfessions;
  static getLastConfessionTime        = ConfessionRepo.getLastConfessionTime;
  static recordConfessionSent         = ConfessionRepo.recordConfessionSent;
  static getActionLimitByRank         = ConfessionRepo.getActionLimitByRank;
  static getConfessionLimitByRank     = ConfessionRepo.getConfessionLimitByRank;
  static getEffectiveRank             = ConfessionRepo.getEffectiveRank;

  // ── Chat ──
  static createChatSession             = ChatRepo.createChatSession;
  static getActiveChatSession          = ChatRepo.getActiveChatSession;
  static getActiveSessions             = ChatRepo.getActiveSessions;
  static getChatSessionByCode          = ChatRepo.getChatSessionByCode;
  static getChatSessionById            = ChatRepo.getChatSessionById;
  static saveAnonymousMessage          = ChatRepo.saveAnonymousMessage;
  static getChatHistory                = ChatRepo.getChatHistory;
  static checkRevealStatus             = ChatRepo.checkRevealStatus;
  static updateRevealStatus            = ChatRepo.updateRevealStatus;
  static getSessionRevealStatus        = ChatRepo.getSessionRevealStatus;
  static updateChatSessionRevealStatus = ChatRepo.updateChatSessionRevealStatus;
  static endChatSession                = ChatRepo.endChatSession;
  static getSessionStats               = ChatRepo.getSessionStats;
  static cleanupInactiveSessions       = ChatRepo.cleanupInactiveSessions;
  static getUserActiveSessionDetailed  = ChatRepo.getUserActiveSessionDetailed;

  // ── Report ──
  static hasUserReported     = ReportRepo.hasUserReported;
  static getReportWithDetail = ReportRepo.getReportWithDetail;
  static getReportsPaginated = ReportRepo.getReportsPaginated;
  static saveReport          = ReportRepo.saveReport;
  static getTotalReports     = ReportRepo.getTotalReports;
  static getReportStats      = ReportRepo.getReportStats;
  static getRecentReports    = ReportRepo.getRecentReports;
  static updateReportStatus  = ReportRepo.updateReportStatus;

  // ── Ban ──
  static getActiveBan     = BanRepo.getActiveBan;
  static createBan        = BanRepo.createBan;
  static removeBan        = BanRepo.removeBan;
  static getBanHistory    = BanRepo.getBanHistory;
  static getActiveBansCount = BanRepo.getActiveBansCount;
  static banUser          = BanRepo.banUser;
  static unbanUser        = BanRepo.unbanUser;

  // ── Config ──
  static getConfig          = ConfigRepo.getConfig;
  static getConfigs         = ConfigRepo.getConfigs;
  static setConfig          = ConfigRepo.setConfig;
  static getAllRankLimits   = ConfigRepo.getAllRankLimits;
  static updateRankLimit    = ConfigRepo.updateRankLimit;
  static updateRankPrices   = ConfigRepo.updateRankPrices;
  static getAllReferralRewards = ConfigRepo.getAllReferralRewards;
  static updateReferralReward = ConfigRepo.updateReferralReward;
  static getActiveRanks     = ConfigRepo.getActiveRanks;
  static saveDonation       = ConfigRepo.saveDonation;
  static getTotalDonations  = ConfigRepo.getTotalDonations;
  static getTopDonators     = ConfigRepo.getTopDonators;
  static getRecentDonations = ConfigRepo.getRecentDonations;
  static getTotalDonationCount = ConfigRepo.getTotalDonationCount;
}

// ─── Standalone exports (daget) ─────────────────────────────────────────────

export {
  dbCreateDaget,
  dbGetDagetById,
  dbGetActiveDagetan,
  dbMarkDagetDrawn,
  dbMarkDagetCancelled,
  dbSaveDagetWinners,
  dbGetDagetWinners,
  dbGetEligibleUsers,
};
