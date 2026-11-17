import { Prisma } from "../../generated/prisma/client.js";
import type { Prisma as PrismaTypes } from "../../generated/prisma/client.js";
import { exactPoints } from "../loyalty/loyalty.balance.js";

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
  } });
  const membershipId = existingMembershipId ?? (await tx.merchantMembership.upsert({
    where: { memberId_merchantId: { memberId: order.memberId, merchantId: order.merchantId } },
    create: { memberId: order.memberId, merchantId: order.merchantId }, update: {},
    select: { id: true },
  })).id;
  const activity = await tx.memberActivity.create({ data: {
    membershipId, type: "ORDER_PAID", eventKey: `order-paid-${order.id}`,
    orderId: order.id, amountVnd: order.total, occurredAt,
  } });
  for (const challenge of challenges) {
    const delta = challenge.type === "ORDER_COUNT" ? new Prisma.Decimal(1) : order.total;
    const progress = await tx.challengeProgress.upsert({
      where: { challengeId_membershipId: { challengeId: challenge.id, membershipId } },
      create: { challengeId: challenge.id, membershipId }, update: {},
    });
    await tx.challengeProgressEntry.create({ data: { progressId: progress.id, activityId: activity.id, deltaValue: delta } });
    const currentValue = progress.currentValue.plus(delta);
    const qualifies = currentValue.greaterThanOrEqualTo(challenge.targetValue);
    const waiting = qualifies && progress.rewardState === "IN_PROGRESS";
    const result = await tx.challengeProgress.update({ where: { id: progress.id }, data: {
      currentValue, ...(waiting ? { completedAt: occurredAt } : {}),
      ...(waiting ? { rewardState: "WAITING_BUDGET" } : {}),
    } });
    if (waiting) await grantChallengeReward(tx, challenge.id, result.id, membershipId, challenge.rewardPoints, occurredAt);
  }
}

export async function grantChallengeReward(
  tx: PrismaTypes.TransactionClient, challengeId: number, progressId: number, membershipId: number,
  rewardPoints: Prisma.Decimal, now: Date,
): Promise<boolean> {
  const held = await tx.$executeRaw`UPDATE Challenge SET budgetSpent = budgetSpent + ${rewardPoints} WHERE id = ${challengeId} AND status = 'ACTIVE' AND budgetTotal - budgetSpent >= ${rewardPoints}`;
  if (held !== 1) return false;
  const progress = await tx.challengeProgress.findUniqueOrThrow({ where: { id: progressId } });
  const wallet = await tx.loyaltyWallet.upsert({ where: { membershipId }, create: { membershipId }, update: {} });
  const balanceAfter = wallet.exactBalance.plus(rewardPoints);
  const lifetimeAfter = wallet.netLifetimeEarned.plus(rewardPoints);
  const walletUpdated = await tx.loyaltyWallet.updateMany({
    where: { id: wallet.id, exactBalance: wallet.exactBalance, netLifetimeEarned: wallet.netLifetimeEarned },
    data: { exactBalance: { increment: rewardPoints }, netLifetimeEarned: { increment: rewardPoints } },
  });
  if (walletUpdated.count !== 1) throw Object.assign(new Error("Concurrent wallet change"), { code: "P2034" });
  const transaction = await tx.pointTransaction.create({ data: {
    walletId: wallet.id, type: "EARN", source: "CHALLENGE_REWARD", delta: rewardPoints, balanceAfter,
    reason: `Challenge reward #${challengeId}`, eventRef: `challenge-reward-${progressId}-${progress.rewardCycle}`,
  } });
  await tx.challengeRewardGrant.create({ data: {
    progressId, cycle: progress.rewardCycle, pointsGranted: rewardPoints, earnTransactionId: transaction.id, grantedAt: now,
  } });
  await tx.challengeProgress.update({ where: { id: progressId }, data: { rewardState: "REWARDED" } });
  const tiers = await tx.loyaltyTier.findMany({ where: { merchantId: (await tx.merchantMembership.findUniqueOrThrow({ where: { id: membershipId } })).merchantId }, orderBy: { minLifetimePoints: "asc" } });
  const eligible = tiers.filter((tier) => lifetimeAfter.greaterThanOrEqualTo(tier.minLifetimePoints)).at(-1);
  if (eligible) await tx.merchantMembership.update({ where: { id: membershipId }, data: { tierId: eligible.id } });
  return true;
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
    await tx.challengeProgress.update({ where: { id: progress.id }, data: { currentValue: after, rewardState: "IN_PROGRESS", rewardCycle: grant ? { increment: 1 } : undefined, completedAt: null } });
  }
  return reversals;
}
