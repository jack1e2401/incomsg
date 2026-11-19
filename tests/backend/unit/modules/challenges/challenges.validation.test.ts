import assert from "node:assert/strict";
import test from "node:test";
import { readChallengeInput } from "../../../../../apps/backend/src/modules/challenges/challenges.validation.js";
import { HttpError } from "../../../../../apps/backend/src/lib/http-error.js";

test("recipient cap is an optional positive database integer, or null for unlimited", () => {
  assert.equal(readChallengeInput({ maxRewardRecipients: 100 }, true).maxRewardRecipients, 100);
  assert.equal(readChallengeInput({ maxRewardRecipients: null }, true).maxRewardRecipients, null);
  assert.equal("maxRewardRecipients" in readChallengeInput({ title: "Renamed" }, true), false);
  for (const invalid of [0, -1, 2.5, "100", true, 2_147_483_648]) {
    assert.throws(() => readChallengeInput({ maxRewardRecipients: invalid }, true), HttpError);
  }
});

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

test("challenge input accepts ordered custom milestones and defaults omitted milestones", () => {
  const base = { title: "T", description: "D", type: "ORDER_COUNT", targetValue: "3", rewardPoints: "1", budgetTotal: "2", startsAt: "2026-11-01", endsAt: "2026-12-01" };
  const custom = readChallengeInput({ ...base, milestones: [
    { thresholdValue: "1", title: "Lần đầu", description: "Ghé quán" },
    { thresholdValue: "3", title: "Thân quen", description: "Nhận điểm cuối" },
  ] }) as { milestones: Array<{ thresholdValue: string; title: string; description: string }> };
  assert.deepEqual(custom.milestones, [
    { thresholdValue: "1", title: "Lần đầu", description: "Ghé quán" },
    { thresholdValue: "3", title: "Thân quen", description: "Nhận điểm cuối" },
  ]);

  const legacy = readChallengeInput(base) as { milestones: Array<{ thresholdValue: string; title: string; description: string }> };
  assert.deepEqual(legacy.milestones.map(({ thresholdValue, title }) => [thresholdValue, title]), [
    ["1", "Mốc 1"], ["2", "Mốc 2"], ["3", "Mốc 3"],
  ]);
});

test("challenge input rejects invalid milestone structures and copy", () => {
  const base = { title: "T", description: "D", type: "ORDER_COUNT", targetValue: "3", rewardPoints: "1", budgetTotal: "2", startsAt: "2026-11-01", endsAt: "2026-12-01" };
  const valid = [
    { thresholdValue: "1", title: "A", description: "" },
    { thresholdValue: "3", title: "B", description: "" },
  ];
  const invalidCases = [
    [],
    [{ thresholdValue: "1", description: "No title" }, { thresholdValue: "3", title: "B" }],
    [{ thresholdValue: "1.5", title: "A" }, { thresholdValue: "3", title: "B" }],
    [{ thresholdValue: "1", title: "A" }, { thresholdValue: "1", title: "B" }, { thresholdValue: "3", title: "C" }],
    [{ thresholdValue: "2", title: "A" }, { thresholdValue: "1", title: "B" }, { thresholdValue: "3", title: "C" }],
    [{ thresholdValue: "1", title: "A" }, { thresholdValue: "4", title: "B" }],
    [{ thresholdValue: "1", title: "A" }, { thresholdValue: "2", title: "B" }],
    Array.from({ length: 11 }, (_, index) => ({ thresholdValue: String(index + 1), title: `Mốc ${index + 1}` })),
    [{ thresholdValue: "1", title: "A", description: "x".repeat(241) }, { thresholdValue: "3", title: "B" }],
  ];
  for (const milestones of invalidCases) {
    assert.throws(() => readChallengeInput({ ...base, milestones }), HttpError);
  }
  assert.doesNotThrow(() => readChallengeInput({ ...base, milestones: valid }, true));
  assert.equal("milestones" in readChallengeInput({ title: "renamed" }, true), false);
});
