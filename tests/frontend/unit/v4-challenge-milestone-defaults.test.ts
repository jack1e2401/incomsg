import { describe, expect, it } from "vitest";
import {
  buildDefaultChallengeMilestones,
  reconcileChallengeMilestonesForTarget,
  validateChallengeMilestones,
} from "../../../apps/frontend/src/features/challenges/challenge-milestone-defaults";

describe("challenge milestone editor defaults", () => {
  it("matches backend count and spend default fixtures", () => {
    expect(buildDefaultChallengeMilestones("ORDER_COUNT", "3").map(({ thresholdValue }) => thresholdValue)).toEqual(["1", "2", "3"]);
    expect(buildDefaultChallengeMilestones("ORDER_COUNT", "9").map(({ thresholdValue }) => thresholdValue)).toEqual(["2", "4", "6", "8", "9"]);
    expect(buildDefaultChallengeMilestones("DAILY_CHECKIN", "2").map(({ thresholdValue }) => thresholdValue)).toEqual(["1", "2"]);
    expect(buildDefaultChallengeMilestones("SPEND_TOTAL", "100").map(({ thresholdValue }) => thresholdValue)).toEqual(["25", "50", "75", "100"]);
    expect(buildDefaultChallengeMilestones("SPEND_TOTAL", "3").map(({ thresholdValue }) => thresholdValue)).toEqual(["1", "2", "3"]);
  });

  it("updates the final threshold and drops only out-of-range intermediate stages", () => {
    const current = [1, 2, 3, 4, 5].map((threshold) => ({
      thresholdValue: String(threshold),
      title: `Mốc ${threshold}`,
      description: "",
    }));
    const result = reconcileChallengeMilestonesForTarget(current, "3");
    expect(result).toEqual({
      milestones: [current[0], current[1], { thresholdValue: "3", title: "Mốc 5", description: "" }],
      droppedCount: 2,
    });
  });

  it("retains valid stages when the target grows and appends a new final stage", () => {
    const current = [1, 2, 3].map((threshold) => ({ thresholdValue: String(threshold), title: `Mốc ${threshold}`, description: "" }));
    const result = reconcileChallengeMilestonesForTarget(current, "5");
    expect(result).toEqual({
      milestones: [...current, { thresholdValue: "5", title: "Mốc 4", description: "" }],
      droppedCount: 0,
    });
  });

  it("explains the first invalid milestone before the merchant can continue", () => {
    expect(validateChallengeMilestones([
      { thresholdValue: "2", title: "Mốc đầu", description: "" },
      { thresholdValue: "2", title: "Mốc cuối", description: "" },
    ], "3")).toBe("Các ngưỡng mốc phải tăng dần, không trùng nhau.");
    expect(validateChallengeMilestones([
      { thresholdValue: "1", title: "Mốc đầu", description: "" },
      { thresholdValue: "2", title: "Mốc cuối", description: "" },
    ], "3")).toBe("Mốc cuối phải bằng mục tiêu chiến dịch.");
  });
});
