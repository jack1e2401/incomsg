import { useState } from "react";
import { createRefundsClient } from "../../../api/refunds-client";
import type { RefundRequestListItemDto, RefundRequestStatus } from "../../../api/refunds-types";
import { useResource } from "../../../api/useResource";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, Select, StatusText } from "../../../components/ui";
import { useToken } from "../merchant-page-support";
import { MerchantRefundReviewDialog } from "./MerchantRefundReviewDialog";

const api = createRefundsClient();
const states: Array<RefundRequestStatus | "ALL"> = ["ALL", "PENDING_MERCHANT", "PENDING_ADMIN", "REJECTED", "COMPLETED"];
export function MerchantRefundRequestsPage() {
  const token = useToken(); const [status, setStatus] = useState<RefundRequestStatus | "ALL">("PENDING_MERCHANT"); const [page, setPage] = useState(1); const [selected, setSelected] = useState<RefundRequestListItemDto | null>(null); const [revision, setRevision] = useState(0);
  const resource = useResource(() => api.listMerchantRefundRequests({ status: status === "ALL" ? "" : status, page, limit: 20 }, token), [status, page, token, revision]);
  return <div className="space-y-5"><PageHeader title="Yêu cầu hoàn tiền" description="Xem yêu cầu và chuyển các yêu cầu hợp lệ cho Admin duyệt." /><Select aria-label="Lọc trạng thái" value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }}>{states.map((s) => <option key={s} value={s}>{s === "ALL" ? "Tất cả trạng thái" : s}</option>)}</Select>
    {resource.loading ? <LoadingState /> : resource.error ? <ErrorState message={resource.error} retry={resource.reload} /> : !resource.data?.items.length ? <EmptyState title="Không có yêu cầu hoàn tiền" description="Yêu cầu sẽ xuất hiện tại đây khi thành viên gửi." /> : <><div className="space-y-3">{resource.data.items.map((r) => <Card key={r.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto]"><div><div className="flex flex-wrap gap-3"><b>Yêu cầu #{r.id}</b><StatusText>{r.status}</StatusText></div><p className="mt-1 text-sm">Đơn #{r.orderId} · {r.memberEmail} · {Number(r.orderTotalVnd).toLocaleString("vi-VN")} ₫</p><p className="mt-1 text-sm muted">{r.reason}</p><p className="mt-1 text-xs muted">{new Date(r.requestedAt).toLocaleString("vi-VN")}</p></div><Button variant="outline" onClick={() => setSelected(r)}>{r.status === "PENDING_MERCHANT" ? "Xem & Duyệt" : "Chi tiết"}</Button></Card>)}</div><div className="flex justify-end items-center gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>Trước</Button><span>{resource.data.pagination.page} / {Math.max(1, resource.data.pagination.totalPages)}</span><Button variant="outline" disabled={page >= resource.data.pagination.totalPages} onClick={() => setPage((n) => n + 1)}>Sau</Button></div></>}
    <MerchantRefundReviewDialog requestId={selected?.id ?? null} token={token} onClose={() => setSelected(null)} onUpdated={() => { setSelected(null); setRevision((n) => n + 1); }} />
  </div>;
}
