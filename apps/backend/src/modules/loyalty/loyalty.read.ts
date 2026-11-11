import { prisma } from "../../lib/prisma.js";
import { defaultTiers } from "./loyalty.config.js";
import { describeTransaction, describeWallet } from "./loyalty.balance.js";
import { selectTier } from "./loyalty.calculation.js";

export async function getWallet(memberId: number, merchantId: number) {
  return prisma.$transaction(async (tx) => {
    const merchant = await tx.merchant.findFirst({ where: { id: merchantId, isActive: true }, select: { id: true } });
    if (!merchant) return "merchant_missing" as const;
    const [membership, rule, configuredTiers] = await Promise.all([
      tx.merchantMembership.findUnique({
        where: { memberId_merchantId: { memberId, merchantId } },
        include: { wallet: { include: { transactions: { orderBy: [{ createdAt: "desc" }, { id: "desc" }] } } } },
      }),
      tx.loyaltyRule.findUnique({ where: { merchantId } }),
      tx.loyaltyTier.findMany({ where: { merchantId }, orderBy: { minLifetimePoints: "asc" } }),
    ]);
    const tiers = configuredTiers.length ? configuredTiers : defaultTiers;
    const ranked = membership && (membership.tierId !== null || membership.wallet?.transactions.some((entry) => entry.type === "EARN"));
    return {
      merchantId,
      policy: {
        merchantId, vndPerPoint: rule?.vndPerPoint ?? 10000, isActive: rule?.isActive ?? true,
        tiers: tiers.map((tier) => ({ level: tier.level, minLifetimePoints: tier.minLifetimePoints, multiplier: typeof tier.multiplier === "string" ? tier.multiplier : tier.multiplier.toFixed(2) })),
      },
      ...describeWallet(membership?.wallet),
      tier: ranked ? selectTier(membership.wallet?.netLifetimeEarned ?? "0", tiers) ?? "UNRANKED" : "UNRANKED",
      transactions: (membership?.wallet?.transactions ?? []).map((entry) => ({
        id: entry.id, type: entry.type, ...describeTransaction(entry), reason: entry.reason,
        orderId: entry.orderId, memberVoucherId: entry.memberVoucherId, createdAt: entry.createdAt.toISOString(),
      })),
    };
  });
}
