import { Prisma } from "../../generated/prisma/client.js";
import { HttpError } from "../../lib/http-error.js";
import { calculateEarnedPoints, points, selectTier, pointScale, type TierLevel } from "./loyalty.calculation.js";
import { exactPoints } from "./loyalty.balance.js";
import { loadEarningPolicy } from "./loyalty.config.js";
import { canReservePoints } from "./points-reservation.js";
import { toOrderDto } from "../orders/orders.serialization.js";
import type { OrderDto } from "../orders/orders.types.js";
import { consumeOrderInventory } from "../inventory/inventory.order.js";

export interface EarningSnapshot {
  vndPerPoint: number;
  ruleActive: boolean;
  maxMultiplier?: Prisma.Decimal;
  fallbackAward?: Prisma.Decimal;
  tierMultipliers?: Record<TierLevel, Prisma.Decimal>;
  tierLevel?: TierLevel;
  multiplier?: Prisma.Decimal;
  policy?: Prisma.JsonValue;
}

export async function completePaidOrder(
  tx: Prisma.TransactionClient, orderId: number, memberId: number, snapshot?: EarningSnapshot,
): Promise<OrderDto | "missing" | "already_paid"> {
  const changed = await tx.order.updateMany({
    where: { id: orderId, memberId, status: "PENDING" }, data: { status: "PAID", paidAt: new Date() },
  });
  if (changed.count === 0) {
    const existing = await tx.order.findFirst({ where: { id: orderId, memberId }, select: { id: true } });
    return existing ? "already_paid" : "missing";
  }
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId }, include: { items: true, voucher: { include: { membership: true } } },
  });
  await consumeOrderInventory(tx, order);
  if (order.voucherId !== null) {
    const voucher = order.voucher;
    if (!voucher || voucher.snapshotType !== "DISCOUNT" || voucher.membership.memberId !== memberId ||
      voucher.membership.merchantId !== order.merchantId) throw new HttpError(409, "VOUCHER_NOT_AVAILABLE");
    const used = await tx.memberVoucher.updateMany({
      where: { id: voucher.id, status: "AVAILABLE" }, data: { status: "USED", usedAt: new Date() },
    });
    if (used.count !== 1) throw new HttpError(409, "VOUCHER_NOT_AVAILABLE");
    await tx.orderVoucherReservation.deleteMany({ where: { orderId: order.id } });
  }
  const policy = await loadEarningPolicy(tx, order.merchantId);
  const membership = await tx.merchantMembership.upsert({
    where: { memberId_merchantId: { memberId, merchantId: order.merchantId } },
    create: { memberId, merchantId: order.merchantId }, update: {}, include: { wallet: true, tier: true },
  });
  const wallet = membership.wallet ?? await tx.loyaltyWallet.create({ data: { membershipId: membership.id } });
  const currentLevel = selectTier(wallet.netLifetimeEarned, policy.tiers) ?? "BRONZE";
  const currentTier = policy.tiers.find((tier) => tier.level === currentLevel)!;
  // Only pre-migration attempts retain their old settlement-time tier semantics.
  const tierLevel = snapshot?.tierLevel ?? (snapshot ? membership.tier?.level ?? currentLevel : currentLevel);
  const proposedMultiplier = snapshot?.multiplier ?? snapshot?.tierMultipliers?.[tierLevel] ?? currentTier.multiplier;
  const multiplier = snapshot?.maxMultiplier && proposedMultiplier.greaterThan(snapshot.maxMultiplier)
    ? snapshot.maxMultiplier : proposedMultiplier;
  const vndPerPoint = snapshot?.vndPerPoint ?? policy.vndPerPoint;
  const ruleActive = snapshot?.ruleActive ?? policy.isActive;
  let earned: Prisma.Decimal;
  try {
    earned = snapshot?.fallbackAward !== undefined ? points(snapshot.fallbackAward)
      : !ruleActive ? points("0")
      // Legacy attempts reserved integer awards before this migration. Increasing
      // their credit now could exceed capacity already promised to other attempts.
      : snapshot && !snapshot.multiplier
        ? points(order.total).div(vndPerPoint.toString()).floor().mul(multiplier).floor()
        : calculateEarnedPoints(order.total, vndPerPoint, multiplier);
  } catch (error) {
    if (error instanceof RangeError) throw new HttpError(409, "LOYALTY_LIMIT_EXCEEDED");
    throw error;
  }
  if (!canReservePoints({ available: wallet.exactBalance, lifetime: wallet.netLifetimeEarned, reserved: wallet.reservedPoints, requested: earned })) {
    throw new HttpError(409, "LOYALTY_LIMIT_EXCEEDED");
  }
  const balanceAfter = points(wallet.exactBalance).plus(earned);
  const lifetimeAfter = points(wallet.netLifetimeEarned).plus(earned);
  const nextTier = policy.tiers.find((tier) => tier.level === selectTier(lifetimeAfter, policy.tiers))!;
  const promotedToTier = nextTier.minLifetimePoints > (membership.tier?.minLifetimePoints ?? -1) ? nextTier.level : null;
  const credited = await tx.loyaltyWallet.updateMany({
    where: { id: wallet.id, exactBalance: wallet.exactBalance, netLifetimeEarned: wallet.netLifetimeEarned, reservedPoints: wallet.reservedPoints },
    data: { exactBalance: { increment: earned }, netLifetimeEarned: { increment: earned } },
  });
  if (credited.count !== 1) throw Object.assign(new Error("Concurrent wallet change"), { code: "P2034" });
  await tx.pointTransaction.create({ data: {
    walletId: wallet.id, type: "EARN", delta: earned, balanceAfter, promotedToTier,
    reason: `Earned from order #${order.id}`, orderId: order.id,
    eventRef: `order-earn-${order.id}`,
    source: snapshot ? "VNPAY_IPN" : "MOCK_PAYMENT",
    actorId: snapshot ? null : memberId,
  } });
  const audit: Prisma.InputJsonObject = {
    source: snapshot ? (snapshot.multiplier ? "VNPAY_INITIATION" : "LEGACY_VNPAY") : "MOCK_PAID",
    capturedAt: order.paidAt!.toISOString(), pointScale, rounding: "HALF_UP",
    netOrderAmount: order.total.toFixed(0), vndPerPoint, ruleActive, tierLevel,
    multiplier: multiplier.toFixed(2), earnedPointsExact: exactPoints(earned),
    policyVersionId: policy.policyVersion.id,
    policyVersion: policy.policyVersion.version,
    policyPublishedAt: policy.policyVersion.publishedAt.toISOString(),
    tiers: policy.tiers.map((tier) => ({ level: tier.level, minLifetimePoints: tier.minLifetimePoints, multiplier: tier.multiplier.toFixed(2) })),
    ...(snapshot?.policy ? { frozenPolicy: snapshot.policy as Prisma.InputJsonValue } : {}),
  };
  const paid = await tx.order.update({
    where: { id: order.id },
    data: { earnedPointsExact: earned, loyaltySnapshot: audit, loyaltyPolicyVersionId: policy.policyVersion.id },
    include: { items: true, paymentAttempt: true, refund: true, pointTransactions: true },
  });
  await tx.merchantMembership.update({ where: { id: membership.id }, data: { tierId: nextTier.id } });
  return { ...toOrderDto(paid), promotedToTier };
}
