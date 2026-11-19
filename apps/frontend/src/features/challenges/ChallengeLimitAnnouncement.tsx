import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuthSession } from "../../api/auth-session";
import { createChallengesClient } from "../../api/challenges-client";
import { useResource } from "../../api/useResource";
import { Button } from "../../components/ui";

const api = createChallengesClient();

export function ChallengeLimitAnnouncement() {
  const { user, accessToken } = useAuthSession();
  const { pathname } = useLocation();
  const token = user?.role === "MEMBER" ? accessToken : null;
  const { data, reload, setData } = useResource(
    () => token ? api.getUnreadChallengeLimitNotice(token) : Promise.resolve({ notice: null }),
    [token, pathname],
  );
  const [busy, setBusy] = useState(false);
  const [readError, setReadError] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    const refresh = () => { if (!document.hidden) reload(); };
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [token, reload]);

  const notice = data?.notice;
  if (!notice || !token) return null;

  async function markRead(id: number, memberToken: string) {
    setBusy(true);
    setReadError(null);
    try {
      await api.markChallengeLimitNoticeRead(id, memberToken);
      setData({ notice: null });
      reload();
    } catch {
      setReadError(id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside aria-label="Thông báo nhiệm vụ" className="border-b border-[#dbe7d8] bg-[#f1f7ec] px-4 py-2 text-[#274b34]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2">
        <p className="flex-1 text-sm" aria-live="polite">
          <strong>{notice.title}</strong> tăng từ {notice.previousLimit.toLocaleString("vi-VN")} lên {notice.newLimit.toLocaleString("vi-VN")} suất thưởng.
        </p>
        {notice.challengeId !== null && notice.storeSlug && (
          <Link className="text-sm font-semibold underline" to={`/s/${encodeURIComponent(notice.storeSlug)}/challenges/${notice.challengeId}`}>Xem nhiệm vụ</Link>
        )}
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void markRead(notice.id, token)}>Đã đọc</Button>
        {readError === notice.id && <p className="w-full text-sm text-red-700" role="alert">Chưa thể đánh dấu đã đọc. Vui lòng thử lại.</p>}
      </div>
    </aside>
  );
}
