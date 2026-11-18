import { useEffect, useRef, useState } from "react";
import type { ChallengeProgressDto } from "../../api/challenges-types";

interface PreviousProgress {
  challengeId: number;
  currentValue: string;
  rewardState: ChallengeProgressDto["rewardState"];
}

function compareProgress(current: string, previous: string): number | null {
  try {
    if (/^-?\d+$/.test(current) && /^-?\d+$/.test(previous)) {
      const left = BigInt(current);
      const right = BigInt(previous);
      return left > right ? 1 : left < right ? -1 : 0;
    }
  } catch {
    return null;
  }

  const left = Number(current);
  const right = Number(previous);
  return Number.isFinite(left) && Number.isFinite(right)
    ? left > right ? 1 : left < right ? -1 : 0
    : null;
}

export function useChallengeProgressAnimation(
  challengeId: number,
  progress: ChallengeProgressDto | null | undefined,
): boolean {
  const previous = useRef<PreviousProgress | null>(null);
  const [animating, setAnimating] = useState(false);
  const currentValue = progress?.currentValue;
  const rewardState = progress?.rewardState;

  useEffect(() => {
    if (currentValue === undefined || rewardState === undefined) {
      previous.current = null;
      setAnimating(false);
      return;
    }

    const next: PreviousProgress = { challengeId, currentValue, rewardState };
    const prior = previous.current;
    previous.current = next;

    const sameChallenge = prior?.challengeId === challengeId;
    const progressIncreased = sameChallenge && compareProgress(currentValue, prior.currentValue) === 1;
    const newlyRewarded = sameChallenge && prior.rewardState !== "REWARDED" && rewardState === "REWARDED";
    const shouldAnimate = Boolean(
      sameChallenge && (
        (progressIncreased && rewardState !== "WAITING_BUDGET") || newlyRewarded
      ),
    );

    if (!shouldAnimate) {
      setAnimating(false);
      return;
    }

    setAnimating(true);
    const timeout = window.setTimeout(() => setAnimating(false), 700);
    return () => window.clearTimeout(timeout);
  }, [challengeId, currentValue, rewardState]);

  return animating;
}
