import { describe, expect, it } from "vitest";
import type { ChallengeProgressDto, PublicChallengeDto } from "../../../apps/frontend/src/api/challenges-types";
import { buildChallengeMilestones } from "../../../apps/frontend/src/features/challenges/challenge-milestones";

const challenge = (overrides: Partial<PublicChallengeDto> = {}): PublicChallengeDto => ({
  id: 9,
  merchantId: 5,
  title: "Mua cà phê",
  description: "Mua đủ đơn",
  type: "ORDER_COUNT",
  effectiveStatus: "ACTIVE",
  targetValue: "3",
  rewardPoints: "150",
  startsAt: "2026-11-01T00:00:00Z",
  endsAt: "2026-12-01T00:00:00Z",
  isFeatured: true,
  ...overrides,
});

const progress = (overrides: Partial<ChallengeProgressDto> = {}): ChallengeProgressDto => ({
  currentValue: "0",
  targetValue: "3",
  remainingValue: "3",
  percent: 0,
  rewardState: "IN_PROGRESS",
  rewardCycle: 1,
  completedAt: null,
  grantedAt: null,
  ...overrides,
});

describe("buildChallengeMilestones", () => {
  it("uses a single current node for a one-action goal", () => {
    const result = buildChallengeMilestones(challenge({ targetValue: "1" }), progress({ targetValue: "1" }));

    expect(result).toEqual([
      expect.objectContaining({ label: "1 đơn", threshold: "1", percent: 100, state: "current" }),
    ]);
  });

  it("shows one milestone per action for small count goals", () => {
    const result = buildChallengeMilestones(
      challenge(),
      progress({ currentValue: "2", remainingValue: "1", percent: 67 }),
    );

    expect(result.map(({ label, threshold, state }) => ({ label, threshold, state }))).toEqual([
      { label: "1 đơn", threshold: "1", state: "reached" },
      { label: "2 đơn", threshold: "2", state: "reached" },
      { label: "3 đơn", threshold: "3", state: "current" },
    ]);
  });

  it("compresses large count goals into five unique ordered milestones", () => {
    const result = buildChallengeMilestones(
      challenge({ targetValue: "8" }),
      progress({ currentValue: "4", targetValue: "8", remainingValue: "4", percent: 50 }),
    );

    expect(result.map(({ threshold, state }) => ({ threshold, state }))).toEqual([
      { threshold: "2", state: "reached" },
      { threshold: "4", state: "reached" },
      { threshold: "5", state: "current" },
      { threshold: "7", state: "upcoming" },
      { threshold: "8", state: "upcoming" },
    ]);
  });

  it("uses percentage checkpoints for spend goals", () => {
    const result = buildChallengeMilestones(
      challenge({ type: "SPEND_TOTAL", targetValue: "100000" }),
      progress({ currentValue: "50000", targetValue: "100000", remainingValue: "50000", percent: 50 }),
    );

    expect(result.map(({ label, state }) => ({ label, state }))).toEqual([
      { label: "25%", state: "reached" },
      { label: "50%", state: "reached" },
      { label: "75%", state: "current" },
      { label: "Hoàn tất", state: "upcoming" },
    ]);
  });

  it("marks the final goal as complete while waiting for reward budget", () => {
    const result = buildChallengeMilestones(
      challenge({ type: "DAILY_CHECKIN", targetValue: "2" }),
      progress({ currentValue: "2", targetValue: "2", remainingValue: "0", percent: 100, rewardState: "WAITING_BUDGET" }),
    );

    expect(result.at(-1)).toEqual(
      expect.objectContaining({ label: "2 ngày", state: "reward-pending" }),
    );
  });

  it("marks the final goal as rewarded only after the API reports REWARDED", () => {
    const result = buildChallengeMilestones(
      challenge(),
      progress({ currentValue: "3", remainingValue: "0", percent: 100, rewardState: "REWARDED" }),
    );

    expect(result.at(-1)).toEqual(
      expect.objectContaining({ label: "3 đơn", state: "rewarded" }),
    );
  });
});
