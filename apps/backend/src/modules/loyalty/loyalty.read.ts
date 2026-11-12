import { Prisma } from "../../generated/prisma/client.js";
import type { PointTransactionType } from "../../generated/prisma/enums.js";
import { prisma } from "../../lib/prisma.js";
import { defaultTiers } from "./loyalty.config.js";
import { describeTransaction, describeWallet, exactPoints } from "./loyalty.balance.js";
import { calculateEarnedPoints, selectTier, type TierLevel } from "./loyalty.calculation.js";
import { HttpError } from "../../lib/http-error.js";

export const VALID_TRANSACTION_TYPES: readonly PointTransactionType[] = [
  "EARN",
  "REDEEM_DISCOUNT",
  "REDEEM_REWARD",
  "EARN_REVERSAL",
  "REDEMPTION_REVERSAL",
];

async function readWallet(memberId: number, merchantId: number) {
  return prisma.$transaction(async (tx) => {
    const merchant = await tx.merchant.findFirst({ where: { id: merchantId, isActive: true }, select: { id: true } });
    if (!merchant) return "merchant_missing" as const;
    const [membership, rule, configuredTiers] = await Promise.all([
      tx.merchantMembership.findUnique({
        where: { memberId_merchantId: { memberId, merchantId } },
        include: {
          member: { select: { id: true, email: true } },
          wallet: { include: { transactions: { orderBy: [{ createdAt: "desc" }, { id: "desc" }] } } },
        },
      }),
      tx.loyaltyRule.findUnique({ where: { merchantId } }),
      tx.loyaltyTier.findMany({ where: { merchantId }, orderBy: { minLifetimePoints: "asc" } }),
    ]);
    const tiers = configuredTiers.length ? configuredTiers : defaultTiers;
    const ranked = membership && (membership.tierId !== null || membership.wallet?.transactions.some((entry) => entry.type === "EARN"));
    const wallet = {
      merchantId,
      policy: {
        merchantId, vndPerPoint: rule?.vndPerPoint ?? 10000, isActive: rule?.isActive ?? true,
        tiers: tiers.map((tier) => ({ level: tier.level, minLifetimePoints: tier.minLifetimePoints, multiplier: typeof tier.multiplier === "string" ? tier.multiplier : tier.multiplier.toFixed(2) })),
      },
      ...describeWallet(membership?.wallet),
      tier: ranked ? selectTier(membership.wallet?.netLifetimeEarned ?? "0", tiers) ?? "UNRANKED" : "UNRANKED",
      transactions: (membership?.wallet?.transactions ?? []).map((entry) => ({
        id: entry.id, type: entry.type, ...describeTransaction(entry), reason: entry.reason,
        eventRef: entry.eventRef, source: entry.source, actorId: entry.actorId,
        orderId: entry.orderId, memberVoucherId: entry.memberVoucherId, createdAt: entry.createdAt.toISOString(),
      })),
    };
    return { member: membership?.member ?? null, wallet };
  });
}

export async function getWallet(memberId: number, merchantId: number) {
  const result = await readWallet(memberId, merchantId);
  return result === "merchant_missing" ? result : result.wallet;
}

export async function getMerchantMemberWallet(merchantId: number, memberId: number) {
  const result = await readWallet(memberId, merchantId);
  if (result === "merchant_missing") throw new HttpError(404, "MERCHANT_NOT_FOUND");
  if (!result.member) throw new HttpError(404, "MEMBER_NOT_FOUND");
  return { member: result.member, wallet: result.wallet };
}

export type MerchantMemberFilters = { email?: string; cursor?: number; limit: number };

export async function listMerchantMembers(merchantId: number, { email, cursor, limit }: MerchantMemberFilters) {
  const [memberships, configuredTiers] = await prisma.$transaction([
    prisma.merchantMembership.findMany({
      where: {
        merchantId,
        ...(cursor !== undefined ? { id: { lt: cursor } } : {}),
        ...(email ? { member: { email: { contains: email } } } : {}),
      },
      orderBy: { id: "desc" },
      take: limit + 1,
      include: {
        member: { select: { id: true, email: true } },
        wallet: {
          include: {
            transactions: {
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: 1,
              select: { type: true, delta: true, createdAt: true },
            },
            _count: { select: { transactions: { where: { type: "EARN" } } } },
          },
        },
      },
    }),
    prisma.loyaltyTier.findMany({ where: { merchantId }, orderBy: { minLifetimePoints: "asc" } }),
  ]);
  const tiers = configuredTiers.length ? configuredTiers : defaultTiers;
  const page = memberships.slice(0, limit);
  return {
    items: page.map(({ member, wallet, tierId }) => {
      const { availablePoints, netLifetimeEarned, pointDebt } = describeWallet(wallet);
      const ranked = tierId !== null || (wallet?._count.transactions ?? 0) > 0;
      const tier = ranked ? selectTier(netLifetimeEarned, tiers) ?? "UNRANKED" : "UNRANKED";
      const latest = wallet?.transactions[0];
      return {
        ...member,
        availablePoints,
        netLifetimeEarned,
        pointDebt,
        tier,
        latestChange: latest ? {
          type: latest.type,
          delta: exactPoints(latest.delta),
          createdAt: latest.createdAt.toISOString(),
        } : null,
      };
    }),
    nextCursor: memberships.length > limit ? page.at(-1)!.id : null,
  };
}

export async function previewMemberEarning(memberId: number, merchantId: number, netOrderAmountVnd: string) {
  if (!/^\d+$/.test(netOrderAmountVnd)) throw new HttpError(400, "INVALID_INPUT");
  const [merchant, rule, configuredTiers, membership] = await Promise.all([
    prisma.merchant.findFirst({ where: { id: merchantId, isActive: true }, select: { id: true } }),
    prisma.loyaltyRule.findUnique({ where: { merchantId } }),
    prisma.loyaltyTier.findMany({ where: { merchantId }, orderBy: { minLifetimePoints: "asc" } }),
    prisma.merchantMembership.findUnique({
      where: { memberId_merchantId: { memberId, merchantId } },
      include: { wallet: true },
    }),
  ]);
  if (!merchant) throw new HttpError(404, "MERCHANT_NOT_FOUND");
  const tiers = configuredTiers.length ? configuredTiers : defaultTiers;
  const active = rule?.isActive ?? true;
  const vndPerPoint = rule?.vndPerPoint ?? 10000;
  const currentLevel = selectTier(membership?.wallet?.netLifetimeEarned ?? "0", tiers) ?? "BRONZE";
  const tier = tiers.find((t) => t.level === currentLevel)!;
  const multiplier = typeof tier.multiplier === "string" ? tier.multiplier : tier.multiplier.toFixed(2);
  let estimatedPointsExact = "0";
  if (active) {
    try {
      const calculated = calculateEarnedPoints(new Prisma.Decimal(netOrderAmountVnd), vndPerPoint, new Prisma.Decimal(tier.multiplier));
      estimatedPointsExact = exactPoints(calculated);
    } catch (error) {
      if (error instanceof RangeError) {
        throw new HttpError(400, error.message);
      }
      throw error;
    }
  }
  return {
    merchantId,
    active,
    netOrderAmountVnd,
    tierLevel: currentLevel,
    multiplier,
    vndPerPoint,
    estimatedPointsExact,
    policyUpdatedAt: rule?.updatedAt.toISOString() ?? new Date().toISOString(),
  };
}

export async function previewMerchantPolicy(merchantId: number, input: { netOrderAmountVnd: string; tierLevel?: TierLevel }) {
  if (!input.netOrderAmountVnd || !/^\d+$/.test(input.netOrderAmountVnd)) throw new HttpError(400, "INVALID_INPUT");
  const validTiers: TierLevel[] = ["BRONZE", "SILVER", "GOLD", "PLATINUM"];
  if (input.tierLevel && !validTiers.includes(input.tierLevel)) throw new HttpError(400, "INVALID_INPUT");
  const [rule, configuredTiers] = await Promise.all([
    prisma.loyaltyRule.findUnique({ where: { merchantId } }),
    prisma.loyaltyTier.findMany({ where: { merchantId }, orderBy: { minLifetimePoints: "asc" } }),
  ]);
  const tiers = configuredTiers.length ? configuredTiers : defaultTiers;
  const active = rule?.isActive ?? true;
  const vndPerPoint = rule?.vndPerPoint ?? 10000;
  const level: TierLevel = input.tierLevel ?? "BRONZE";
  const tier = tiers.find((t) => t.level === level) ?? defaultTiers.find((t) => t.level === level)!;
  const multiplier = typeof tier.multiplier === "string" ? tier.multiplier : tier.multiplier.toFixed(2);

  let exact = "0";
  let integerPart = 0;
  let fractionalPart = "0";
  if (active) {
    try {
      const calculated = calculateEarnedPoints(new Prisma.Decimal(input.netOrderAmountVnd), vndPerPoint, new Prisma.Decimal(tier.multiplier));
      exact = exactPoints(calculated);
      integerPart = calculated.floor().toNumber();
      fractionalPart = exactPoints(calculated.minus(calculated.floor()));
    } catch (error) {
      if (error instanceof RangeError) {
        throw new HttpError(400, error.message);
      }
      throw error;
    }
  }

  return {
    netOrderAmountVnd: input.netOrderAmountVnd,
    tierLevel: level,
    multiplier,
    vndPerPoint,
    active,
    estimatedPointsExact: exact,
    integerProjection: integerPart,
    fractionalProjection: fractionalPart,
    rounding: "HALF_UP" as const,
    scale: 12,
  };
}

export interface MerchantTransactionFilters {
  memberId?: number;
  orderId?: number;
  type?: PointTransactionType;
  from?: string;
  to?: string;
  cursor?: number;
  limit?: number;
}

export async function listMerchantTransactions(merchantId: number, filters: MerchantTransactionFilters) {
  if (filters.memberId !== undefined && (!Number.isInteger(filters.memberId) || filters.memberId <= 0)) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  if (filters.orderId !== undefined && (!Number.isInteger(filters.orderId) || filters.orderId <= 0)) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  if (filters.type !== undefined && !VALID_TRANSACTION_TYPES.includes(filters.type)) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  if (filters.from !== undefined) {
    const fromTime = Date.parse(filters.from);
    if (Number.isNaN(fromTime)) throw new HttpError(400, "INVALID_INPUT");
  }
  if (filters.to !== undefined) {
    const toTime = Date.parse(filters.to);
    if (Number.isNaN(toTime)) throw new HttpError(400, "INVALID_INPUT");
  }
  if (filters.cursor !== undefined && (!Number.isInteger(filters.cursor) || filters.cursor <= 0)) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  if (filters.limit !== undefined && (!Number.isInteger(filters.limit) || filters.limit <= 0)) {
    throw new HttpError(400, "INVALID_INPUT");
  }

  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
  const where: Prisma.PointTransactionWhereInput = {
    wallet: {
      membership: {
        merchantId,
        ...(filters.memberId ? { memberId: filters.memberId } : {}),
      },
    },
    ...(filters.orderId ? { orderId: filters.orderId } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.from || filters.to ? {
      createdAt: {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      },
    } : {}),
    ...(filters.cursor ? { id: { lt: filters.cursor } } : {}),
  };

  const records = await prisma.pointTransaction.findMany({
    where,
    include: {
      wallet: {
        include: {
          membership: {
            include: {
              member: { select: { email: true } },
            },
          },
        },
      },
      order: { select: { id: true, total: true, status: true } },
      memberVoucher: { select: { id: true, snapshotTitle: true, snapshotType: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasNext = records.length > limit;
  const pageRecords = hasNext ? records.slice(0, limit) : records;
  const nextCursor = hasNext && pageRecords.length > 0 ? pageRecords[pageRecords.length - 1]!.id : null;

  const items = pageRecords.map((entry) => {
    const desc = describeTransaction(entry);
    return {
      id: entry.id,
      eventRef: entry.eventRef,
      type: entry.type,
      delta: desc.delta,
      balanceAfter: desc.balanceAfter,
      availablePointsAfter: desc.availablePointsAfter,
      fractionalCarryAfter: desc.fractionalCarryAfter,
      pointDebtAfter: desc.pointDebtAfter,
      reason: entry.reason,
      source: entry.source,
      actorId: entry.actorId,
      orderId: entry.orderId,
      memberVoucherId: entry.memberVoucherId,
      createdAt: entry.createdAt.toISOString(),
      memberId: entry.wallet.membership.memberId,
      memberEmail: entry.wallet.membership.member.email,
      email: entry.wallet.membership.member.email,
      orderSummary: entry.order ? {
        id: entry.order.id,
        total: entry.order.total.toFixed(0),
        status: entry.order.status,
      } : null,
      voucherSummary: entry.memberVoucher ? {
        id: entry.memberVoucher.id,
        title: entry.memberVoucher.snapshotTitle,
        type: entry.memberVoucher.snapshotType,
      } : null,
    };
  });

  return { items, nextCursor };
}
