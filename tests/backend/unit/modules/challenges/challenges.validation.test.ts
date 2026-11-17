import assert from "node:assert/strict";
import test from "node:test";
import { readChallengeInput } from "../../../../../apps/backend/src/modules/challenges/challenges.validation.js";
import { HttpError } from "../../../../../apps/backend/src/lib/http-error.js";

test("challenge input parses fixed point values and ISO dates", () => {
  const input = readChallengeInput({ title: "Five visits", description: "Visit us", type: "ORDER_COUNT", targetValue: "5", rewardPoints: "1.250000000001", budgetTotal: "2.5", startsAt: "2026-11-01T00:00:00Z", endsAt: "2026-12-01T00:00:00Z" }) as { targetValue: { toFixed: (places: number) => string }; rewardPoints: { toFixed: (places: number) => string } };
  assert.equal(input.targetValue.toFixed(0), "5");
  assert.equal(input.rewardPoints.toFixed(12), "1.250000000001");
});

test("challenge input rejects unknown challenge types and negative budget", () => {
  const base = { title: "T", description: "D", type: "ORDER_COUNT", targetValue: "1", rewardPoints: "1", budgetTotal: "2", startsAt: "2026-11-01", endsAt: "2026-12-01" };
  assert.throws(() => readChallengeInput({ ...base, type: "UNKNOWN" }), (error: unknown) => error instanceof HttpError && error.statusCode === 400);
  assert.throws(() => readChallengeInput({ ...base, budgetTotal: "-1" }), HttpError);
});
