import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError } from "../../lib/http-error.js";
import { parseConfig } from "./loyalty.validation.js";

const config = {
  vndPerPoint: 10000,
  isActive: true,
  tiers: [
    { level: "BRONZE", minLifetimePoints: 0, multiplier: "1.00" },
    { level: "SILVER", minLifetimePoints: 1000, multiplier: "1.20" },
    { level: "GOLD", minLifetimePoints: 5000, multiplier: "1.50" },
    { level: "PLATINUM", minLifetimePoints: 10000, multiplier: "2.00" },
  ],
};

test("accepts the four ordered loyalty tiers and valid point rate", () => {
  assert.deepEqual(parseConfig(config), config);
});

test("rejects invalid loyalty rate, tier order, multiplier, or missing tier", () => {
  const invalidInputs = [
    { ...config, vndPerPoint: 0 },
    { ...config, tiers: config.tiers.slice(1) },
    { ...config, tiers: config.tiers.map((tier, index) => ({ ...tier, minLifetimePoints: [0, 1000, 900, 10000][index] })) },
    { ...config, tiers: config.tiers.map((tier, index) => index === 0 ? { ...tier, multiplier: "0.00" } : tier) },
    { ...config, tiers: config.tiers.map((tier, index) => index === 0 ? { ...tier, multiplier: "1.2" } : tier) },
  ];
  for (const input of invalidInputs) {
    assert.throws(() => parseConfig(input), (error: unknown) => error instanceof HttpError && error.statusCode === 400);
  }
});
