import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import type { LoyaltyConfigDto, LoyaltyConfigInput } from "./loyalty.types.js";
import { withTransactionRetry } from "./loyalty.transaction.js";

export const defaultTiers = [
  { level: "BRONZE" as const, minLifetimePoints: 0, multiplier: "1.00" },
  { level: "SILVER" as const, minLifetimePoints: 1000, multiplier: "1.20" },
  { level: "GOLD" as const, minLifetimePoints: 5000, multiplier: "1.50" },
  { level: "PLATINUM" as const, minLifetimePoints: 10000, multiplier: "2.00" },
];

export async function loadEarningPolicy(tx: Prisma.TransactionClient, merchantId: number) {
  const [rule, configured] = await Promise.all([
    tx.loyaltyRule.findUnique({ where: { merchantId } }),
    tx.loyaltyTier.findMany({ where: { merchantId }, orderBy: { minLifetimePoints: "asc" } }),
  ]);
  let tiers = configured;
  if (tiers.length !== 4) {
    for (const tier of defaultTiers) {
      await tx.loyaltyTier.upsert({
        where: { merchantId_level: { merchantId, level: tier.level } },
        create: { merchantId, ...tier, multiplier: new Prisma.Decimal(tier.multiplier) }, update: {},
      });
    }
    tiers = await tx.loyaltyTier.findMany({ where: { merchantId }, orderBy: { minLifetimePoints: "asc" } });
  }
  return { vndPerPoint: rule?.vndPerPoint ?? 10000, isActive: rule?.isActive ?? true, tiers };
}

export const loyaltyConfigRepository = {
  async getConfig(merchantId: number): Promise<LoyaltyConfigDto> {
    const [rule, tiers] = await Promise.all([
      prisma.loyaltyRule.findUnique({ where: { merchantId } }),
      prisma.loyaltyTier.findMany({ where: { merchantId }, orderBy: { minLifetimePoints: "asc" } }),
    ]);
    return {
      merchantId, vndPerPoint: rule?.vndPerPoint ?? 10000, isActive: rule?.isActive ?? true,
      tiers: (tiers.length ? tiers : defaultTiers).map((tier) => ({
        level: tier.level, minLifetimePoints: tier.minLifetimePoints,
        multiplier: typeof tier.multiplier === "string" ? tier.multiplier : tier.multiplier.toFixed(2),
      })),
    };
  },

  async saveConfig(merchantId: number, input: LoyaltyConfigInput): Promise<LoyaltyConfigDto> {
    await withTransactionRetry(() => prisma.$transaction(async (tx) => {
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
          create: { merchantId, ...tier, multiplier: new Prisma.Decimal(tier.multiplier) },
          update: { minLifetimePoints: tier.minLifetimePoints, multiplier: new Prisma.Decimal(tier.multiplier) },
        });
      }
    }, { isolationLevel: "Serializable" }));
    return this.getConfig(merchantId);
  },
};
