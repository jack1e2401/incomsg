import type { ChallengeType } from "../../generated/prisma/enums.js";

export interface ChallengeMilestoneInput {
  thresholdValue: string;
  title: string;
  description: string;
}

const COUNT_MILESTONE_LIMIT = 5n;
const SPEND_MILESTONE_PERCENTAGES = [25n, 50n, 75n, 100n] as const;

function parsePositiveInteger(value: string): bigint {
  let parsed: bigint;
  try {
    parsed = BigInt(value);
  } catch {
    throw new RangeError("Challenge target must be a positive integer.");
  }
  if (parsed <= 0n) throw new RangeError("Challenge target must be a positive integer.");
  return parsed;
}

function milestonesAt(thresholds: bigint[]): ChallengeMilestoneInput[] {
  return thresholds.map((thresholdValue, index) => ({
    thresholdValue: thresholdValue.toString(),
    title: `Mốc ${index + 1}`,
    description: "",
  }));
}

export function buildDefaultChallengeMilestones(
  type: ChallengeType,
  targetValue: string,
): ChallengeMilestoneInput[] {
  const target = parsePositiveInteger(targetValue);

  if (type === "SPEND_TOTAL") {
    const thresholds: bigint[] = [];
    for (const percentage of SPEND_MILESTONE_PERCENTAGES) {
      const threshold = (target * percentage + 99n) / 100n;
      if (threshold !== thresholds.at(-1)) thresholds.push(threshold);
    }
    if (thresholds.at(-1) !== target) thresholds.push(target);
    return milestonesAt(thresholds);
  }

  const count = target < COUNT_MILESTONE_LIMIT ? target : COUNT_MILESTONE_LIMIT;
  const thresholds = Array.from({ length: Number(count) }, (_, index) => {
    const position = BigInt(index + 1);
    return (target * position + count - 1n) / count;
  });
  return milestonesAt(thresholds);
}
