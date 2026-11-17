import type { ChallengeProgressDto, PublicChallengeDto } from "../../api/challenges-types";

export type ChallengeMilestoneState = "reached" | "current" | "upcoming" | "reward-pending" | "rewarded";

export interface ChallengeMilestone {
  key: string;
  label: string;
  threshold: string;
  percent: number;
  state: ChallengeMilestoneState;
}

const COUNT_MILESTONE_LIMIT = 5n;
const SPEND_MILESTONE_PERCENTAGES = [25, 50, 75, 100] as const;

function positiveInteger(value: string): bigint {
  try {
    const parsed = BigInt(value);
    return parsed > 0n ? parsed : 0n;
  } catch {
    return 0n;
  }
}

function boundedPercent(value: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
}

function finalState(progress: ChallengeProgressDto): ChallengeMilestoneState | null {
  if (progress.rewardState === "WAITING_BUDGET") return "reward-pending";
  if (progress.rewardState === "REWARDED") return "rewarded";
  return null;
}

function milestoneState(
  reached: boolean,
  isFinal: boolean,
  hasFoundCurrent: boolean,
  confirmedFinalState: ChallengeMilestoneState | null,
): { state: ChallengeMilestoneState; foundCurrent: boolean } {
  if (isFinal && confirmedFinalState)
    return { state: confirmedFinalState, foundCurrent: hasFoundCurrent };
  if (reached) return { state: "reached", foundCurrent: hasFoundCurrent };
  if (!hasFoundCurrent) return { state: "current", foundCurrent: true };
  return { state: "upcoming", foundCurrent: hasFoundCurrent };
}

function buildSpendMilestones(progress: ChallengeProgressDto): ChallengeMilestone[] {
  const currentPercent = boundedPercent(progress.percent);
  let foundCurrent = false;
  const confirmedFinalState = finalState(progress);

  return SPEND_MILESTONE_PERCENTAGES.map((percentage, index) => {
    const isFinal = index === SPEND_MILESTONE_PERCENTAGES.length - 1;
    const result = milestoneState(
      currentPercent >= percentage,
      isFinal,
      foundCurrent,
      confirmedFinalState,
    );
    foundCurrent = result.foundCurrent;
    const threshold = `${percentage}%`;

    return {
      key: threshold,
      label: isFinal ? "Hoàn tất" : threshold,
      threshold,
      percent: percentage,
      state: result.state,
    };
  });
}

function buildCountMilestones(
  challenge: PublicChallengeDto,
  progress: ChallengeProgressDto,
): ChallengeMilestone[] {
  const target = positiveInteger(progress.targetValue || challenge.targetValue);
  if (target === 0n) return [];

  const milestoneCount = target < COUNT_MILESTONE_LIMIT ? target : COUNT_MILESTONE_LIMIT;
  const current = positiveInteger(progress.currentValue);
  const unit = challenge.type === "ORDER_COUNT" ? "đơn" : "ngày";
  const confirmedFinalState = finalState(progress);
  let foundCurrent = false;

  return Array.from({ length: Number(milestoneCount) }, (_, index) => {
    const position = BigInt(index + 1);
    const threshold = (target * position + milestoneCount - 1n) / milestoneCount;
    const isFinal = position === milestoneCount;
    const result = milestoneState(threshold <= current, isFinal, foundCurrent, confirmedFinalState);
    foundCurrent = result.foundCurrent;
    const label = `${threshold.toLocaleString("vi-VN")} ${unit}`;
    const percent = Number((threshold * 10_000n) / target) / 100;

    return {
      key: threshold.toString(),
      label,
      threshold: threshold.toString(),
      percent,
      state: result.state,
    };
  });
}

export function buildChallengeMilestones(
  challenge: PublicChallengeDto,
  progress: ChallengeProgressDto,
): ChallengeMilestone[] {
  return challenge.type === "SPEND_TOTAL"
    ? buildSpendMilestones(progress)
    : buildCountMilestones(challenge, progress);
}
