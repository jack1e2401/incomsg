import { Prisma } from "../../generated/prisma/client.js";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { describeTransaction, describeWallet } from "../loyalty/loyalty.balance.js";
import { defaultTiers } from "../loyalty/loyalty.config.js";
import { toOrderDto } from "../orders/orders.serialization.js";
import { computeCustomerStats, resolveMemberTier } from "./customers.domain.js";
import type {
  CustomerDetailDto,
  CustomerListQuery,
  CustomerSummaryDto,
  PaginationDto,
} from "./customers.types.js";

export async function listMerchantCustomers(
  merchantId: number,
  query: CustomerListQuery,
): Promise<{ items: CustomerSummaryDto[]; pagination: PaginationDto }> {
  const [memberships, configuredTiers, orderGroups] = await prisma.$transaction([
    prisma.merchantMembership.findMany({
      where: {
        merchantId,
        ...(query.q ? { member: { email: { contains: query.q } } } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        member: { select: { id: true, email: true } },
        wallet: {
          include: {
            _count: { select: { transactions: { where: { type: "EARN" } } } },
          },
        },
      },
    }),
    prisma.loyaltyTier.findMany({
      where: { merchantId },
      orderBy: { minLifetimePoints: "asc" },
    }),
    prisma.order.groupBy({
      by: ["memberId", "status"],
      where: {
        merchantId,
        status: { in: ["PAID", "REFUND_PENDING"] },
      },
      orderBy: [{ memberId: "asc" }, { status: "asc" }],
      _count: { _all: true },
      _sum: { total: true },
      _max: { paidAt: true },
    }),
  ]);

  const tiers = configuredTiers.length ? configuredTiers : defaultTiers;
  const statsByMember = new Map<
    number,
    {
      paidOrderCount: number;
      refundPendingOrderCount: number;
      paidSpend: Prisma.Decimal;
      refundPendingSpend: Prisma.Decimal;
      lastPurchaseAt: Date | null;
    }
  >();

  for (const row of orderGroups) {
    const entry = statsByMember.get(row.memberId) ?? {
      paidOrderCount: 0,
      refundPendingOrderCount: 0,
      paidSpend: new Prisma.Decimal(0),
      refundPendingSpend: new Prisma.Decimal(0),
      lastPurchaseAt: null,
    };
    const count = typeof row._count === "object" && row._count !== null ? row._count._all ?? 0 : 0;
    const sum = row._sum?.total ?? new Prisma.Decimal(0);
    const maxPaidAt = row._max?.paidAt ?? null;
    if (row.status === "PAID") {
      entry.paidOrderCount += count;
      entry.paidSpend = entry.paidSpend.plus(sum);
    } else if (row.status === "REFUND_PENDING") {
      entry.refundPendingOrderCount += count;
      entry.refundPendingSpend = entry.refundPendingSpend.plus(sum);
    }
    if (maxPaidAt && (!entry.lastPurchaseAt || maxPaidAt > entry.lastPurchaseAt)) {
      entry.lastPurchaseAt = maxPaidAt;
    }
    statsByMember.set(row.memberId, entry);
  }

  const summaries: CustomerSummaryDto[] = memberships.map((membership) => {
    const walletInfo = describeWallet(membership.wallet);
    const tier = resolveMemberTier({
      tierId: membership.tierId,
      hasEarnTransaction: (membership.wallet?._count.transactions ?? 0) > 0,
      netLifetimeEarned: walletInfo.netLifetimeEarned,
      tiers,
    });
    const orderStats = statsByMember.get(membership.memberId);
    const paidOrderCount = orderStats?.paidOrderCount ?? 0;
    const refundPendingOrderCount = orderStats?.refundPendingOrderCount ?? 0;
    const refundPendingSpend = orderStats?.refundPendingSpend ?? new Prisma.Decimal(0);
    const netSpend = (orderStats?.paidSpend ?? new Prisma.Decimal(0)).plus(refundPendingSpend);

    return {
      memberId: membership.member.id,
      email: membership.member.email,
      joinedAt: membership.createdAt.toISOString(),
      tier,
      availablePoints: walletInfo.availablePoints,
      exactBalance: walletInfo.exactBalance,
      fractionalCarry: walletInfo.fractionalCarry,
      netLifetimeEarned: walletInfo.netLifetimeEarned,
      pointDebt: walletInfo.pointDebt,
      paidOrderCount,
      refundPendingOrderCount,
      refundPendingSpendVnd: refundPendingSpend.toFixed(0),
      netSpendVnd: netSpend.toFixed(0),
      lastPurchaseAt: orderStats?.lastPurchaseAt ? orderStats.lastPurchaseAt.toISOString() : null,
    };
  });

  const filtered = summaries.filter((item) => {
    if (query.tier && item.tier !== query.tier) return false;
    const qualifyingOrders = item.paidOrderCount + item.refundPendingOrderCount;
    if (query.purchaseStatus === "buyers" && qualifyingOrders === 0) return false;
    if (query.purchaseStatus === "non_buyers" && qualifyingOrders > 0) return false;
    return true;
  });

  const totalItems = filtered.length;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / query.limit);
  const start = (query.page - 1) * query.limit;
  const items = filtered.slice(start, start + query.limit);

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      totalItems,
      totalPages,
    },
  };
}

export async function getMerchantCustomerDetail(
  merchantId: number,
  memberId: number,
): Promise<{ customer: CustomerDetailDto }> {
  const membership = await prisma.merchantMembership.findUnique({
    where: { memberId_merchantId: { memberId, merchantId } },
    include: {
      member: { select: { id: true, email: true } },
      wallet: {
        include: {
          transactions: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 50,
          },
          _count: { select: { transactions: { where: { type: "EARN" } } } },
        },
      },
    },
  });

  if (!membership) {
    throw new HttpError(404, "MEMBER_NOT_FOUND");
  }

  const [rule, configuredTiers, vouchers, orders] = await prisma.$transaction([
    prisma.loyaltyRule.findUnique({ where: { merchantId } }),
    prisma.loyaltyTier.findMany({ where: { merchantId }, orderBy: { minLifetimePoints: "asc" } }),
    prisma.memberVoucher.findMany({
      where: { membershipId: membership.id },
      include: { membership: true, activeReservation: true },
      orderBy: [{ redeemedAt: "desc" }, { id: "desc" }],
    }),
    prisma.order.findMany({
      where: { merchantId, memberId },
      include: {
        items: true,
        pointTransactions: true,
        paymentAttempt: true,
        refund: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
  ]);

  const tiers = configuredTiers.length ? configuredTiers : defaultTiers;
  const walletInfo = describeWallet(membership.wallet);
  const tier = resolveMemberTier({
    tierId: membership.tierId,
    hasEarnTransaction: (membership.wallet?._count.transactions ?? 0) > 0,
    netLifetimeEarned: walletInfo.netLifetimeEarned,
    tiers,
  });

  return {
    customer: {
      member: {
        id: membership.member.id,
        email: membership.member.email,
        joinedAt: membership.createdAt.toISOString(),
      },
      stats: computeCustomerStats(orders),
      wallet: {
        merchantId,
        policy: {
          merchantId,
          vndPerPoint: rule?.vndPerPoint ?? 10000,
          isActive: rule?.isActive ?? true,
          tiers: tiers.map((t) => ({
            level: t.level,
            minLifetimePoints: t.minLifetimePoints,
            multiplier: typeof t.multiplier === "string" ? t.multiplier : t.multiplier.toFixed(2),
          })),
        },
        ...walletInfo,
        tier,
      },
      pointLedger: (membership.wallet?.transactions ?? []).map((entry) => ({
        id: entry.id,
        type: entry.type,
        ...describeTransaction(entry),
        reason: entry.reason,
        eventRef: entry.eventRef,
        source: entry.source,
        actorId: entry.actorId,
        orderId: entry.orderId,
        memberVoucherId: entry.memberVoucherId,
        createdAt: entry.createdAt.toISOString(),
      })),
      vouchers: vouchers.map((v) => ({
        id: v.id,
        definitionId: v.definitionId,
        merchantId: v.membership.merchantId,
        memberId: v.membership.memberId,
        title: v.snapshotTitle,
        type: v.snapshotType,
        status: v.status,
        reserved: v.status === "AVAILABLE" && Boolean(v.activeReservation),
        pointsCost: v.snapshotPointsCost,
        discountAmount: v.snapshotDiscountAmount?.toFixed(0) ?? null,
        rewardDescription: v.snapshotRewardDescription,
        redeemedAt: v.redeemedAt.toISOString(),
        usedAt: v.usedAt?.toISOString() ?? null,
      })),
      orders: orders.map(toOrderDto),
    },
  };
}
