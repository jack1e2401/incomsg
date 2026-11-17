import type { ChallengeProgressDto, PublicChallengeDto } from "../../api/challenges-types";

export type ChallengeMilestoneState = "reached" | "current" | "upcoming" | "reward-pending" | "rewarded";

export interface ChallengeMilestone {
  key: string;
  label: string;
  title: string;
  description: string;
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

function formatThreshold(challenge: PublicChallengeDto, threshold: bigint): string {
  const formatted = threshold.toLocaleString("vi-VN");
  if (challenge.type === "SPEND_TOTAL") return `${formatted} ₫`;
  return `${formatted} ${challenge.type === "ORDER_COUNT" ? "đơn" : "ngày"}`;
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
      title: isFinal ? "Hoàn tất" : threshold,
      description: "",
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
      title: label,
      description: "",
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
  const configuredMilestones = challenge.milestones ?? [];
  const target = positiveInteger(progress.targetValue || challenge.targetValue);
  if (configuredMilestones.length > 0 && target > 0n) {
    const current = positiveInteger(progress.currentValue);
    const confirmedFinalState = finalState(progress);
    let foundCurrent = false;

    return configuredMilestones.map((configuredMilestone, index) => {
      const threshold = positiveInteger(configuredMilestone.thresholdValue);
      const isFinal = index === configuredMilestones.length - 1;
      const result = milestoneState(threshold <= current, isFinal, foundCurrent, confirmedFinalState);
      foundCurrent = result.foundCurrent;
      const label = formatThreshold(challenge, threshold);
      const percent = Number((threshold * 10_000n) / target) / 100;

      return {
        key: threshold.toString(),
        label,
        title: configuredMilestone.title || label,
        description: configuredMilestone.description || "",
        threshold: threshold.toString(),
        percent: boundedPercent(percent),
        state: result.state,
      };
    });
  }

  return challenge.type === "SPEND_TOTAL"
    ? buildSpendMilestones(progress)
    : buildCountMilestones(challenge, progress);
}

export function getChallengeMilestonePathProgress(
  challenge: PublicChallengeDto,
  progress: ChallengeProgressDto,
  milestones: ChallengeMilestone[],
): number {
  if (milestones.length < 2) {
    if (milestones.length === 0) return 0;
    const final = milestones[0];
    if (challenge.type === "SPEND_TOTAL" && !(challenge.milestones?.length)) {
      return progress.percent >= final.percent ? 100 : 0;
    }
    return positiveInteger(progress.currentValue) >= positiveInteger(final.threshold) ? 100 : 0;
  }

  const isFallbackSpend = challenge.type === "SPEND_TOTAL" && !(challenge.milestones?.length);
  const scale = 1_000_000n;
  const current = isFallbackSpend
    ? BigInt(Math.round(boundedPercent(progress.percent) * Number(scale)))
    : positiveInteger(progress.currentValue);
  const target = positiveInteger(progress.targetValue || challenge.targetValue);
  const thresholds = milestones.map((milestone) => {
    if (isFallbackSpend) return BigInt(Math.round(milestone.percent * Number(scale)));
    if (challenge.type === "SPEND_TOTAL" && milestone.threshold.endsWith("%")) {
      const percentage = positiveInteger(milestone.threshold.slice(0, -1));
      return target * percentage / 100n;
    }
    return positiveInteger(milestone.threshold);
  });

  let lastReached = -1;
  for (const [index, threshold] of thresholds.entries()) {
    if (current < threshold) break;
    lastReached = index;
  }
  if (lastReached < 0) return 0;
  if (lastReached >= milestones.length - 1) return 100;

  const low = thresholds[lastReached];
  const high = thresholds[lastReached + 1];
  const ratio = high > low
    ? ((current - low) * scale) / (high - low)
    : 0n;
  const boundedRatio = ratio < 0n ? 0n : ratio > scale ? scale : ratio;
  const position = BigInt(lastReached) * scale + boundedRatio;
  return Number(position * 100n / BigInt(milestones.length - 1)) / Number(scale);
}
