import { Prisma } from "../../generated/prisma/client.js";

export type TierLevel = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
export type TierThreshold = { level: TierLevel; minLifetimePoints: number };
const maxDatabaseInt = new Prisma.Decimal("2147483647");

export function calculateEarnedPoints(totalVnd: Prisma.Decimal, vndPerPoint: number, multiplier: Prisma.Decimal): number {
  if (!Number.isInteger(vndPerPoint) || vndPerPoint <= 0 || totalVnd.isNegative() || multiplier.isNegative()) {
    throw new RangeError("Invalid loyalty calculation inputs");
  }
  const earnedPoints = totalVnd.div(vndPerPoint).floor().mul(multiplier).floor();
  if (earnedPoints.greaterThan(maxDatabaseInt)) throw new RangeError("Earned points exceed database Int range");
  return earnedPoints.toNumber();
}

export function selectTier(lifetimePoints: number, tiers: readonly TierThreshold[]): TierLevel | null {
  const reached = tiers
    .filter((tier) => tier.minLifetimePoints <= lifetimePoints)
    .sort((left, right) => right.minLifetimePoints - left.minLifetimePoints)[0];
  return reached?.level ?? null;
}
