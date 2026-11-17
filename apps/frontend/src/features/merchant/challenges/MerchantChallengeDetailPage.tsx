import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { createChallengesClient } from "../../../api/challenges-client";
import { useResource } from "../../../api/useResource";
import { Button, Card, ErrorState, LoadingState, PageHeader, StatusText } from "../../../components/ui";
import { useToken } from "../merchant-page-support";

const api = createChallengesClient();
const formatPts = (value: string) => Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 4 });
export function MerchantChallengeDetailPage() {
  const { challengeId = "" } = useParams(); const id = Number(challengeId); const token = useToken(); const [page, setPage] = useState(1);
  const resource = useResource(() => api.getMerchantChallenge(id, token, page, 20), [id, token, page]);
  if (!Number.isSafeInteger(id) || id <= 0) return <ErrorState message="Mã nhiệm vụ không hợp lệ." retry={() => location.assign("/merchant/challenges")} />;
  if (resource.loading) return <LoadingState />;
  if (resource.error || !resource.data) return <ErrorState message={resource.error ?? "Không tìm thấy nhiệm vụ."} retry={resource.reload} />;
  const { challenge: c, participants, recentGrants } = resource.data;
  return <div className="space-y-5"><Link to="/merchant/challenges" className="text-sm underline">← Danh sách nhiệm vụ</Link><PageHeader title={c.title} description={c.description} /><Card className="grid gap-4 p-5 sm:grid-cols-3"><p>Trạng thái<br/><StatusText>{c.effectiveStatus}</StatusText></p><p>Loại / Mục tiêu<br/>{c.type} · {c.targetValue}</p><p>Ngày<br/>{new Date(c.startsAt).toLocaleDateString("vi-VN")} – {new Date(c.endsAt).toLocaleDateString("vi-VN")}</p><p>Đang tham gia<br/><b>{c.inProgressCount}</b></p><p>Hoàn thành<br/><b>{c.completedCount}</b></p><p>Chờ ngân sách<br/><b>{c.waitingBudgetCount}</b></p><p>Tổng điểm đã phát<br/><b>{formatPts(c.budgetSpent)}</b></p><p>Ngân sách<br/><b>{formatPts(c.budgetTotal)}</b></p><p>Còn lại<br/><b>{formatPts(c.budgetRemaining)}</b></p></Card>
    <Card className="overflow-x-auto p-5"><h2 className="mb-3 font-bold">Thành viên</h2><table className="w-full min-w-[700px] text-left text-sm"><thead><tr><th>Email</th><th>Tiến độ</th><th>Trạng thái thưởng</th><th>Hoàn thành lúc</th></tr></thead><tbody>{participants.items.map((p) => <tr key={p.progressId} className="border-t"><td className="py-2">{p.memberEmail}</td><td>{p.currentValue} / {p.targetValue}</td><td>{p.rewardState}</td><td>{p.completedAt ? new Date(p.completedAt).toLocaleString("vi-VN") : "—"}</td></tr>)}</tbody></table><div className="mt-3 flex justify-end gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>Trước</Button><span className="self-center">{participants.pagination.page} / {Math.max(1, participants.pagination.totalPages)}</span><Button variant="outline" disabled={page >= participants.pagination.totalPages} onClick={() => setPage((n) => n + 1)}>Sau</Button></div></Card>
    <Card className="p-5"><h2 className="font-bold">Thưởng đã phát và thu hồi</h2><ul className="mt-3 divide-y">{recentGrants.map((g) => <li key={g.id} className="py-2 text-sm">{g.memberEmail} · {formatPts(g.pointsGranted)} điểm · {g.status} · {new Date(g.grantedAt).toLocaleString("vi-VN")}{g.reversedAt && ` · Thu hồi ${new Date(g.reversedAt).toLocaleString("vi-VN")}`}</li>)}{recentGrants.length === 0 && <li className="py-2 text-sm muted">Chưa có giao dịch thưởng.</li>}</ul></Card>
  </div>;
}
