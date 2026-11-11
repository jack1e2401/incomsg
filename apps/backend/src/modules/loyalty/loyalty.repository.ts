import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../lib/http-error.js";
import type { LoyaltyConfigDto, LoyaltyConfigInput } from "./loyalty.types.js";
import { calculateEarnedPoints, selectTier } from "./loyalty.calculation.js";
import { canReservePoints } from "./points-reservation.js";
import type { OrderDto } from "../orders/orders.types.js";

const defaultTiers = [
  { level: "BRONZE" as const, minLifetimePoints: 0, multiplier: "1.00" },
  { level: "SILVER" as const, minLifetimePoints: 1000, multiplier: "1.20" },
  { level: "GOLD" as const, minLifetimePoints: 5000, multiplier: "1.50" },
  { level: "PLATINUM" as const, minLifetimePoints: 10000, multiplier: "2.00" },
];

function serialize(merchantId: number, rule: { vndPerPoint: number; isActive: boolean } | null, tiers: { level: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM"; minLifetimePoints: number; multiplier: Prisma.Decimal }[]): LoyaltyConfigDto {
  return {
    merchantId,
    vndPerPoint: rule?.vndPerPoint ?? 10000,
    isActive: rule?.isActive ?? true,
    tiers: (tiers.length ? tiers : defaultTiers).map((tier) => ({
      level: tier.level,
      minLifetimePoints: tier.minLifetimePoints,
      multiplier: typeof tier.multiplier === "string" ? tier.multiplier : tier.multiplier.toFixed(2),
    })),
  };
}

export const loyaltyRepository = {
  async reserveOrderPoints(tx: Prisma.TransactionClient, order: { memberId: number; merchantId: number; total: Prisma.Decimal }) {
    const [rule, membership] = await Promise.all([
      tx.loyaltyRule.findUnique({ where: { merchantId: order.merchantId } }),
      tx.merchantMembership.upsert({
        where: { memberId_merchantId: { memberId: order.memberId, merchantId: order.merchantId } },
        create: { memberId: order.memberId, merchantId: order.merchantId },
        update: {},
        include: { tier: true, wallet: true },
      }),
    ]);
    const wallet = membership.wallet ?? await tx.loyaltyWallet.create({ data: { membershipId: membership.id } });
    const configuredTiers = await tx.loyaltyTier.findMany({ where: { merchantId: order.merchantId }, orderBy: { minLifetimePoints: "asc" } });
    const snapshotTiers = configuredTiers.length === 4
      ? configuredTiers
      : defaultTiers.map((tier) => ({ ...tier, multiplier: new Prisma.Decimal(tier.multiplier) }));
    const snapshotMultipliers = {
      BRONZE: snapshotTiers.find((tier) => tier.level === "BRONZE")!.multiplier,
      SILVER: snapshotTiers.find((tier) => tier.level === "SILVER")!.multiplier,
      GOLD: snapshotTiers.find((tier) => tier.level === "GOLD")!.multiplier,
      PLATINUM: snapshotTiers.find((tier) => tier.level === "PLATINUM")!.multiplier,
    };
    const maxMultiplier = Object.values(snapshotMultipliers).reduce((max, multiplier) => multiplier.greaterThan(max) ? multiplier : max);
    const vndPerPoint = rule?.vndPerPoint ?? 10000;
    const ruleActive = rule?.isActive ?? true;
    let requested: number;
    try {
      requested = ruleActive ? calculateEarnedPoints(order.total, vndPerPoint, maxMultiplier) : 0;
    } catch (error) {
      if (error instanceof RangeError) throw new HttpError(409, "LOYALTY_LIMIT_EXCEEDED");
      throw error;
    }
    if (!canReservePoints({ available: wallet.availablePoints, lifetime: wallet.lifetimeEarnedPoints, reserved: wallet.reservedPoints, requested })) {
      throw new HttpError(409, "LOYALTY_LIMIT_EXCEEDED");
    }
    const reserved = await tx.loyaltyWallet.updateMany({
      where: { id: wallet.id, reservedPoints: wallet.reservedPoints },
      data: { reservedPoints: { increment: requested } },
    });
    if (reserved.count !== 1) {
      const retry = Object.assign(new Error("Retry loyalty reservation after concurrent wallet update"), { code: "P2034" });
      throw retry;
    }
    return {
      reservedPoints: requested,
      snapshotVndPerPoint: vndPerPoint,
      snapshotRuleActive: ruleActive,
      snapshotMaxMultiplier: maxMultiplier,
      snapshotTierConfigFallback: false,
      snapshotBronzeMultiplier: snapshotMultipliers.BRONZE,
      snapshotSilverMultiplier: snapshotMultipliers.SILVER,
      snapshotGoldMultiplier: snapshotMultipliers.GOLD,
      snapshotPlatinumMultiplier: snapshotMultipliers.PLATINUM,
    };
  },

  async getConfig(merchantId: number): Promise<LoyaltyConfigDto> {
    const [rule, tiers] = await Promise.all([
      prisma.loyaltyRule.findUnique({ where: { merchantId }, select: { vndPerPoint: true, isActive: true } }),
      prisma.loyaltyTier.findMany({ where: { merchantId }, orderBy: { minLifetimePoints: "asc" } }),
    ]);
    return serialize(merchantId, rule, tiers);
  },

  async saveConfig(merchantId: number, input: LoyaltyConfigInput): Promise<LoyaltyConfigDto> {
    await prisma.$transaction(async (tx) => {
      await tx.loyaltyRule.upsert({
        where: { merchantId },
        create: { merchantId, vndPerPoint: input.vndPerPoint, isActive: input.isActive },
        update: { vndPerPoint: input.vndPerPoint, isActive: input.isActive },
      });
      const existingTiers = await tx.loyaltyTier.findMany({ where: { merchantId }, select: { id: true } });
      for (const [index, tier] of existingTiers.entries()) {
        await tx.loyaltyTier.update({ where: { id: tier.id }, data: { minLifetimePoints: -(index + 1) } });
      }
      for (const tier of input.tiers) {
        await tx.loyaltyTier.upsert({
          where: { merchantId_level: { merchantId, level: tier.level } },
          create: { merchantId, level: tier.level, minLifetimePoints: tier.minLifetimePoints, multiplier: new Prisma.Decimal(tier.multiplier) },
          update: { minLifetimePoints: tier.minLifetimePoints, multiplier: new Prisma.Decimal(tier.multiplier) },
        });
      }
    });
    return this.getConfig(merchantId);
  },

  async completePaidOrder(tx: Prisma.TransactionClient, orderId: number, memberId: number, earningSnapshot?: {
    vndPerPoint: number;
    ruleActive: boolean;
    maxMultiplier?: Prisma.Decimal;
    fallbackAward?: number;
    tierMultipliers?: Record<"BRONZE" | "SILVER" | "GOLD" | "PLATINUM", Prisma.Decimal>;
  }): Promise<OrderDto | "missing" | "already_paid"> {
    const changed = await tx.order.updateMany({
      where: { id: orderId, memberId, status: "PENDING" },
      data: { status: "PAID", paidAt: new Date() },
    });
    if (changed.count === 0) {
      const existing = await tx.order.findFirst({ where: { id: orderId, memberId }, select: { status: true } });
      return existing ? "already_paid" : "missing";
    }

    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true, voucher: { include: { membership: true, definition: true } } },
    });
    if (!order) return "missing";
    if (order.voucherId !== null) {
      const voucher = order.voucher;
      if (!voucher || voucher.status !== "AVAILABLE" || voucher.snapshotType !== "DISCOUNT" ||
        voucher.membership.memberId !== memberId || voucher.membership.merchantId !== order.merchantId) {
        throw new HttpError(409, "VOUCHER_NOT_AVAILABLE");
      }
      const used = await tx.memberVoucher.updateMany({
        where: { id: voucher.id, status: "AVAILABLE" },
        data: { status: "USED", usedAt: new Date() },
      });
      if (used.count !== 1) throw new HttpError(409, "VOUCHER_NOT_AVAILABLE");
    }
    const [rule, configuredTiers] = await Promise.all([
      tx.loyaltyRule.findUnique({ where: { merchantId: order.merchantId } }),
      tx.loyaltyTier.findMany({ where: { merchantId: order.merchantId }, orderBy: { minLifetimePoints: "asc" } }),
    ]);
    let tiers = configuredTiers;
    if (tiers.length !== 4) {
      for (const tier of defaultTiers) {
        await tx.loyaltyTier.upsert({
          where: { merchantId_level: { merchantId: order.merchantId, level: tier.level } },
          create: { merchantId: order.merchantId, ...tier, multiplier: new Prisma.Decimal(tier.multiplier) },
          update: {},
        });
      }
      tiers = await tx.loyaltyTier.findMany({ where: { merchantId: order.merchantId }, orderBy: { minLifetimePoints: "asc" } });
    }
    const membership = await tx.merchantMembership.upsert({
      where: { memberId_merchantId: { memberId, merchantId: order.merchantId } },
      create: { memberId, merchantId: order.merchantId },
      update: {},
      include: { wallet: true, tier: true },
    });
    const wallet = membership.wallet ?? await tx.loyaltyWallet.create({ data: { membershipId: membership.id } });
    const tierLevel = membership.tier?.level ?? "BRONZE";
    const currentMultiplier = membership.tier?.multiplier ?? tiers.find((tier) => tier.level === "BRONZE")!.multiplier;
    const earningMultiplier = earningSnapshot?.tierMultipliers?.[tierLevel] ?? currentMultiplier;
    let earnedPoints: number;
    try {
      const ruleActive = earningSnapshot?.ruleActive ?? rule?.isActive ?? true;
      const vndPerPoint = earningSnapshot?.vndPerPoint ?? rule?.vndPerPoint ?? 10000;
      const multiplier = earningSnapshot?.maxMultiplier && earningMultiplier.greaterThan(earningSnapshot.maxMultiplier)
        ? earningSnapshot.maxMultiplier
        : earningMultiplier;
      earnedPoints = earningSnapshot?.fallbackAward !== undefined
        ? earningSnapshot.fallbackAward
        : ruleActive ? calculateEarnedPoints(order.total, vndPerPoint, multiplier) : 0;
    } catch (error) {
      if (error instanceof RangeError) throw new HttpError(409, "LOYALTY_LIMIT_EXCEEDED");
      throw error;
    }
    const balanceAfter = wallet.availablePoints + earnedPoints;
    const lifetimeAfter = wallet.lifetimeEarnedPoints + earnedPoints;
    if (balanceAfter + wallet.reservedPoints > 2147483647 || lifetimeAfter + wallet.reservedPoints > 2147483647) {
      throw new HttpError(409, "LOYALTY_LIMIT_EXCEEDED");
    }
    const nextLevel = selectTier(lifetimeAfter, tiers);
    const nextTier = tiers.find((tier) => tier.level === nextLevel);
    const promotedToTier = nextTier && nextTier.minLifetimePoints > (membership.tier?.minLifetimePoints ?? -1)
      ? nextTier.level
      : null;
    await tx.loyaltyWallet.update({
      where: { id: wallet.id },
      data: { availablePoints: { increment: earnedPoints }, lifetimeEarnedPoints: { increment: earnedPoints } },
    });
    await tx.pointTransaction.create({
      data: {
        walletId: wallet.id,
        type: "EARN",
        delta: earnedPoints,
        balanceAfter,
        promotedToTier,
        reason: `Earned from order #${order.id}`,
        orderId: order.id,
      },
    });
    if (nextTier) await tx.merchantMembership.update({ where: { id: membership.id }, data: { tierId: nextTier.id } });
    return {
      id: order.id,
      merchantId: order.merchantId,
      memberId: order.memberId,
      status: "PAID",
      subtotal: order.subtotal.toFixed(0),
      discountAmount: order.discountAmount.toFixed(0),
      total: order.total.toFixed(0),
      paidAt: order.paidAt?.toISOString() ?? new Date().toISOString(),
      items: order.items.map((item) => ({ productId: item.productId, productName: item.productName, unitPrice: item.unitPrice.toFixed(0), quantity: item.quantity, lineTotal: item.lineTotal.toFixed(0) })),
      earnedPoints,
      promotedToTier,
    };
  },

  async getWallet(memberId: number, merchantId: number) {
    const merchant = await prisma.merchant.findFirst({ where: { id: merchantId, isActive: true }, select: { id: true } });
    if (!merchant) return "merchant_missing" as const;
    const [membership, policy] = await Promise.all([
      prisma.merchantMembership.findUnique({
        where: { memberId_merchantId: { memberId, merchantId } },
        include: { wallet: { include: { transactions: { orderBy: [{ createdAt: "desc" }, { id: "desc" }] } } }, tier: true },
      }),
      this.getConfig(merchantId),
    ]);
    return {
      merchantId,
      policy,
      availablePoints: membership?.wallet?.availablePoints ?? 0,
      lifetimeEarnedPoints: membership?.wallet?.lifetimeEarnedPoints ?? 0,
      tier: membership?.tier?.level ?? "UNRANKED",
      transactions: (membership?.wallet?.transactions ?? []).map((transaction) => ({
        id: transaction.id,
        type: transaction.type,
        delta: transaction.delta,
        balanceAfter: transaction.balanceAfter,
        reason: transaction.reason,
        orderId: transaction.orderId,
        memberVoucherId: transaction.memberVoucherId,
        createdAt: transaction.createdAt.toISOString(),
      })),
    };
  },
};
