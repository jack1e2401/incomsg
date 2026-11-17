import { useState } from "react";
import { createRefundsClient } from "../../../api/refunds-client";
import type { RefundRequestStatus } from "../../../api/refunds-types";
import { useResource } from "../../../api/useResource";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, Select, StatusText } from "../../../components/ui";
import { isRefundAwaitingMerchant, refundRequestStatusLabel } from "../../refunds/refund-status";
import { useToken } from "../merchant-page-support";
import { MerchantRefundReviewDialog } from "./MerchantRefundReviewDialog";

const api = createRefundsClient();
const states = ["ALL", "PENDING_MERCHANT", "REJECTED", "COMPLETED"] as const;

export function MerchantRefundRequestsPage() {
  const token = useToken();
  const [status, setStatus] = useState<RefundRequestStatus | "ALL">("PENDING_MERCHANT");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [decision, setDecision] = useState<RefundRequestStatus | null>(null);
  const resource = useResource(
    () => api.listMerchantRefundRequests({ status: status === "ALL" ? "" : status, page, limit: 20 }, token),
    [status, page, token],
  );
  const items = resource.data?.items ?? [];
  const totalPages = Math.max(1, resource.data?.pagination.totalPages ?? 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Yêu cầu hoàn tiền" />
      <Select aria-label="Lọc trạng thái" value={status} onChange={(event) => {
        setStatus(event.target.value as typeof status);
        setPage(1);
        setDecision(null);
      }}>
        {states.map((value) => (
          <option key={value} value={value}>{value === "ALL" ? "Tất cả trạng thái" : refundRequestStatusLabel(value)}</option>
        ))}
      </Select>
      {decision && <p role="status">{refundRequestStatusLabel(decision)}</p>}
      {resource.loading ? <LoadingState /> : resource.error ? <ErrorState message={resource.error} retry={resource.reload} /> : (
        <>
          {items.length === 0 && <EmptyState title="Không có yêu cầu hoàn tiền" description="Yêu cầu sẽ xuất hiện tại đây khi thành viên gửi." />}
          <div className="space-y-3">
            {items.map((item) => (
              <Card key={item.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex flex-wrap gap-3"><b>Yêu cầu #{item.id}</b><StatusText>{refundRequestStatusLabel(item.status)}</StatusText></div>
                  <p className="mt-1 text-sm">Đơn #{item.orderId} · {item.memberEmail} · {Number(item.orderTotalVnd).toLocaleString("vi-VN")} ₫</p>
                  <p className="mt-1 text-sm muted">{item.reason}</p>
                  <p className="mt-1 text-xs muted">{new Date(item.requestedAt).toLocaleString("vi-VN")}</p>
                </div>
                <Button variant="outline" onClick={() => setSelectedId(item.id)}>{isRefundAwaitingMerchant(item.status) ? "Xem & Duyệt" : "Chi tiết"}</Button>
              </Card>
            ))}
          </div>
          {(page > 1 || totalPages > 1) && (
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</Button>
              <span>Trang {page}</span>
              <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Sau</Button>
            </div>
          )}
        </>
      )}
      {selectedId !== null && (
        <MerchantRefundReviewDialog
          key={selectedId}
          requestId={selectedId}
          token={token}
          onClose={() => setSelectedId(null)}
          onUpdated={(result) => {
            setDecision(result);
            setSelectedId(null);
            resource.reload();
          }}
        />
      )}
    </div>
  );
}
