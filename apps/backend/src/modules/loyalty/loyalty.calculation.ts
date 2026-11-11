import { Prisma } from "../../generated/prisma/client.js";

export type TierLevel = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
export type TierThreshold = { level: TierLevel; minLifetimePoints: number };
export type PointValue = Prisma.Decimal | string | number;
const CalculationDecimal = Prisma.Decimal.clone({ precision: 60, rounding: Prisma.Decimal.ROUND_HALF_UP });
export const pointScale = 12;
export const maxPoints = new CalculationDecimal("2147483647");

/** Isolated high-precision arithmetic; never change Prisma.Decimal's global settings. */
export function points(value: PointValue): Prisma.Decimal {
  return new CalculationDecimal(value.toString());
}

export function calculateEarnedPoints(totalVnd: Prisma.Decimal, vndPerPoint: number, multiplier: Prisma.Decimal): Prisma.Decimal {
  if (!Number.isSafeInteger(vndPerPoint) || vndPerPoint <= 0 ||
    !totalVnd.isFinite() || totalVnd.isNegative() || !multiplier.isFinite() || multiplier.isNegative()) {
    throw new RangeError("Invalid loyalty calculation inputs");
  }
  const earnedPoints = points(totalVnd).mul(multiplier.toString()).div(vndPerPoint.toString())
    .toDecimalPlaces(pointScale, Prisma.Decimal.ROUND_HALF_UP);
  if (earnedPoints.greaterThan(maxPoints)) throw new RangeError("Earned points exceed database capacity");
  return earnedPoints;
}

export function selectTier(lifetimePoints: PointValue, tiers: readonly TierThreshold[]): TierLevel | null {
  const reached = tiers
    .filter((tier) => points(lifetimePoints).greaterThanOrEqualTo(tier.minLifetimePoints.toString()))
    .sort((left, right) => right.minLifetimePoints - left.minLifetimePoints)[0];
  return reached?.level ?? null;
}
