import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuthSession } from "../../api/auth-session";
import { createChallengesClient } from "../../api/challenges-client";
import type { MemberChallengeDto } from "../../api/challenges-types";
import { useResource } from "../../api/useResource";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, StatusText } from "../../components/ui";
import { ChallengeMilestonePath } from "./ChallengeMilestonePath";
import { challengeStatusLabel, emptyChallengeProgress, formatChallengeGoal, formatRewardLimit } from "./challenge-ui";

const api = createChallengesClient();
type Tab = "active" | "completed" | "ended";

export function ChallengesPage() {
  const { slug = "" } = useParams();
  const { user, accessToken } = useAuthSession();
  const member = user?.role === "MEMBER" && Boolean(accessToken);
  const [tab, setTab] = useState<Tab>("active");
  const resource = useResource(
    () => member && accessToken ? api.listMemberStoreChallenges(slug, accessToken) : api.listPublicStoreChallenges(slug),
    [slug, member, accessToken],
  );
  if (resource.loading && !resource.data) return <LoadingState cards={3} />;
  if (resource.error || !resource.data) return <ErrorState message={resource.error ?? "Không tải được nhiệm vụ."} retry={resource.reload} />;
  const challenges = resource.data.challenges;
  const visible = challenges.filter((item) => {
    const progress = member ? (item as MemberChallengeDto).progress : null;
    if (tab === "ended") return item.effectiveStatus === "ENDED";
    if (tab === "completed") return Boolean(progress && progress.rewardState !== "IN_PROGRESS");
    return item.effectiveStatus !== "ENDED" && (!progress || progress.rewardState === "IN_PROGRESS");
  });
  const tabs: Array<[Tab, string]> = [["active", "Đang thực hiện"], ["completed", "Đã hoàn thành"], ["ended", "Hết hạn"]];
  return <section className="space-y-5">
    <PageHeader title="Nhiệm vụ" description={resource.data.merchant.name} />
    <div className="flex min-w-0 flex-nowrap gap-1.5 overflow-x-auto" role="tablist" aria-label="Trạng thái nhiệm vụ">
      {tabs.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold sm:px-4 sm:py-2 sm:text-sm ${tab === key ? "bg-[#335e3d] text-white" : "bg-[#edf2eb] text-[#425349]"}`}>{label}</button>)}
    </div>
    {!visible.length ? <EmptyState title="Chưa có nhiệm vụ" description="Nhiệm vụ phù hợp sẽ xuất hiện tại đây." /> : <div className="grid gap-4 md:grid-cols-2">
      {visible.map((challenge) => {
        const progress = member ? (challenge as MemberChallengeDto).progress : null;
        const journeyProgress = member ? progress ?? emptyChallengeProgress(challenge) : null;
        const status = challengeStatusLabel(progress, challenge.effectiveStatus);
        const limit = formatRewardLimit(challenge);
        return <Card key={challenge.id} className="p-5">
          <div className="flex items-start justify-between gap-3"><h2 className="font-extrabold">{challenge.title}</h2><StatusText tone={status === "Hết hạn" ? "neutral" : status === "Chờ ngân sách" ? "amber" : status === "Đã nhận thưởng" ? "green" : "neutral"}>{status}</StatusText></div>
          <p className="mt-2 text-sm muted">{challenge.description}</p>
          <p className="mt-3 text-sm font-bold text-[#357044]">+{Number(challenge.rewardPoints).toLocaleString("vi-VN")} điểm</p>
          {limit && <p className="mt-1 text-sm muted">{limit}</p>}
          <p className="mt-1 text-xs muted">{new Date(challenge.endsAt).toLocaleDateString("vi-VN")}</p>
          {journeyProgress ? <ChallengeMilestonePath challenge={challenge} progress={journeyProgress} compact /> : <p className="mt-3 text-sm">{formatChallengeGoal(challenge)}</p>}
          <div className="mt-4">{member || challenge.rewardSlotsRemaining === 0 ? <Button asChild variant="outline"><Link to={`/s/${slug}/challenges/${challenge.id}`}>Xem nhiệm vụ</Link></Button> : <Button asChild><Link to={`/login?returnTo=${encodeURIComponent(`/s/${slug}/challenges/${challenge.id}`)}`}>Đăng nhập để bắt đầu</Link></Button>}</div>
        </Card>;
      })}
    </div>}
  </section>;
}
