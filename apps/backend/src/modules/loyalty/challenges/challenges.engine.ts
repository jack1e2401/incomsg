import { Prisma } from "../../../generated/prisma/client.js";
import type { Prisma as PrismaTypes } from "../../../generated/prisma/client.js";
import { exactPoints } from "../program/loyalty.balance.js";
import { lockChallenge, recordChallengeProgress, reserveChallengeSlots } from "./challenges.rewards.js";

/** Runs inside completePaidOrder's transaction; never opens a nested transaction. */
export async function processPaidOrderChallenges(
  tx: PrismaTypes.TransactionClient,
  order: { id: number; merchantId: number; memberId: number; total: Prisma.Decimal; paidAt: Date | null },
  existingMembershipId?: number,
): Promise<void> {
  const occurredAt = order.paidAt ?? new Date();
  const challenges = await tx.challenge.findMany({ where: {
    merchantId: order.merchantId, status: "ACTIVE", startsAt: { lte: occurredAt }, endsAt: { gte: occurredAt },
    type: { in: ["ORDER_COUNT", "SPEND_TOTAL"] },
  }, orderBy: { id: "asc" } });
  const membershipId = existingMembershipId ?? (await tx.merchantMembership.upsert({
    where: { memberId_merchantId: { memberId: order.memberId, merchantId: order.merchantId } },
    create: { memberId: order.memberId, merchantId: order.merchantId }, update: {},
    select: { id: true },
  })).id;
  const activity = await tx.memberActivity.create({ data: {
    membershipId, type: "ORDER_PAID", eventKey: `order-paid-${order.id}`,
    orderId: order.id, amountVnd: order.total, occurredAt,
  } });
  for (const { id } of challenges) {
    const challenge = await lockChallenge(tx, id);
    if (challenge.status !== "ACTIVE" || occurredAt < challenge.startsAt || occurredAt > challenge.endsAt) continue;
    const delta = challenge.type === "ORDER_COUNT" ? new Prisma.Decimal(1) : order.total;
    await recordChallengeProgress(tx, challenge, activity, delta);
  }
}

export function decimalText(value: Prisma.Decimal): string { return exactPoints(value); }

/** Reverses only challenge progress that this order previously contributed. */
export async function reverseOrderChallenges(tx: PrismaTypes.TransactionClient, orderId: number, actorId: number): Promise<number> {
  const paidActivity = await tx.memberActivity.findUnique({ where: { eventKey: `order-paid-${orderId}` } });
  if (!paidActivity) return 0;
  const impacts = await tx.challengeProgressEntry.findMany({ where: { activityId: paidActivity.id, deltaValue: { gt: 0 } }, orderBy: { id: "asc" }, include: { progress: { include: { challenge: true, grants: { where: { status: "GRANTED" }, orderBy: { cycle: "desc" }, take: 1, include: { earnTransaction: { select: { walletId: true } } } } } } } });
  const activity = await tx.memberActivity.create({ data: { membershipId: paidActivity.membershipId, type: "ORDER_REFUNDED", eventKey: `order-refunded-${orderId}`, orderId, occurredAt: new Date() } });
  let reversals = 0;
  for (const impact of impacts) {
    const progress = impact.progress; const challenge = progress.challenge; const after = progress.currentValue.minus(impact.deltaValue);
    await tx.challengeProgressEntry.create({ data: { progressId: progress.id, activityId: activity.id, deltaValue: impact.deltaValue.negated() } });
    if (after.greaterThanOrEqualTo(challenge.targetValue)) { await tx.challengeProgress.update({ where: { id: progress.id }, data: { currentValue: after } }); continue; }
    const grant = progress.grants[0];
    if (grant) {
      const wallet = await tx.loyaltyWallet.update({
        where: { id: grant.earnTransaction.walletId },
        data: {
          exactBalance: { decrement: grant.pointsGranted },
          netLifetimeEarned: { decrement: grant.pointsGranted },
        },
      });
      const txRow = await tx.pointTransaction.create({ data: { walletId: wallet.id, type: "EARN_REVERSAL", source: "CHALLENGE_REFUND", delta: grant.pointsGranted.negated(), balanceAfter: wallet.exactBalance, reason: `Challenge reward reversal for refunded order #${orderId}`, eventRef: `challenge-refund-${grant.id}`, actorId } });
      await tx.challengeRewardGrant.update({ where: { id: grant.id }, data: { status: "REVERSED", reversalTransactionId: txRow.id, reversedAt: new Date() } });
      await tx.challenge.update({ where: { id: challenge.id }, data: { budgetSpent: { decrement: grant.pointsGranted } } });
      const tiers = await tx.loyaltyTier.findMany({ where: { merchantId: challenge.merchantId }, orderBy: { minLifetimePoints: "asc" } });
      const tier = tiers.filter((item) => wallet.netLifetimeEarned.greaterThanOrEqualTo(item.minLifetimePoints)).at(-1);
      await tx.merchantMembership.update({ where: { id: progress.membershipId }, data: { tierId: tier?.id ?? null } });
      reversals += 1;
    }
    const releaseSlot = progress.rewardSlotClaimed && progress.rewardCycle === 1 && !grant;
    await tx.challengeProgress.update({
      where: { id: progress.id },
      data: {
        currentValue: after, rewardState: "IN_PROGRESS", completedAt: null,
        ...(grant ? { rewardCycle: { increment: 1 } } : {}),
        ...(releaseSlot ? { rewardSlotClaimed: false } : {}),
      },
    });
    if (releaseSlot) {
      const refreshed = await tx.challenge.update({
        where: { id: challenge.id }, data: { rewardSlotsClaimed: { decrement: 1 } },
      });
      if (refreshed.status === "ACTIVE") await reserveChallengeSlots(tx, refreshed);
    }
  }
  return reversals;
}
