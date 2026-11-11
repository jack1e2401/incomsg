import { Prisma } from "../../generated/prisma/client.js";
import { HttpError } from "../../lib/http-error.js";
import { calculateEarnedPoints, points, selectTier, pointScale } from "./loyalty.calculation.js";
import { loadEarningPolicy } from "./loyalty.config.js";
import { canReservePoints } from "./points-reservation.js";

export async function reserveOrderPoints(tx: Prisma.TransactionClient, order: { memberId: number; merchantId: number; total: Prisma.Decimal }) {
  const policy = await loadEarningPolicy(tx, order.merchantId);
  const membership = await tx.merchantMembership.upsert({
    where: { memberId_merchantId: { memberId: order.memberId, merchantId: order.merchantId } },
    create: { memberId: order.memberId, merchantId: order.merchantId }, update: {}, include: { wallet: true },
  });
  const wallet = membership.wallet ?? await tx.loyaltyWallet.create({ data: { membershipId: membership.id } });
  const tierLevel = selectTier(wallet.netLifetimeEarned, policy.tiers) ?? "BRONZE";
  const multiplier = policy.tiers.find((tier) => tier.level === tierLevel)!.multiplier;
  const maxMultiplier = policy.tiers.reduce((max, tier) => tier.multiplier.greaterThan(max) ? tier.multiplier : max, points("0"));
  let requested: Prisma.Decimal;
  try {
    requested = policy.isActive ? calculateEarnedPoints(order.total, policy.vndPerPoint, maxMultiplier) : points("0");
  } catch (error) {
    if (error instanceof RangeError) throw new HttpError(409, "LOYALTY_LIMIT_EXCEEDED");
    throw error;
  }
  if (!canReservePoints({ available: wallet.exactBalance, lifetime: wallet.netLifetimeEarned, reserved: wallet.reservedPoints, requested })) {
    throw new HttpError(409, "LOYALTY_LIMIT_EXCEEDED");
  }
  const reserved = await tx.loyaltyWallet.updateMany({
    where: { id: wallet.id, reservedPoints: wallet.reservedPoints }, data: { reservedPoints: { increment: requested } },
  });
  if (reserved.count !== 1) throw Object.assign(new Error("Concurrent wallet reservation"), { code: "P2034" });
  const tierMultiplier = (level: typeof tierLevel) => policy.tiers.find((tier) => tier.level === level)!.multiplier;
  return {
    reservedPoints: requested, snapshotVndPerPoint: policy.vndPerPoint, snapshotRuleActive: policy.isActive,
    snapshotMaxMultiplier: maxMultiplier, snapshotTierConfigFallback: false,
    snapshotBronzeMultiplier: tierMultiplier("BRONZE"), snapshotSilverMultiplier: tierMultiplier("SILVER"),
    snapshotGoldMultiplier: tierMultiplier("GOLD"), snapshotPlatinumMultiplier: tierMultiplier("PLATINUM"),
    snapshotTierLevel: tierLevel, snapshotMultiplier: multiplier,
    snapshotPolicy: {
      capturedAt: new Date().toISOString(), vndPerPoint: policy.vndPerPoint, ruleActive: policy.isActive,
      tierLevel, multiplier: multiplier.toFixed(2), pointScale, rounding: "HALF_UP",
      tiers: policy.tiers.map((tier) => ({ level: tier.level, minLifetimePoints: tier.minLifetimePoints, multiplier: tier.multiplier.toFixed(2) })),
    } satisfies Prisma.InputJsonObject,
  };
}
