import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuthSession } from "../../api/auth-session";
import { createChallengesClient } from "../../api/challenges-client";
import type { MemberChallengeDto, MemberStoreChallengeDetailResponse } from "../../api/challenges-types";
import { useResource } from "../../api/useResource";
import { Button, Card, ErrorState, LoadingState, StatusText } from "../../components/ui";
import { ChallengeMilestonePath } from "./ChallengeMilestonePath";
import { useChallengeProgressAnimation } from "./useChallengeProgressAnimation";
import { challengeStatusLabel, formatChallengeGoal } from "./challenge-ui";

const api = createChallengesClient();

export function ChallengeDetailPage() {
  const { slug = "", challengeId = "" } = useParams();
  const id = Number(challengeId);
  const { user, accessToken } = useAuthSession();
  const member = user?.role === "MEMBER" && Boolean(accessToken);
  const resource = useResource(() => member && accessToken ? api.getMemberStoreChallenge(slug, id, accessToken) : api.getPublicStoreChallenge(slug, id), [slug, id, member, accessToken]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const challenge = resource.data?.challenge as MemberChallengeDto | undefined;
  const progress = member ? challenge?.progress : null;
  const animateReached = useChallengeProgressAnimation(id, progress);
  if (resource.loading && !resource.data) return <LoadingState cards={2} />;
  if (resource.error || !resource.data) return <ErrorState message={resource.error ?? "Không tải được nhiệm vụ."} retry={resource.reload} />;
  const currentChallenge = resource.data.challenge as MemberChallengeDto;
  const currentProgress = member ? currentChallenge.progress : null;
  const checkedInToday = member && (resource.data as MemberStoreChallengeDetailResponse).checkedInToday;
  async function checkIn() {
    if (!accessToken) return;
    setBusy(true); setError("");
    try { await api.checkInStore(slug, accessToken); resource.reload(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể điểm danh."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-4">
    <Card className="p-5 sm:p-7">
      <div className="flex flex-wrap items-center gap-2"><StatusText tone="green">+{Number(currentChallenge.rewardPoints).toLocaleString("vi-VN")} điểm</StatusText><StatusText>{challengeStatusLabel(currentProgress, currentChallenge.effectiveStatus)}</StatusText></div>
      <h1 className="mt-3 text-2xl font-extrabold">{currentChallenge.title}</h1>
      <p className="mt-2 text-sm leading-6 muted">{currentChallenge.description || formatChallengeGoal(currentChallenge)}</p>
      <p className="mt-4 text-sm"><span className="font-semibold">Điều kiện:</span> {formatChallengeGoal(currentChallenge)}</p>
      <p className="mt-1 text-sm muted">Hạn đến {new Date(currentChallenge.endsAt).toLocaleDateString("vi-VN")}</p>
      {currentProgress && <ChallengeMilestonePath challenge={currentChallenge} progress={currentProgress} animateReached={animateReached} />}
      {currentChallenge.type === "DAILY_CHECKIN" && <div className="mt-5">{member ? <Button disabled={busy || checkedInToday} onClick={() => void checkIn()}>{checkedInToday ? "Đã điểm danh hôm nay" : busy ? "Đang điểm danh" : "Điểm danh hôm nay"}</Button> : <Button asChild><Link to={`/login?returnTo=${encodeURIComponent(`/s/${slug}/challenges/${currentChallenge.id}`)}`}>Đăng nhập để bắt đầu</Link></Button>}</div>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </Card>
    {member && (resource.data as MemberStoreChallengeDetailResponse).recentEntries.length > 0 && <Card className="p-5"><h2 className="font-bold">Hoạt động gần đây</h2><ul className="mt-3 divide-y">{(resource.data as MemberStoreChallengeDetailResponse).recentEntries.map((entry) => <li key={entry.id} className="py-3 text-sm"><span>{entry.activityType === "DAILY_CHECKIN" ? "Điểm danh" : entry.activityType === "ORDER_PAID" ? "Đơn hàng" : "Hoàn tiền"}</span><span className="ml-2 font-semibold">{Number(entry.deltaValue) > 0 ? `+${entry.deltaValue}` : entry.deltaValue}</span><span className="ml-2 text-xs muted">{new Date(entry.occurredAt).toLocaleString("vi-VN")}</span></li>)}</ul></Card>}
  </div>;
}
