import { ArrowUpRight, CalendarBlank, Coins, UsersThree } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import type { MerchantChallengeDto } from "../../../api/challenges-types";
import { Card, StatusText } from "../../../components/ui";
import { challengeStatusLabel, challengeTypeLabel } from "./challenge-labels";
import { MerchantChallengeActions, type MerchantChallengeAction } from "./MerchantChallengeActions";

const formatNumber = (value: string) => Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 4 });
const date = (value: string) => new Date(value).toLocaleDateString("vi-VN", { day: "numeric", month: "short", year: "numeric" });

function goalText(challenge: MerchantChallengeDto) {
  if (challenge.type === "ORDER_COUNT") return `${formatNumber(challenge.targetValue)} đơn hàng`;
  if (challenge.type === "DAILY_CHECKIN") return `${formatNumber(challenge.targetValue)} ngày điểm danh`;
  return `${formatNumber(challenge.targetValue)} ₫ chi tiêu`;
}

function statusTone(status: MerchantChallengeDto["effectiveStatus"]) {
  if (status === "ACTIVE") return "green" as const;
  if (status === "ENDED" || status === "ARCHIVED") return "neutral" as const;
  return "amber" as const;
}

export function MerchantChallengeCard({
  challenge,
  onAction,
}: {
  challenge: MerchantChallengeDto;
  onAction(action: MerchantChallengeAction): void;
}) {
  const total = Number(challenge.budgetTotal);
  const spent = Number(challenge.budgetSpent);
  const spentPercent = total > 0 && Number.isFinite(spent / total)
    ? Math.min(100, Math.max(0, (spent / total) * 100))
    : 0;

  return (
    <Card className="group flex h-full flex-col overflow-hidden p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_46px_rgba(39,62,42,.09)] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#eff4ec] px-3 py-1 text-xs font-bold text-[#49654e]">{challengeTypeLabel(challenge.type)}</span>
          {challenge.isFeatured && <span className="rounded-full bg-[#fff4dc] px-3 py-1 text-xs font-bold text-[#8c642b]">Nổi bật</span>}
        </div>
        <StatusText tone={statusTone(challenge.effectiveStatus)}>{challengeStatusLabel(challenge.effectiveStatus)}</StatusText>
      </div>

      <h2 className="mt-5 text-xl font-extrabold leading-snug tracking-[-.025em] text-[#20392a]">
        <Link className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[#91b297]" to={`/merchant/challenges/${challenge.id}`}>
          {challenge.title}
        </Link>
      </h2>
      <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 muted">{challenge.description || "Chi tiết mục tiêu và tiến độ chiến dịch."}</p>

      <div className="mt-5 rounded-2xl bg-[#f7f9f5] p-4">
        <p className="text-xs font-bold uppercase tracking-[.08em] text-[#738276]">Mục tiêu</p>
        <p className="mt-1.5 text-base font-extrabold text-[#294733]">{goalText(challenge)}</p>
        <p className="mt-3 flex items-center gap-2 text-xs text-[#68776d]"><CalendarBlank size={15} />{date(challenge.startsAt)} <span aria-hidden="true">→</span> {date(challenge.endsAt)}</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-[#738276]"><Coins size={15} />Điểm thưởng</p>
          <p className="mt-1 text-lg font-extrabold tabular-nums text-[#20392a]">{formatNumber(challenge.rewardPoints)}</p>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-[#738276]"><UsersThree size={15} />Hoàn thành</p>
          <p className="mt-1 text-lg font-extrabold tabular-nums text-[#20392a]">{challenge.completedCount.toLocaleString("vi-VN")}</p>
        </div>
      </div>

      <div className="mt-5 border-t border-[#edf1ea] pt-4">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-[#596b5d]">Ngân sách đã sử dụng</span>
          <span className="tabular-nums text-[#596b5d]">{formatNumber(challenge.budgetSpent)} / {formatNumber(challenge.budgetTotal)}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e8eee5]" role="progressbar" aria-label={`Ngân sách đã sử dụng cho ${challenge.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(spentPercent)}>
          <span className="block h-full rounded-full bg-[#5b8962] transition-[width] duration-500" style={{ width: `${spentPercent}%` }} />
        </div>
      </div>

      <div className="relative mt-auto flex items-center justify-between gap-3 pt-5">
        <Link aria-label={`Xem chi tiết nhiệm vụ ${challenge.title}`} to={`/merchant/challenges/${challenge.id}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#315e3d] px-4 text-sm font-bold text-white transition hover:bg-[#274f32] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#91b297]">
          Xem chi tiết <ArrowUpRight size={17} weight="bold" />
        </Link>
        <MerchantChallengeActions challenge={challenge} onAction={onAction} />
      </div>
    </Card>
  );
}
