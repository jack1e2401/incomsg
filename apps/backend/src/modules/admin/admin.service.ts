import { adminRepository } from "./admin.repository.js";

export const adminService = {
  listMerchants() {
    return adminRepository.listMerchants();
  },

  getDashboardStats() {
    return adminRepository.getDashboardStats();
  },
};
