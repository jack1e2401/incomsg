import { Prisma, type Challenge } from "../../generated/prisma/client.js";
import { HttpError } from "../../lib/http-error.js";

/** Serialize completion, slot allocation and changes to the limit for this challenge. */
export async function lockChallenge(tx: Prisma.TransactionClient, id: number, merchantId?: number) {
  const owner = merchantId === undefined ? Prisma.empty : Prisma.sql`AND merchantId = ${merchantId}`;
  const rows = await tx.$queryRaw<Array<{ id: number }>>`SELECT id FROM Challenge WHERE id = ${id} ${owner} FOR UPDATE`;
  if (!rows.length) throw new HttpError(404, "CHALLENGE_NOT_FOUND");
  return tx.challenge.findUniqueOrThrow({ where: { id } });
}

const completionOrder = [{ completedAt: "asc" }, { id: "asc" }] satisfies Prisma.ChallengeProgressOrderByWithRelationInput[];

/** Move the earliest still eligible completions into the budget queue. Caller holds the challenge lock. */
export async function reserveChallengeSlots(tx: Prisma.TransactionClient, challenge: Challenge) {
  if (challenge.maxRewardRecipients === null) return;
  const remaining = challenge.maxRewardRecipients - challenge.rewardSlotsClaimed;
  if (remaining <= 0) return;
  const earliest = await tx.challengeProgress.findMany({
    where: { challengeId: challenge.id, rewardState: "LIMIT_REACHED", rewardSlotClaimed: false },
    orderBy: completionOrder,
    take: remaining,
    select: { id: true },
  });
  if (!earliest.length) return;
  await tx.challengeProgress.updateMany({
    where: { id: { in: earliest.map(({ id }) => id) } },
    data: { rewardSlotClaimed: true, rewardState: "WAITING_BUDGET" },
  });
  await tx.challenge.update({
    where: { id: challenge.id },
    data: { rewardSlotsClaimed: { increment: earliest.length } },
  });
}

/** Allocate capacity before paying. A partially funded queue always pays its oldest entries first. */
export async function settleChallengeRewards(tx: Prisma.TransactionClient, challenge: Challenge) {
  if (challenge.status !== "ACTIVE") return 0;
  await reserveChallengeSlots(tx, challenge);
  const available = challenge.budgetTotal.minus(challenge.budgetSpent);
  const seats = Prisma.Decimal.min(available.div(challenge.rewardPoints).floor(), 2_147_483_647).toNumber();
  if (seats < 1) return 0;
  const queue = await tx.challengeProgress.findMany({
    where: {
      challengeId: challenge.id, rewardState: "WAITING_BUDGET",
      ...(challenge.maxRewardRecipients === null ? {} : { rewardSlotClaimed: true }),
    },
    orderBy: completionOrder,
    take: seats,
  });
  let granted = 0;
  for (const progress of queue) {
    if (!await grantChallengeReward(tx, challenge.id, progress, challenge.rewardPoints)) break;
    granted++;
  }
  return granted;
}

export async function recordChallengeProgress(
  tx: Prisma.TransactionClient,
  challenge: Challenge,
  activity: { id: number; membershipId: number },
  deltaValue: Prisma.Decimal,
) {
  const progress = await tx.challengeProgress.upsert({
    where: { challengeId_membershipId: { challengeId: challenge.id, membershipId: activity.membershipId } },
    create: { challengeId: challenge.id, membershipId: activity.membershipId },
    update: {},
  });
  await tx.challengeProgressEntry.create({ data: { progressId: progress.id, activityId: activity.id, deltaValue } });
  const currentValue = progress.currentValue.plus(deltaValue);
  const completes = progress.rewardState === "IN_PROGRESS" && currentValue.greaterThanOrEqualTo(challenge.targetValue);
  const updated = await tx.challengeProgress.update({
    where: { id: progress.id },
    data: {
      currentValue,
      ...(completes ? {
        completedAt: new Date(),
        rewardState: challenge.maxRewardRecipients === null || progress.rewardSlotClaimed ? "WAITING_BUDGET" : "LIMIT_REACHED",
      } : {}),
    },
  });
  if (!completes) return { progress: updated, awarded: false };
  await settleChallengeRewards(tx, challenge);
  const settled = await tx.challengeProgress.findUniqueOrThrow({ where: { id: progress.id } });
  return { progress: settled, awarded: settled.rewardState === "REWARDED" };
}

async function grantChallengeReward(
  tx: Prisma.TransactionClient,
  challengeId: number,
  progress: { id: number; membershipId: number; rewardCycle: number },
  rewardPoints: Prisma.Decimal,
) {
  const held = await tx.$executeRaw`UPDATE Challenge SET budgetSpent = budgetSpent + ${rewardPoints}
    WHERE id = ${challengeId} AND status = 'ACTIVE' AND budgetTotal - budgetSpent >= ${rewardPoints}`;
  if (held !== 1) return false;
  const { membershipId } = progress;
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
    reason: `Challenge reward #${challengeId}`, eventRef: `challenge-reward-${progress.id}-${progress.rewardCycle}`,
  } });
  await tx.challengeRewardGrant.create({ data: {
    progressId: progress.id, cycle: progress.rewardCycle, pointsGranted: rewardPoints, earnTransactionId: transaction.id,
  } });
  await tx.challengeProgress.update({ where: { id: progress.id }, data: { rewardState: "REWARDED" } });
  const membership = await tx.merchantMembership.findUniqueOrThrow({ where: { id: membershipId } });
  const tiers = await tx.loyaltyTier.findMany({
    where: { merchantId: membership.merchantId },
    orderBy: { minLifetimePoints: "asc" },
  });
  const tier = tiers.filter(({ minLifetimePoints }) => lifetimeAfter.greaterThanOrEqualTo(minLifetimePoints)).at(-1);
  if (tier) await tx.merchantMembership.update({ where: { id: membershipId }, data: { tierId: tier.id } });
  return true;
}
