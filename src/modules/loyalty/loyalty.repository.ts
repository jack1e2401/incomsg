import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import type { LoyaltyConfigDto, LoyaltyConfigInput } from "./loyalty.types.js";

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
};
