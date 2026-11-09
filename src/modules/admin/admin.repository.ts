import { prisma } from "../../lib/prisma.js";

export const adminRepository = {
  async listMerchants() {
    return prisma.merchant.findMany({
      select: { id: true, name: true, slug: true, isActive: true },
      orderBy: { id: "asc" },
    });
  },

  async getDashboardStats() {
    const [merchants, pendingApplications, paidOrders, paidVolume] = await Promise.all([
      prisma.merchant.count({ where: { isActive: true } }),
      prisma.merchantApplication.count({ where: { status: "PENDING" } }),
      prisma.order.count({ where: { status: "PAID" } }),
      prisma.order.aggregate({ where: { status: "PAID" }, _sum: { total: true } }),
    ]);
    return {
      merchants,
      pendingApplications,
      paidOrders,
      totalVolume: paidVolume._sum.total?.toFixed(0) ?? "0",
    };
  },
};
