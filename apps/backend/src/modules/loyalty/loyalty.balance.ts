import type { Prisma } from "../../generated/prisma/client.js";
import { pointScale, points, type PointValue } from "./loyalty.calculation.js";

export function exactPoints(value: PointValue): string {
  return points(value).toFixed(pointScale).replace(/\.?0+$/, "");
}

export function describeBalance(value: PointValue) {
  const balance = points(value);
  const positive = balance.isPositive() ? balance : points("0");
  return {
    exactBalance: exactPoints(balance),
    availablePoints: positive.floor().toNumber(),
    fractionalCarry: exactPoints(positive.minus(positive.floor())),
    pointDebt: exactPoints(balance.isNegative() ? balance.abs() : "0"),
  };
}

export function describeWallet(wallet: { exactBalance: Prisma.Decimal; netLifetimeEarned: Prisma.Decimal } | null | undefined) {
  const lifetime = points(wallet?.netLifetimeEarned ?? "0");
  return {
    ...describeBalance(wallet?.exactBalance ?? "0"),
    netLifetimeEarned: exactPoints(lifetime),
    lifetimeEarnedPoints: lifetime.floor().toNumber(),
  };
}

export function describeTransaction(transaction: { delta: Prisma.Decimal; balanceAfter: Prisma.Decimal }) {
  const balance = describeBalance(transaction.balanceAfter);
  return {
    delta: exactPoints(transaction.delta),
    balanceAfter: balance.exactBalance,
    availablePointsAfter: balance.availablePoints,
    fractionalCarryAfter: balance.fractionalCarry,
    pointDebtAfter: balance.pointDebt,
  };
}
