import type { PublicChallengeDto, ChallengeProgressDto } from "../../api/challenges-types";

export const formatChallengeGoal = (challenge: PublicChallengeDto) => {
  const target = Number(challenge.targetValue);
  if (challenge.type === "ORDER_COUNT") return `Mua ${target.toLocaleString("vi-VN")} đơn hàng`;
  if (challenge.type === "DAILY_CHECKIN") return `Điểm danh ${target.toLocaleString("vi-VN")} ngày`;
  return `Chi tiêu ${new Intl.NumberFormat("vi-VN").format(target)} ₫`;
};

export const formatChallengeProgress = (challenge: PublicChallengeDto, progress: ChallengeProgressDto) => {
  const current = Number(progress.currentValue);
  const target = Number(progress.targetValue);
  if (challenge.type === "SPEND_TOTAL") {
    const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;
    return `${money(current)} / ${money(target)}`;
  }
  return `${current.toLocaleString("vi-VN")}/${target.toLocaleString("vi-VN")} ${challenge.type === "ORDER_COUNT" ? "đơn hàng" : "ngày"}`;
};

export const formatChallengeRemaining = (challenge: PublicChallengeDto, progress: ChallengeProgressDto) => {
  const remaining = Number(progress.remainingValue);
  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  if (challenge.type === "SPEND_TOTAL")
    return `Còn thiếu ${new Intl.NumberFormat("vi-VN").format(remaining)} ₫`;
  const unit = challenge.type === "ORDER_COUNT" ? "đơn hàng" : "ngày";
  return `Còn thiếu ${remaining.toLocaleString("vi-VN")} ${unit}`;
};

export function ChallengeProgress({ challenge, progress }: { challenge: PublicChallengeDto; progress: ChallengeProgressDto }) {
  return (
    <div className="mt-4">
      <div className="h-3 overflow-hidden rounded-full bg-[#e8eee5]" role="progressbar" aria-label="Tiến độ nhiệm vụ" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-[#4d8057] transition-[width]" style={{ width: `${Math.max(0, Math.min(progress.percent, 100))}%` }} />
      </div>
      <p className="mt-2 text-sm font-semibold tabular-nums">{formatChallengeProgress(challenge, progress)}</p>
      {formatChallengeRemaining(challenge, progress) && <p className="mt-1 text-xs muted">{formatChallengeRemaining(challenge, progress)}</p>}
    </div>
  );
}

export const challengeStatusLabel = (progress: ChallengeProgressDto | null | undefined, effectiveStatus: string) => {
  if (effectiveStatus === "ENDED") return "Hết hạn";
  if (progress?.rewardState === "WAITING_BUDGET") return "Chờ ngân sách";
  if (progress?.rewardState === "REWARDED") return "Đã nhận thưởng";
  return "Đang làm";
};
