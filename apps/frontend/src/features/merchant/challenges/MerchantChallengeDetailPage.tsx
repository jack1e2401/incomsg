import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarBlank,
  CheckCircle,
  Coins,
  Gift,
  UsersThree,
} from "@phosphor-icons/react";
import { Link, useParams } from "react-router-dom";
import { createChallengesClient } from "../../../api/challenges-client";
import type {
  ChallengeParticipantDto,
  ChallengeRewardState,
  MerchantChallengeDto,
} from "../../../api/challenges-types";
import { useResource } from "../../../api/useResource";
import { Button, Card, ErrorState, LoadingState, PageHeader, StatusText } from "../../../components/ui";
import { useToken } from "../merchant-page-support";
import {
  challengeGrantStatusLabel,
  challengeRewardStateLabel,
  challengeStatusLabel,
  challengeTypeLabel,
} from "./challenge-labels";
import { MerchantChallengeStatusAction } from "./MerchantChallengeStatusAction";

const api = createChallengesClient();
const formatPts = (value: string) => Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 4 });
const shortDate = (value: string) =>
  new Date(value).toLocaleDateString("vi-VN", { day: "numeric", month: "short", year: "numeric" });
const dateTime = (value: string) =>
  new Date(value).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });

function goalText(challenge: MerchantChallengeDto) {
  const target = formatPts(challenge.targetValue);
  if (challenge.type === "ORDER_COUNT") return `${target} đơn hàng`;
  if (challenge.type === "DAILY_CHECKIN") return `${target} ngày điểm danh`;
  return `${target} ₫ chi tiêu`;
}

function participantProgress(challenge: MerchantChallengeDto, participant: ChallengeParticipantDto) {
  const unit = challenge.type === "ORDER_COUNT" ? "đơn" : challenge.type === "DAILY_CHECKIN" ? "ngày" : "₫";
  return `${formatPts(participant.currentValue)} / ${formatPts(participant.targetValue)} ${unit}`;
}

function rewardTone(state: ChallengeRewardState) {
  if (state === "REWARDED") return "green" as const;
  if (state === "WAITING_BUDGET") return "amber" as const;
  return "neutral" as const;
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Gift;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-[#f7f9f5] p-4">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.07em] text-[#77867a]">
        <Icon size={16} />
        {label}
      </p>
      <p className="mt-2 break-words text-base font-extrabold leading-snug text-[#294733] sm:text-lg">
        {value}
      </p>
      {detail && <p className="mt-1 text-xs leading-5 muted">{detail}</p>}
    </div>
  );
}

function ParticipantCard({
  challenge,
  participant,
}: {
  challenge: MerchantChallengeDto;
  participant: ChallengeParticipantDto;
}) {
  return (
    <li className="rounded-2xl border border-[#e8ede5] bg-white p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <p className="min-w-0 break-all text-sm font-bold text-[#294733]">{participant.memberEmail}</p>
        <StatusText tone={rewardTone(participant.rewardState)}>
          {challengeRewardStateLabel(participant.rewardState)}
        </StatusText>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[#77867a]">Tiến độ</p>
          <p className="mt-1 text-sm font-extrabold tabular-nums text-[#294733]">
            {participantProgress(challenge, participant)}
          </p>
        </div>
        <p className="text-right text-xs text-[#77867a]">
          {participant.completedAt ? dateTime(participant.completedAt) : "Đang tham gia"}
        </p>
      </div>
    </li>
  );
}

export function MerchantChallengeDetailPage() {
  const { challengeId = "" } = useParams();
  const id = Number(challengeId);
  const token = useToken();
  const [page, setPage] = useState(1);
  const resource = useResource(() => api.getMerchantChallenge(id, token, page, 20), [id, token, page]);

  if (!Number.isSafeInteger(id) || id <= 0)
    return (
      <ErrorState message="Mã nhiệm vụ không hợp lệ." retry={() => location.assign("/merchant/challenges")} />
    );
  if (resource.loading) return <LoadingState cards={3} />;
  if (resource.error || !resource.data)
    return <ErrorState message={resource.error ?? "Không tìm thấy nhiệm vụ."} retry={resource.reload} />;

  const { challenge, participants, recentGrants, limitChanges = [] } = resource.data;
  const totalBudget = Number(challenge.budgetTotal);
  const usedBudget = Number(challenge.budgetSpent);
  const usedPercent =
    totalBudget > 0 && Number.isFinite(usedBudget / totalBudget)
      ? Math.min(100, Math.max(0, (usedBudget / totalBudget) * 100))
      : 0;
  const statusTone =
    challenge.effectiveStatus === "ACTIVE"
      ? "green"
      : challenge.effectiveStatus === "PAUSED"
        ? "amber"
        : "neutral";
  const totalPages = Math.max(1, participants.pagination.totalPages);

  return (
    <section className="mx-auto max-w-6xl space-y-6 pb-8">
      <Link
        to="/merchant/challenges"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#49654e] hover:text-[#20392a]"
      >
        <ArrowLeft size={17} /> Danh sách nhiệm vụ
      </Link>
      <PageHeader
        title={challenge.title}
        description={challenge.description || "Theo dõi hiệu quả, thành viên và ngân sách của chiến dịch."}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <MerchantChallengeStatusAction challenge={challenge} token={token} onSuccess={resource.reload} />
            <Button asChild variant="outline">
              <Link to={`/merchant/challenges/${id}/edit`}>
                Chỉnh sửa nhiệm vụ <ArrowUpRight size={17} />
              </Link>
            </Button>
          </div>
        }
      />

      <Card className="overflow-hidden p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <StatusText tone={statusTone}>{challengeStatusLabel(challenge.effectiveStatus)}</StatusText>
          <span className="rounded-full bg-[#eff4ec] px-3 py-1 text-xs font-bold text-[#49654e]">
            {challengeTypeLabel(challenge.type)}
          </span>
          {challenge.isFeatured && (
            <span className="rounded-full bg-[#fff4dc] px-3 py-1 text-xs font-bold text-[#8c642b]">
              Nổi bật trên cửa hàng
            </span>
          )}
        </div>
        <h2 className="mt-5 text-xs font-bold uppercase tracking-[.1em] text-[#77867a]">
          Cấu hình chiến dịch
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={CheckCircle} label="Mục tiêu" value={goalText(challenge)} />
          <Metric
            icon={CalendarBlank}
            label="Thời gian"
            value={`${shortDate(challenge.startsAt)} – ${shortDate(challenge.endsAt)}`}
          />
          <Metric
            icon={Gift}
            label="Điểm thưởng cuối"
            value={`${formatPts(challenge.rewardPoints)} điểm`}
            detail="Trao khi hoàn thành toàn bộ mục tiêu."
          />
          <Metric
            icon={Coins}
            label="Ngân sách còn lại"
            value={`${formatPts(challenge.budgetRemaining)} điểm`}
            detail={`Tổng ngân sách ${formatPts(challenge.budgetTotal)} điểm`}
          />
          <Metric
            icon={UsersThree}
            label="Suất thưởng"
            value={challenge.maxRewardRecipients == null ? "Không giới hạn" : `${(challenge.rewardSlotsRemaining ?? 0).toLocaleString("vi-VN")} còn lại`}
            detail={challenge.maxRewardRecipients == null ? undefined : `Tối đa ${challenge.maxRewardRecipients.toLocaleString("vi-VN")} hội viên`}
          />
        </div>
        <div className="mt-5 rounded-2xl border border-[#e8ede5] p-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="font-bold text-[#425748]">Ngân sách đã sử dụng</p>
            <p className="tabular-nums text-[#637269]">
              {formatPts(challenge.budgetSpent)} / {formatPts(challenge.budgetTotal)} điểm
            </p>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-[#e8eee5]"
            role="progressbar"
            aria-label="Tỷ lệ ngân sách đã sử dụng"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(usedPercent)}
          >
            <div
              className="h-full rounded-full bg-[#5b8962] transition-[width] duration-500"
              style={{ width: `${usedPercent}%` }}
            />
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={UsersThree}
          label="Đang tham gia"
          value={challenge.inProgressCount.toLocaleString("vi-VN")}
        />
        <Metric
          icon={CheckCircle}
          label="Đã hoàn thành"
          value={challenge.completedCount.toLocaleString("vi-VN")}
        />
        <Metric
          icon={Gift}
          label="Chờ ngân sách"
          value={challenge.waitingBudgetCount.toLocaleString("vi-VN")}
          detail="Mục tiêu xong, đang chờ cấp thưởng."
        />
        <Metric
          icon={Coins}
          label="Điểm thưởng ròng đã cấp"
          value={`${formatPts(challenge.budgetSpent)} điểm`}
        />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#edf1ea] p-5 sm:px-6">
          <div>
            <h2 className="text-lg font-extrabold text-[#20392a]">Thành viên tham gia</h2>
            <p className="mt-1 text-sm muted">Tiến độ và trạng thái thưởng được cập nhật từ chiến dịch.</p>
          </div>
          <span className="text-xs font-semibold text-[#708074]">
            {participants.pagination.totalItems.toLocaleString("vi-VN")} thành viên
          </span>
        </div>

        <div className="hidden md:block">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="bg-[#edf3ee] text-xs uppercase tracking-[.06em] text-[#344b3b]">
              <tr>
                <th className="w-[38%] px-5 py-3 font-bold">Thành viên</th>
                <th className="w-[24%] px-3 py-3 font-bold">Tiến độ</th>
                <th className="w-[20%] px-3 py-3 font-bold">Trạng thái thưởng</th>
                <th className="w-[18%] px-3 py-3 font-bold">Hoàn thành</th>
              </tr>
            </thead>
            <tbody>
              {participants.items.map((participant) => (
                <tr key={participant.progressId} className="border-t border-[#edf1ea]">
                  <td className="break-all px-5 py-4 font-semibold text-[#31483a]">
                    {participant.memberEmail}
                  </td>
                  <td className="px-3 py-4 tabular-nums">{participantProgress(challenge, participant)}</td>
                  <td className="px-3 py-4">
                    <StatusText tone={rewardTone(participant.rewardState)}>
                      {challengeRewardStateLabel(participant.rewardState)}
                    </StatusText>
                  </td>
                  <td className="px-3 py-4 text-xs text-[#77867a]">
                    {participant.completedAt ? dateTime(participant.completedAt) : "Đang tham gia"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="space-y-3 p-4 md:hidden">
          {participants.items.map((participant) => (
            <ParticipantCard key={participant.progressId} challenge={challenge} participant={participant} />
          ))}
        </ul>

        <nav
          aria-label="Phân trang thành viên"
          className="flex flex-wrap items-center justify-end gap-3 border-t border-[#edf1ea] px-4 py-4 sm:px-6"
        >
          <span className="mr-auto text-xs muted">
            Trang {participants.pagination.page} / {totalPages}
          </span>
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
            Trước
          </Button>
          <Button
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Sau
          </Button>
        </nav>
      </Card>

      {limitChanges.length > 0 && <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-extrabold">Lịch sử tăng suất thưởng</h2>
        <ul className="mt-2 divide-y divide-[#edf1ea]">
          {limitChanges.map((change) => <li key={change.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
            <span>{change.previousLimit.toLocaleString("vi-VN")} → {change.newLimit.toLocaleString("vi-VN")} suất</span>
            <time dateTime={change.createdAt}>{dateTime(change.createdAt)}</time>
          </li>)}
        </ul>
      </Card>}

      <Card className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#edf4e9] text-[#315e3d]">
            <Coins size={20} />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-[#20392a]">Lịch sử điểm thưởng</h2>
            <p className="mt-1 text-sm muted">Gồm điểm đã phát và các khoản được thu hồi.</p>
          </div>
        </div>
        {recentGrants.length ? (
          <ul className="mt-4 divide-y divide-[#edf1ea]">
            {recentGrants.map((grant) => (
              <li
                key={grant.id}
                className="flex flex-col gap-2 py-4 first:pt-1 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="break-all text-sm font-bold text-[#31483a]">{grant.memberEmail}</p>
                  <p className="mt-1 text-xs text-[#77867a]">
                    Lần {grant.cycle} · {dateTime(grant.grantedAt)}
                    {grant.reversedAt ? ` · Thu hồi ${dateTime(grant.reversedAt)}` : ""}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <StatusText tone={grant.status === "GRANTED" ? "green" : "neutral"}>
                    {challengeGrantStatusLabel(grant.status)}
                  </StatusText>
                  <span
                    className={`text-sm font-extrabold tabular-nums ${grant.status === "REVERSED" ? "text-[#718075]" : "text-[#315e3d]"}`}
                  >
                    {grant.status === "REVERSED" ? "−" : "+"}
                    {formatPts(grant.pointsGranted)} điểm
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-2xl bg-[#f8faf6] p-4 text-sm muted">Chưa có giao dịch điểm thưởng.</p>
        )}
      </Card>
    </section>
  );
}
