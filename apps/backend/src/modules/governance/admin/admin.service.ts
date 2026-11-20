import { adminRepository } from "./admin.repository.js";
import { adminModerationRepository, type AdminActor } from "./admin.moderation.repository.js";

export const adminService = {
  listMerchants() {
    return adminRepository.listMerchants();
  },

  getDashboardStats() {
    return adminRepository.getDashboardStats();
  },

  listUsers(query: Parameters<typeof adminRepository.listUsers>[0]) {
    return adminRepository.listUsers(query);
  },

  listBlacklist(query: Parameters<typeof adminRepository.listBlacklist>[0]) {
    return adminRepository.listBlacklist(query);
  },

  listAuditLogs(query: Parameters<typeof adminRepository.listAuditLogs>[0]) {
    return adminRepository.listAuditLogs(query);
  },

  listAbuseReports(query: Parameters<typeof adminRepository.listAbuseReports>[0]) {
    return adminRepository.listAbuseReports(query);
  },

  changeUserStatus(userId: number, status: "ACTIVE" | "SUSPENDED" | "BANNED", reason: string, actor: AdminActor) {
    return adminModerationRepository.changeUserStatus(userId, status, reason, actor);
  },

  changeMerchantStatus(merchantId: number, isActive: boolean, reason: string, actor: AdminActor) {
    return adminModerationRepository.changeMerchantStatus(merchantId, isActive, reason, actor);
  },

  addBlacklist(email: string, reason: string, actor: AdminActor) {
    return adminModerationRepository.addBlacklist(email, reason, actor);
  },

  deactivateBlacklist(entryId: number, reason: string, actor: AdminActor) {
    return adminModerationRepository.deactivateBlacklist(entryId, reason, actor);
  },
};
