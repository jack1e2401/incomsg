import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "../../generated/prisma/client.js";
import { calculateEarnedPoints, selectTier } from "./loyalty.calculation.js";

test("calculates points by flooring VND base points times tier multiplier", () => {
  assert.equal(calculateEarnedPoints(new Prisma.Decimal("180000"), 10000, new Prisma.Decimal("1.20")), 21);
  assert.equal(calculateEarnedPoints(new Prisma.Decimal("200000"), 10000, new Prisma.Decimal("1.00")), 20);
  assert.equal(calculateEarnedPoints(new Prisma.Decimal("9999"), 10000, new Prisma.Decimal("1.00")), 0);
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
