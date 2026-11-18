import type { ChallengeMilestoneInput, ChallengeType } from "../../api/challenges-types";

const COUNT_MILESTONE_LIMIT = 5n;
const SPEND_MILESTONE_PERCENTAGES = [25n, 50n, 75n, 100n] as const;

function positiveInteger(value: string): bigint | null {
  if (!/^\d+$/.test(value.trim())) return null;
  try {
    const parsed = BigInt(value.trim());
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

function withDefaultCopy(thresholds: bigint[]): ChallengeMilestoneInput[] {
  return thresholds.map((threshold, index) => ({
    thresholdValue: threshold.toString(),
    title: `Mốc ${index + 1}`,
    description: "",
  }));
}

export function buildDefaultChallengeMilestones(
  type: ChallengeType,
  targetValue: string,
): ChallengeMilestoneInput[] {
  const target = positiveInteger(targetValue);
  if (!target) return [];

  if (type === "SPEND_TOTAL") {
    const thresholds: bigint[] = [];
    for (const percentage of SPEND_MILESTONE_PERCENTAGES) {
      const threshold = (target * percentage + 99n) / 100n;
      if (threshold !== thresholds.at(-1)) thresholds.push(threshold);
    }
    if (thresholds.at(-1) !== target) thresholds.push(target);
    return withDefaultCopy(thresholds);
  }

  const count = target < COUNT_MILESTONE_LIMIT ? target : COUNT_MILESTONE_LIMIT;
  return withDefaultCopy(Array.from({ length: Number(count) }, (_, index) => {
    const position = BigInt(index + 1);
    return (target * position + count - 1n) / count;
  }));
}

export function reconcileChallengeMilestonesForTarget(
  milestones: ChallengeMilestoneInput[],
  targetValue: string,
): { milestones: ChallengeMilestoneInput[]; droppedCount: number } {
  const target = positiveInteger(targetValue);
  if (!target || milestones.length === 0) return { milestones, droppedCount: 0 };

  const previousTarget = positiveInteger(milestones.at(-1)!.thresholdValue);
  if (previousTarget && target > previousTarget) {
    const retained = milestones.slice(0, 9);
    return {
      milestones: [...retained, { thresholdValue: target.toString(), title: `Mốc ${retained.length + 1}`, description: "" }],
      droppedCount: milestones.length - retained.length,
    };
  }

  const intermediate = milestones.slice(0, -1);
  const retained = intermediate.filter((milestone) => {
    const threshold = positiveInteger(milestone.thresholdValue);
    return threshold !== null && threshold < target;
  });
  const final = milestones.at(-1)!;
  return {
    milestones: [...retained, { ...final, thresholdValue: target.toString() }],
    droppedCount: intermediate.length - retained.length,
  };
}

export function validateChallengeMilestones(
  milestones: ChallengeMilestoneInput[],
  targetValue: string,
): string {
  const target = positiveInteger(targetValue);
  if (!target) return "Mục tiêu phải là số nguyên dương.";
  if (milestones.length < 1) return "Cần có ít nhất một mốc tiến độ.";
  if (milestones.length > 10) return "Tối đa 10 mốc tiến độ.";

  let previous = 0n;
  for (const [index, milestone] of milestones.entries()) {
    const threshold = positiveInteger(milestone.thresholdValue);
    if (!threshold) return `Ngưỡng mốc ${index + 1} phải là số nguyên dương.`;
    if (threshold > target) return `Ngưỡng mốc ${index + 1} không được vượt quá mục tiêu.`;
    if (threshold <= previous) return "Các ngưỡng mốc phải tăng dần, không trùng nhau.";
    if (!milestone.title.trim()) return `Vui lòng nhập tiêu đề mốc ${index + 1}.`;
    if (milestone.title.trim().length > 80) return `Tiêu đề mốc ${index + 1} không được vượt quá 80 ký tự.`;
    if (milestone.description.length > 240) return `Mô tả mốc ${index + 1} không được vượt quá 240 ký tự.`;
    previous = threshold;
  }
  if (previous !== target) return "Mốc cuối phải bằng mục tiêu chiến dịch.";
  return "";
}
