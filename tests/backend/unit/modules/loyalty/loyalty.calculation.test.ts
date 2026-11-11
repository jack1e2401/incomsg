import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "../../../../../apps/backend/src/generated/prisma/client.js";
import { calculateEarnedPoints, selectTier } from "../../../../../apps/backend/src/modules/loyalty/loyalty.calculation.js";

test("preserves fractional earning and multiplies before any integer projection", () => {
  assert.equal(calculateEarnedPoints(new Prisma.Decimal("180000"), 10000, new Prisma.Decimal("1.20")).toString(), "21.6");
  assert.equal(calculateEarnedPoints(new Prisma.Decimal("200000"), 10000, new Prisma.Decimal("1.00")).toString(), "20");
  assert.equal(calculateEarnedPoints(new Prisma.Decimal("9999"), 10000, new Prisma.Decimal("1.00")).toString(), "0.9999");
  assert.equal(calculateEarnedPoints(new Prisma.Decimal("6000"), 10000, new Prisma.Decimal("1.50")).toString(), "0.9");
});

test("rounds recurring credits HALF_UP once at twelve decimal places", () => {
  assert.equal(calculateEarnedPoints(new Prisma.Decimal("1"), 3, new Prisma.Decimal("1")).toString(), "0.333333333333");
  assert.equal(calculateEarnedPoints(new Prisma.Decimal("1"), 6, new Prisma.Decimal("1")).toString(), "0.166666666667");
  assert.equal(calculateEarnedPoints(new Prisma.Decimal("1"), 3, new Prisma.Decimal("1.5")).toString(), "0.5");
});

test("selects the highest tier reached by lifetime earned points", () => {
  const tiers = [
    { level: "BRONZE", minLifetimePoints: 0 },
    { level: "SILVER", minLifetimePoints: 1000 },
    { level: "GOLD", minLifetimePoints: 5000 },
    { level: "PLATINUM", minLifetimePoints: 10000 },
  ] as const;
  assert.equal(selectTier(999, tiers), "BRONZE");
  assert.equal(selectTier(1000, tiers), "SILVER");
  assert.equal(selectTier(5000, tiers), "GOLD");
  assert.equal(selectTier(10000, tiers), "PLATINUM");
});

test("rejects earned points above the database Int range", () => {
  assert.throws(
    () => calculateEarnedPoints(new Prisma.Decimal("999999999999999"), 1, new Prisma.Decimal("999.99")),
    RangeError,
  );
});

test("rejects non-finite or invalid earning inputs", () => {
  for (const amount of ["NaN", "Infinity", "-1"]) {
    assert.throws(() => calculateEarnedPoints(new Prisma.Decimal(amount), 10000, new Prisma.Decimal("1")), RangeError);
  }
  for (const multiplier of ["NaN", "Infinity", "-1"]) {
    assert.throws(() => calculateEarnedPoints(new Prisma.Decimal("6000"), 10000, new Prisma.Decimal(multiplier)), RangeError);
  }
  assert.throws(() => calculateEarnedPoints(new Prisma.Decimal("6000"), 0, new Prisma.Decimal("1")), RangeError);
});
