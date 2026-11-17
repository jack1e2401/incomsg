import assert from "node:assert/strict";
import test from "node:test";
import { buildDefaultChallengeMilestones } from "../../../../../apps/backend/src/modules/challenges/challenges.milestones.js";

test("count challenges get up to five evenly distributed integer milestones", () => {
  assert.deepEqual(
    buildDefaultChallengeMilestones("ORDER_COUNT", "3"),
    [
      { thresholdValue: "1", title: "Mốc 1", description: "" },
      { thresholdValue: "2", title: "Mốc 2", description: "" },
      { thresholdValue: "3", title: "Mốc 3", description: "" },
    ],
  );
  assert.deepEqual(
    buildDefaultChallengeMilestones("DAILY_CHECKIN", "9").map((milestone) => milestone.thresholdValue),
    ["2", "4", "6", "8", "9"],
  );
});

test("spend challenge defaults round each quarter upward and end at the exact target", () => {
  assert.deepEqual(
    buildDefaultChallengeMilestones("SPEND_TOTAL", "100").map((milestone) => milestone.thresholdValue),
    ["25", "50", "75", "100"],
  );
});

test("small spend targets deduplicate rounded thresholds and retain the final target", () => {
  assert.deepEqual(
    buildDefaultChallengeMilestones("SPEND_TOTAL", "3").map((milestone) => milestone.thresholdValue),
    ["1", "2", "3"],
  );
  assert.deepEqual(
    buildDefaultChallengeMilestones("SPEND_TOTAL", "1").map((milestone) => milestone.thresholdValue),
    ["1"],
  );
});

test("default milestone builder rejects non-positive or fractional targets", () => {
  assert.throws(() => buildDefaultChallengeMilestones("ORDER_COUNT", "0"), RangeError);
  assert.throws(() => buildDefaultChallengeMilestones("SPEND_TOTAL", "3.5"), RangeError);
});
