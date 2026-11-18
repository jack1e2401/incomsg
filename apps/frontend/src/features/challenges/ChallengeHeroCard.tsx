import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuthSession } from "../../api/auth-session";
import { createChallengesClient } from "../../api/challenges-client";
import type { MemberChallengeDto } from "../../api/challenges-types";
import { useResource } from "../../api/useResource";
import { Button, Card, StatusText } from "../../components/ui";
import { ChallengeMilestonePath } from "./ChallengeMilestonePath";
import { useChallengeProgressAnimation } from "./useChallengeProgressAnimation";
import { emptyChallengeProgress, formatChallengeGoal } from "./challenge-ui";

const challengesApi = createChallengesClient();
const rewardText = (points: string) => `+${Number(points).toLocaleString("vi-VN")} điểm`;
const deadlineText = (date: string) => `Đến ${new Date(date).toLocaleDateString("vi-VN")}`;

export function ChallengeHeroCard({ slug, storeBase }: { slug: string; storeBase: string }) {
  const { user, accessToken } = useAuthSession();
  const member = user?.role === "MEMBER" && Boolean(accessToken);
  const resource = useResource(
    async () => member && accessToken
      ? await challengesApi.listMemberStoreChallenges(slug, accessToken)
      : await challengesApi.listPublicStoreChallenges(slug),
    [slug, member, accessToken],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const data = resource.data;
  const hero = data?.heroChallenge;
  const confirmedProgress = member && hero ? (hero as MemberChallengeDto).progress : null;
  const progress = member && hero ? confirmedProgress ?? emptyChallengeProgress(hero) : null;
  const animateReached = useChallengeProgressAnimation(hero?.id ?? 0, confirmedProgress);
  if ((resource.loading && !data) || resource.error || !hero) return null;
  const todayDone = member && (data as import("../../api/challenges-types").MemberStoreChallengesResponse).checkedInToday;
  const loginTo = `/login?returnTo=${encodeURIComponent(`${storeBase}/challenges/${hero.id}`)}`;
  const checkIn = async () => {
    if (!accessToken) return;
    setBusy(true); setError("");
    try { await challengesApi.checkInStore(slug, accessToken); resource.reload(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể điểm danh."); }
    finally { setBusy(false); }
  };
  const action = !member
    ? <Button asChild><Link to={loginTo}>Đăng nhập để bắt đầu</Link></Button>
    : hero.type === "DAILY_CHECKIN"
      ? <Button disabled={busy || todayDone} onClick={() => void checkIn()}>{todayDone ? "Đã điểm danh hôm nay" : busy ? "Đang điểm danh" : "Điểm danh ngay"}</Button>
      : hero.type === "ORDER_COUNT"
        ? <Button asChild><Link to={`${storeBase}/products`}>Mua thêm đơn</Link></Button>
        : <Button asChild><Link to={`${storeBase}/challenges/${hero.id}`}>Xem nhiệm vụ</Link></Button>;
  const headline = progress?.rewardState === "WAITING_BUDGET" ? "Hoàn thành — đang chờ bổ sung ngân sách" : hero.type === "DAILY_CHECKIN" && !todayDone ? `Điểm danh ngay hôm nay để nhận ${Number(hero.rewardPoints).toLocaleString("vi-VN")} điểm` : progress && Number(progress.remainingValue) > 0 ? `Chỉ còn ${Number(progress.remainingValue).toLocaleString("vi-VN")} ${hero.type === "ORDER_COUNT" ? "đơn" : hero.type === "DAILY_CHECKIN" ? "ngày" : "₫"} nữa để nhận ${Number(hero.rewardPoints).toLocaleString("vi-VN")} điểm!` : "Tiếp tục nhiệm vụ để nhận thưởng";
  return <Card className="border-[#dbe7d8] bg-[#f8fbf6] p-5 sm:p-7">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><StatusText tone="green">{rewardText(hero.rewardPoints)}</StatusText>{hero.endsAt && <span className="text-xs muted">{deadlineText(hero.endsAt)}</span>}</div>
        <h2 className="mt-2 text-xl font-extrabold text-[#20392a]">{member ? headline : hero.title}</h2>
        {member ? <p className="mt-1 font-semibold">{hero.title}</p> : <p className="mt-1 text-sm muted">{formatChallengeGoal(hero)}</p>}
        {progress && <ChallengeMilestonePath challenge={hero} progress={progress} animateReached={animateReached} compact />}
        {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">{action}<Link className="text-sm font-semibold text-[#357044] underline" to={`${storeBase}/challenges`}>Xem tất cả nhiệm vụ</Link></div>
    </div>
  </Card>;
}
