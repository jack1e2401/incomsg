import { useState } from "react";
import { ArrowLeft, CalendarBlank, Clock, Coins, Gift, Sparkle } from "@phosphor-icons/react";
import { Link, useParams } from "react-router-dom";
import { useAuthSession } from "../../api/auth-session";
import { createChallengesClient } from "../../api/challenges-client";
import { createCommerceClient } from "../../api/commerce-http";
import type { MemberChallengeDto, MemberStoreChallengeDetailResponse } from "../../api/challenges-types";
import { useResource } from "../../api/useResource";
import { Button, Card, ErrorState, LoadingState, StatusText } from "../../components/ui";
import { ChallengeMilestonePath } from "./ChallengeMilestonePath";
import { useChallengeProgressAnimation } from "./useChallengeProgressAnimation";
import { challengeStatusLabel, emptyChallengeProgress, formatChallengeGoal, formatRewardLimit } from "./challenge-ui";
import { useStorefrontShell } from "../storefront/storefront-context";

const api = createChallengesClient();
const commerce = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");
const formatPoints = (value: string | number) => {
  const raw = String(value);
  const [integerPart, fractionPart = ""] = raw.split(".", 2);
  if (!/^-?\d+$/.test(integerPart)) return "0";
  try {
    const whole = BigInt(integerPart);
    const fraction = fractionPart.replace(/0+$/, "");
    const sign = integerPart.startsWith("-") && whole === 0n ? "-" : "";
    return `${sign}${whole.toLocaleString("vi-VN")}${fraction ? `,${fraction}` : ""}`;
  } catch {
    return "0";
  }
};

export function ChallengeDetailPage() {
  const { slug = "", challengeId = "" } = useParams();
  const id = Number(challengeId);
  const shell = useStorefrontShell();
  const { user, accessToken } = useAuthSession();
  const member = user?.role === "MEMBER" && Boolean(accessToken);
  const resource = useResource(
    () => member && accessToken
      ? api.getMemberStoreChallenge(slug, id, accessToken)
      : api.getPublicStoreChallenge(slug, id),
    [slug, id, member, accessToken],
  );
  const walletResource = useResource(
    () => member && accessToken && shell?.merchantId
      ? commerce.getMemberWallet(shell.merchantId, accessToken).then((response) => response.wallet)
      : Promise.resolve(null),
    [member, accessToken, shell?.merchantId],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const challenge = resource.data?.challenge as MemberChallengeDto | undefined;
  const progress = member ? challenge?.progress : null;
  const animateReached = useChallengeProgressAnimation(id, progress);

  if (resource.loading && !resource.data) return <LoadingState cards={2} />;
  if (resource.error || !resource.data) {
    return <ErrorState message={resource.error ?? "Không tải được nhiệm vụ."} retry={resource.reload} />;
  }

  const currentChallenge = resource.data.challenge as MemberChallengeDto;
  const currentProgress = member ? currentChallenge.progress : null;
  const journeyProgress = currentProgress ?? emptyChallengeProgress(currentChallenge);
  const detail = member ? resource.data as MemberStoreChallengeDetailResponse : null;
  const checkedInToday = detail?.checkedInToday ?? false;
  const wallet = walletResource.data;
  const storeBase = shell?.basePath ?? `/s/${slug}`;
  const storeName = shell?.storefront?.merchant?.name;
  const remainingDays = Math.max(0, Math.ceil((new Date(currentChallenge.endsAt).getTime() - Date.now()) / 86_400_000));

  async function checkIn() {
    if (!accessToken) return;
    setBusy(true);
    setError("");
    try {
      await api.checkInStore(slug, accessToken);
      resource.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể điểm danh.");
    } finally {
      setBusy(false);
    }
  }

  const canAct = currentChallenge.effectiveStatus === "ACTIVE" &&
    (currentChallenge.rewardSlotsRemaining !== 0 || currentProgress?.rewardSlotClaimed) &&
    (!currentProgress || currentProgress.rewardState === "IN_PROGRESS");
  const action = !canAct ? null : member
    ? currentChallenge.type === "DAILY_CHECKIN"
      ? <Button disabled={busy || checkedInToday} onClick={() => void checkIn()}>{checkedInToday ? "Đã điểm danh hôm nay" : busy ? "Đang điểm danh" : "Điểm danh hôm nay"}</Button>
      : <Button asChild><Link to={`${storeBase}/products`}>Tiếp tục tích lũy</Link></Button>
    : <Button asChild><Link to={`/login?returnTo=${encodeURIComponent(`${storeBase}/challenges/${currentChallenge.id}`)}`}>Tham gia nhiệm vụ</Link></Button>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-4">
      <Link to={`${storeBase}/challenges`} className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-[#356343] transition hover:text-[#20392a]">
        <ArrowLeft size={17} aria-hidden="true" /> Tất cả nhiệm vụ
      </Link>

      <Card className="overflow-hidden border-[#e2eadf] p-0">
        <div className="relative overflow-hidden bg-[#244c34] px-5 py-6 text-white sm:px-8 sm:py-8">
          <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-16 size-48 rounded-full border-[28px] border-white/5" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-14 right-24 size-28 rounded-full bg-[#bde88e]/10 blur-xl" />
          <div className="relative flex flex-wrap items-center gap-2">
            <StatusText className="border-white/20 bg-white/10 text-white"><Sparkle size={13} weight="fill" /> NHIỆM VỤ CỬA HÀNG</StatusText>
            <StatusText className="border-[#d4f2ae] bg-[#d4f2ae] font-extrabold text-[#244c34]"><Gift size={14} /> +{formatPoints(currentChallenge.rewardPoints)} điểm</StatusText>
            <span className="ml-auto text-xs font-semibold text-white/75">{challengeStatusLabel(currentProgress, currentChallenge.effectiveStatus)}</span>
          </div>
          <h1 className="relative mt-5 max-w-2xl text-2xl font-black leading-tight tracking-[-0.03em] sm:text-3xl">{currentChallenge.title}</h1>
          <p className="relative mt-2 max-w-2xl text-sm leading-6 text-white/80">{currentChallenge.description || formatChallengeGoal(currentChallenge)}</p>
          <div className="relative mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-white/80">
            {storeName && <span>{storeName}</span>}
            <span className="inline-flex items-center gap-1.5"><CalendarBlank size={14} /> Kết thúc {new Date(currentChallenge.endsAt).toLocaleDateString("vi-VN")}</span>
            <span className="inline-flex items-center gap-1.5"><Clock size={14} /> {remainingDays > 0 ? `Còn ${remainingDays} ngày` : "Đã đến hạn"}</span>
          </div>
        </div>

        <div className="space-y-5 p-4 sm:p-7">
          {journeyProgress && (
            <ChallengeMilestonePath
              challenge={currentChallenge}
              progress={journeyProgress}
              animateReached={animateReached}
            />
          )}

          {member && (
            <section aria-label="Tổng quan điểm thành viên" className="rounded-2xl border border-[#e5ece2] bg-white p-4 sm:p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-extrabold text-[#294b34]"><Coins size={18} weight="duotone" /> Điểm tại cửa hàng</div>
              {walletResource.loading && !wallet && <p className="text-sm text-[#718075]">Đang tải số dư…</p>}
              {wallet && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[#f2f6ef] px-3 py-3">
                    <p className="text-xs font-medium text-[#718075]">Điểm khả dụng</p>
                    <p className="mt-1 text-xl font-black tabular-nums text-[#274b34]">{wallet.availablePoints.toLocaleString("vi-VN")}</p>
                  </div>
                  <div className="rounded-xl bg-[#f2f6ef] px-3 py-3">
                    <p className="text-xs font-medium text-[#718075]">Tổng tích lũy</p>
                    <p className="mt-1 text-xl font-black tabular-nums text-[#274b34]">{formatPoints(wallet.netLifetimeEarned)}</p>
                  </div>
                </div>
              )}
            </section>
          )}

          <div className="flex flex-col gap-3 border-t border-[#edf1eb] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-[#2d4433]">{formatChallengeGoal(currentChallenge)}</p>
              <p className="mt-1 text-xs text-[#718075]">{formatRewardLimit(currentChallenge) ?? "Điểm thưởng được trao khi hoàn thành toàn bộ mục tiêu."}</p>
            </div>
            {action}
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        </div>
      </Card>

      {detail && detail.recentEntries.length > 0 && (
        <Card className="p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-extrabold text-[#263d2d]">Hoạt động gần đây</h2>
            <Link to={`${storeBase}/wallet`} className="text-xs font-bold text-[#356343]">Lịch sử điểm</Link>
          </div>
          <ul className="mt-2 divide-y divide-[#edf1eb]">
            {detail.recentEntries.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="font-semibold text-[#304735]">{entry.activityType === "DAILY_CHECKIN" ? "Điểm danh" : entry.activityType === "ORDER_PAID" ? "Đơn hàng" : "Hoàn tiền"}</span>
                <span className="ml-auto font-bold tabular-nums text-[#356343]">{Number(entry.deltaValue) > 0 ? `+${entry.deltaValue}` : entry.deltaValue}</span>
                <time className="w-full text-xs text-[#879188] sm:w-auto">{new Date(entry.occurredAt).toLocaleString("vi-VN")}</time>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <details className="group rounded-2xl border border-[#e5ece2] bg-white px-5 py-4">
        <summary className="cursor-pointer list-none font-bold text-[#304735] marker:hidden">Chi tiết chương trình <span className="float-right text-[#6f8c73] transition group-open:rotate-180">⌄</span></summary>
        <div className="mt-3 space-y-2 border-t border-[#edf1eb] pt-3 text-sm leading-6 text-[#718075]">
          <p>{currentChallenge.description || formatChallengeGoal(currentChallenge)}</p>
          <p>Thời gian áp dụng đến {new Date(currentChallenge.endsAt).toLocaleString("vi-VN")}.</p>
          <p>Phần thưởng {formatPoints(currentChallenge.rewardPoints)} điểm được ghi nhận một lần khi thành viên đạt mục tiêu cuối.</p>
        </div>
      </details>
    </div>
  );
}
