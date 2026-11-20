import type { Order, Prisma } from "../../../generated/prisma/client.js";
import { points, selectTier } from "./loyalty.calculation.js";
import { loadEarningPolicy } from "./loyalty.config.js";

export async function reverseOrderPoints(
  tx: Prisma.TransactionClient,
  order: Pick<Order, "id" | "memberId" | "merchantId" | "earnedPointsExact">,
  ownerId: number,
) {
  const { merchantId } = order;
  const originalEarned = points(order.earnedPointsExact ?? "0");
  if (originalEarned.greaterThan(0)) {
    const membership = await tx.merchantMembership.findUniqueOrThrow({
      where: {
        memberId_merchantId: { memberId: order.memberId, merchantId },
      },
      include: { wallet: true },
    });
    const wallet = membership.wallet!;
    const balanceAfter = points(wallet.exactBalance).minus(
      originalEarned,
    );
    const lifetimeAfter = points(wallet.netLifetimeEarned).minus(
      originalEarned,
    );

    const updatedWallet = await tx.loyaltyWallet.updateMany({
      where: {
        id: wallet.id,
        exactBalance: wallet.exactBalance,
        netLifetimeEarned: wallet.netLifetimeEarned,
      },
      data: {
        exactBalance: { decrement: originalEarned },
        netLifetimeEarned: { decrement: originalEarned },
      },
    });
    if (updatedWallet.count !== 1)
      throw Object.assign(new Error("Concurrent wallet update"), {
        code: "P2034",
      });

    const policy = await loadEarningPolicy(tx, merchantId);
    const nextLevel =
      selectTier(lifetimeAfter, policy.tiers) ?? "BRONZE";
    const nextTier = policy.tiers.find((t) => t.level === nextLevel);
    if (nextTier) {
      await tx.merchantMembership.update({
        where: { id: membership.id },
        data: { tierId: nextTier.id },
      });
    }

    await tx.pointTransaction.create({
      data: {
        walletId: wallet.id,
        type: "EARN_REVERSAL",
        delta: originalEarned.negated(),
        balanceAfter,
        promotedToTier: null,
        reason: `Refund for order #${order.id}`,
        eventRef: `order-earn-reversal-${order.id}`,
        source: "MERCHANT_REFUND",
        actorId: ownerId,
        orderId: order.id,
      },
    });
  }
}
