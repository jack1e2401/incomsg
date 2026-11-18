import { Check, Lock, Star, Trophy } from "@phosphor-icons/react";
import type { ChallengeProgressDto, PublicChallengeDto } from "../../api/challenges-types";
import { cn } from "../../lib/utils";
import { buildChallengeMilestones, getChallengeMilestonePathProgress, type ChallengeMilestoneState } from "./challenge-milestones";
import { formatChallengeProgress, formatChallengeRemaining } from "./challenge-ui";

const NODE_SPACING = 144;

function formatFinalState(progress: ChallengeProgressDto): string | null {
  if (progress.rewardState === "WAITING_BUDGET") return "Mục tiêu hoàn thành, đang chờ ngân sách.";
  if (progress.rewardState === "REWARDED") return "Đã nhận phần thưởng.";
  return null;
}

function stateIcon(state: ChallengeMilestoneState, isFinal: boolean) {
  if (state === "rewarded" || (state === "reached" && isFinal)) return Trophy;
  if (state === "reached") return Check;
  if (state === "current") return Star;
  return Lock;
}

export function ChallengeMilestonePath({
  challenge,
  progress,
  animateReached = false,
  compact = false,
}: {
  challenge: PublicChallengeDto;
  progress: ChallengeProgressDto;
  animateReached?: boolean;
  compact?: boolean;
}) {
  const milestones = buildChallengeMilestones(challenge, progress);
  if (!milestones.length) return null;

  const points = milestones.map((_, index) => compact
    ? { x: milestones.length === 1 ? 50 : 14 + index * (72 / (milestones.length - 1)), y: 25 }
    : { x: index % 2 === 0 ? 34 : 66, y: 44 + index * NODE_SPACING });
  const trackHeight = compact ? 78 : Math.max(NODE_SPACING, points.at(-1)!.y + NODE_SPACING / 2);
  const pathData = points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const middleY = (previous.y + point.y) / 2;
    return `${path} Q 50 ${middleY} ${point.x} ${point.y}`;
  }, "");
  const mostRecentReached = milestones.reduce(
    (latest, milestone, index) => ["reached", "reward-pending", "rewarded"].includes(milestone.state) ? index : latest,
    -1,
  );
  const progressPercent = getChallengeMilestonePathProgress(challenge, progress, milestones);

  return (
    <section className="mt-5 rounded-[1.75rem] border border-[#e4ecdf] bg-[#f8faf6] px-4 py-5 sm:px-6">
      {!compact && <h2 className="mb-4 text-lg font-extrabold text-[#263d2d]">Hành trình nhiệm vụ</h2>}
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-base font-extrabold tabular-nums text-[#263d2d]">
          {formatChallengeProgress(challenge, progress)}
        </p>
        <p className="text-right text-xs font-semibold text-[#718075]">
          {formatChallengeRemaining(challenge, progress)}
        </p>
      </div>
      {formatFinalState(progress) && (
        <p className="mt-2 text-sm font-semibold text-[#3d7048]">{formatFinalState(progress)}</p>
      )}

      <div className="relative mx-auto mt-5 max-w-md" style={{ height: trackHeight }}>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          viewBox={`0 0 100 ${trackHeight}`}
          preserveAspectRatio="none"
        >
          <path d={pathData} fill="none" pathLength="100" stroke="#d8e3d4" strokeDasharray="2 4" strokeLinecap="round" strokeWidth="2.5" />
          <path
            d={pathData}
            fill="none"
            pathLength="100"
            stroke="#4d8057"
            strokeDasharray={`${progressPercent} 100`}
            strokeLinecap="round"
            strokeWidth="2.5"
            style={{ transition: "stroke-dasharray 480ms cubic-bezier(0.32, 0.72, 0, 1)" }}
          />
        </svg>
        <ol aria-label="Các mốc nhiệm vụ" className="relative m-0 list-none p-0" style={{ height: trackHeight }}>
          {milestones.map((milestone, index) => {
            const point = points[index];
            const isFinal = index === milestones.length - 1;
            const Icon = stateIcon(milestone.state, isFinal);
            const sideLabel = point.x < 50 ? "left-[calc(100%+0.75rem)] text-left" : "right-[calc(100%+0.75rem)] text-right";
            const shouldAnimate = animateReached && index === mostRecentReached;

            return (
              <li
                key={milestone.key}
                aria-current={milestone.state === "current" ? "step" : undefined}
                data-state={milestone.state}
                data-animating={shouldAnimate ? "true" : "false"}
                className="absolute z-10 h-12 w-12 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${point.x}%`, top: point.y }}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-12 place-items-center rounded-full border-2 transition-transform duration-300",
                    compact && "size-9",
                    milestone.state === "reached" && "border-[#3e754a] bg-[#3e754a] text-white",
                    milestone.state === "current" && "border-[#3e754a] bg-white text-[#3e754a] shadow-[0_0_0_5px_#e7f2dd]",
                    milestone.state === "upcoming" && "border-[#d6e1d1] bg-white text-[#94a198]",
                    milestone.state === "reward-pending" && "border-amber-400 bg-amber-50 text-amber-700",
                    milestone.state === "rewarded" && "border-[#3e754a] bg-[#c8ed9c] text-[#23442e]",
                    shouldAnimate && "scale-110 shadow-[0_0_0_7px_#e7f2dd]",
                  )}
                >
                  <Icon size={compact ? 16 : 20} weight="bold" />
                </span>
                <span className={cn(
                  "absolute",
                  compact
                    ? "left-1/2 top-12 w-[4.5rem] -translate-x-1/2 text-center"
                    : cn("top-1/2 w-36 -translate-y-1/2 sm:w-44", sideLabel),
                )}>
                  <span className={cn("block font-extrabold text-[#304735]", compact ? "truncate text-[10px]" : "text-sm")}>{milestone.title}</span>
                  {milestone.label !== milestone.title && (
                    <span className={cn("block text-[#718075]", compact ? "text-[9px]" : "mt-0.5 text-xs font-semibold")}>{milestone.label}</span>
                  )}
                  {!compact && milestone.description && (
                    <span className="mt-1 block text-xs leading-5 text-[#718075]">{milestone.description}</span>
                  )}
                  {!compact && milestone.state === "current" && (
                    <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-[#4d8057]">Mốc tiếp theo</span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
