import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createChallengesClient } from "../../../api/challenges-client";
import type { ChallengeEffectiveStatus, ChallengeType, ListMerchantChallengesParams, MerchantChallengeDto } from "../../../api/challenges-types";
import { useResource } from "../../../api/useResource";
import { useToken } from "../merchant-page-support";
import { Button, EmptyState, ErrorState, LoadingState, PageHeader, Select, StatusText, Input } from "../../../components/ui";
import { ChallengeFormDialog } from "./ChallengeFormDialog";

const api = createChallengesClient();
const statuses: Array<ChallengeEffectiveStatus | "ALL"> = ["ALL", "DRAFT", "ACTIVE", "PAUSED", "ENDED", "ARCHIVED"];
const types: Array<ChallengeType | "ALL"> = ["ALL", "ORDER_COUNT", "DAILY_CHECKIN", "SPEND_TOTAL"];

export function MerchantChallengesPage() {
  const token = useToken();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ChallengeEffectiveStatus | "ALL">("ALL");
  const [type, setType] = useState<ChallengeType | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<MerchantChallengeDto | "new" | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const filters = useMemo<ListMerchantChallengesParams>(() => ({ q, status: status === "ALL" ? "" : status, type: type === "ALL" ? "" : type, page, limit: 20 }), [q, status, type, page]);
  const resource = useResource(() => api.listMerchantChallenges(filters, token), [filters, token, revision]);

  async function action(challenge: MerchantChallengeDto, operation: "activate" | "pause" | "archive" | "feature" | "delete") {
    setError("");
    try {
      if (operation === "activate") await api.activateMerchantChallenge(challenge.id, token);
      if (operation === "pause") await api.pauseMerchantChallenge(challenge.id, token);
      if (operation === "archive") await api.archiveMerchantChallenge(challenge.id, token);
      if (operation === "feature") await api.updateMerchantChallenge(challenge.id, { isFeatured: !challenge.isFeatured }, token);
      if (operation === "delete") await api.deleteMerchantChallenge(challenge.id, token);
      setRevision((n) => n + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể cập nhật nhiệm vụ"); }
  }

  return <div className="space-y-5">
    <PageHeader title="Nhiệm vụ" description="Quản lý nhiệm vụ và ngân sách thưởng." action={<Button onClick={() => setEditing("new")}>Tạo nhiệm vụ</Button>} />
    <div className="grid gap-3 sm:grid-cols-3">
      <Input aria-label="Tìm nhiệm vụ" placeholder="Tìm theo tên…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      <Select aria-label="Lọc trạng thái" value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }}>{statuses.map((s) => <option key={s} value={s}>{s === "ALL" ? "Tất cả trạng thái" : s}</option>)}</Select>
      <Select aria-label="Lọc loại nhiệm vụ" value={type} onChange={(e) => { setType(e.target.value as typeof type); setPage(1); }}>{types.map((t) => <option key={t} value={t}>{t === "ALL" ? "Tất cả loại" : t}</option>)}</Select>
    </div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {resource.loading ? <LoadingState /> : resource.error ? <ErrorState message={resource.error} retry={resource.reload} /> : !resource.data?.items.length ? <EmptyState title="Chưa có nhiệm vụ" description="Tạo nhiệm vụ đầu tiên cho thành viên cửa hàng." /> : <>
      <div className="overflow-x-auto rounded-2xl surface"><table className="w-full min-w-[1050px] text-left text-sm"><thead><tr className="border-b"><th className="p-3">Tiêu đề</th><th>Loại</th><th>Mục tiêu</th><th>Điểm thưởng</th><th>Ngân sách</th><th>Hoàn thành</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{resource.data.items.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="p-3 font-semibold"><Link className="underline" to={`/merchant/challenges/${item.id}`}>{item.title}</Link>{item.isFeatured && <span className="ml-2 text-xs text-amber-700">Nổi bật</span>}</td><td>{item.type}</td><td>{item.targetValue}</td><td>{item.rewardPoints}</td><td>{item.budgetSpent} / {item.budgetTotal}</td><td>{item.completedCount}</td><td><StatusText tone={item.effectiveStatus === "ACTIVE" ? "green" : item.effectiveStatus === "ENDED" ? "amber" : "neutral"}>{item.effectiveStatus}</StatusText></td><td className="p-3"><div className="flex flex-wrap gap-1"><Link className="underline" to={`/merchant/challenges/${item.id}`}>Chi tiết</Link><button className="underline" onClick={() => setEditing(item)}>Sửa</button>{item.status === "ACTIVE" ? <button className="underline" onClick={() => void action(item,"pause")}>Tạm dừng</button> : <button className="underline" onClick={() => void action(item,"activate")}>Kích hoạt</button>}<button className="underline" onClick={() => void action(item,"archive")}>Lưu trữ</button><button className="underline" onClick={() => void action(item,"feature")}>{item.isFeatured ? "Bỏ nổi bật" : "Đặt nổi bật"}</button>{!item.hasProgress && <button className="text-red-700 underline" onClick={() => void action(item,"delete")}>Xóa</button>}</div></td></tr>)}</tbody></table></div>
      <div className="flex items-center justify-end gap-3"><span>Trang {resource.data.pagination.page} / {Math.max(1, resource.data.pagination.totalPages)}</span><Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Trước</Button><Button variant="outline" disabled={page >= resource.data.pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Sau</Button></div>
    </>}
    <ChallengeFormDialog editing={editing} token={token} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setRevision((n) => n + 1); }} />
  </div>;
}
