import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import type { LoyaltyConfigDto, LoyaltyConfigInput } from "./loyalty.types.js";
import { withTransactionRetry } from "./loyalty.transaction.js";
import type { TierLevel } from "./loyalty.calculation.js";

type PolicyTier = { level: TierLevel; minLifetimePoints: number; multiplier: Prisma.Decimal | string };
type EarningPolicy = {
  vndPerPoint: number;
  isActive: boolean;
  tiers: { id: number; level: TierLevel; minLifetimePoints: number; multiplier: Prisma.Decimal }[];
  policyVersion: Prisma.LoyaltyPolicyVersionGetPayload<{}>;
};

export const defaultTiers = [
  { level: "BRONZE" as const, minLifetimePoints: 0, multiplier: "1.00" },
  { level: "SILVER" as const, minLifetimePoints: 1000, multiplier: "1.20" },
  { level: "GOLD" as const, minLifetimePoints: 5000, multiplier: "1.50" },
  { level: "PLATINUM" as const, minLifetimePoints: 10000, multiplier: "2.00" },
];

export async function loadEarningPolicy(tx: Prisma.TransactionClient, merchantId: number): Promise<EarningPolicy> {
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
  const policy = { vndPerPoint: rule?.vndPerPoint ?? 10000, isActive: rule?.isActive ?? true, tiers };
  let version = await tx.loyaltyPolicyVersion.findFirst({ where: { merchantId }, orderBy: { version: "desc" } });
  if (!version) {
    version = await tx.loyaltyPolicyVersion.create({
      data: {
        merchantId,
        version: 1,
        vndPerPoint: policy.vndPerPoint,
        isActive: policy.isActive,
        tiers: policyJson(policy.tiers),
        source: "LEGACY_BACKFILL",
      },
    });
  }
  return { ...policy, policyVersion: version };
}

function policyJson(tiers: PolicyTier[]): Prisma.InputJsonObject[] {
  return tiers.map((tier) => ({
    level: tier.level,
    minLifetimePoints: tier.minLifetimePoints,
    multiplier: typeof tier.multiplier === "string" ? tier.multiplier : tier.multiplier.toFixed(2),
  }));
}

function configMatches(
  current: { vndPerPoint: number; isActive: boolean; tiers: { level: string; minLifetimePoints: number; multiplier: Prisma.Decimal }[] },
  input: LoyaltyConfigInput,
) {
  if (current.vndPerPoint !== input.vndPerPoint || current.isActive !== input.isActive || current.tiers.length !== input.tiers.length) return false;
  const currentTiers = [...current.tiers].sort((a, b) => a.level.localeCompare(b.level));
  const nextTiers = [...input.tiers].sort((a, b) => a.level.localeCompare(b.level));
  return currentTiers.every((tier, index) => tier.level === nextTiers[index]!.level &&
    tier.minLifetimePoints === nextTiers[index]!.minLifetimePoints && tier.multiplier.equals(nextTiers[index]!.multiplier));
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

  async saveConfig(merchantId: number, publishedById: number, input: LoyaltyConfigInput): Promise<LoyaltyConfigDto> {
    await withTransactionRetry(() => prisma.$transaction(async (tx) => {
      const [currentRule, currentTiers, latest] = await Promise.all([
        tx.loyaltyRule.findUnique({ where: { merchantId } }),
        tx.loyaltyTier.findMany({ where: { merchantId }, orderBy: { level: "asc" } }),
        tx.loyaltyPolicyVersion.findFirst({ where: { merchantId }, orderBy: { version: "desc" } }),
      ]);
      const wasUnchanged = currentRule !== null && configMatches({
        vndPerPoint: currentRule.vndPerPoint,
        isActive: currentRule.isActive,
        tiers: currentTiers,
      }, input);
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
      if (!wasUnchanged || !latest) {
        await tx.loyaltyPolicyVersion.create({
          data: {
            merchantId,
            version: (latest?.version ?? 0) + 1,
            vndPerPoint: input.vndPerPoint,
            isActive: input.isActive,
            tiers: policyJson(input.tiers.map((tier) => ({ ...tier, multiplier: new Prisma.Decimal(tier.multiplier) }))),
            source: "MERCHANT_PUBLISH",
            publishedById,
          },
        });
      }
    }, { isolationLevel: "Serializable" }));
    return this.getConfig(merchantId);
  },

  async listHistory(merchantId: number) {
    const versions = await prisma.loyaltyPolicyVersion.findMany({
      where: { merchantId },
      include: { publishedBy: { select: { email: true } } },
      orderBy: [{ version: "desc" }],
    });
    return versions.map((version, index) => ({
      id: version.id,
      version: version.version,
      vndPerPoint: version.vndPerPoint,
      isActive: version.isActive,
      tiers: version.tiers,
      source: version.source,
      publishedAt: version.publishedAt.toISOString(),
      publishedById: version.publishedById,
      publishedByEmail: version.publishedBy?.email ?? null,
      isCurrent: index === 0,
    }));
  },
};
