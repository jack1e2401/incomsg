import type { AccountStatus, AdminAuditAction, AdminAuditTargetType, UserRole } from "../../generated/prisma/enums.js";
import { prisma } from "../../lib/prisma.js";

type PageQuery = { cursor: number | null; limit: number };

function pageResult<T extends { id: number }>(rows: T[], limit: number) {
  const items = rows.slice(0, limit);
  return { items, nextCursor: rows.length > limit ? String(items[items.length - 1]!.id) : null };
}

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

  async listUsers(query: PageQuery & { search?: string; status?: AccountStatus; role?: UserRole }) {
    const rows = await prisma.user.findMany({
      where: {
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
        ...(query.search ? { email: { contains: query.search } } : {}),
        ...(query.status ? { accountStatus: query.status } : {}),
        ...(query.role ? { role: query.role } : {}),
      },
      orderBy: { id: "desc" },
      take: query.limit + 1,
      select: { id: true, email: true, role: true, accountStatus: true, createdAt: true },
    });
    const result = pageResult(rows, query.limit);
    return {
      items: result.items.map((user) => ({ ...user, isActive: user.accountStatus === "ACTIVE" })),
      nextCursor: result.nextCursor,
    };
  },

  async listBlacklist(query: PageQuery & { search?: string; active?: boolean }) {
    const rows = await prisma.emailBlacklistEntry.findMany({
      where: {
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
        ...(query.search ? { email: { contains: query.search } } : {}),
        ...(query.active === undefined ? {} : { isActive: query.active }),
      },
      orderBy: { id: "desc" },
      take: query.limit + 1,
      select: { id: true, email: true, reason: true, isActive: true, lastActorId: true, lastActorEmail: true, createdAt: true, updatedAt: true },
    });
    return pageResult(rows, query.limit);
  },

  async listAuditLogs(query: PageQuery & {
    actorId?: number;
    action?: AdminAuditAction;
    targetType?: AdminAuditTargetType;
    targetId?: number;
    from?: Date;
    to?: Date;
  }) {
    const rows = await prisma.adminAuditLog.findMany({
      where: {
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
        ...(query.actorId ? { actorId: query.actorId } : {}),
        ...(query.action ? { action: query.action } : {}),
        ...(query.targetType ? { targetType: query.targetType } : {}),
        ...(query.targetId ? { targetId: query.targetId } : {}),
        ...(query.from || query.to ? { createdAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } } : {}),
      },
      orderBy: { id: "desc" },
      take: query.limit + 1,
      select: { id: true, actorId: true, actorEmail: true, action: true, targetType: true, targetId: true, reason: true, before: true, after: true, createdAt: true },
    });
    return pageResult(rows, query.limit);
  },
};
