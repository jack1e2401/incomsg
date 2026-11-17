import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useAuthSession } from "../../api/auth-session";
import { createRefundsClient } from "../../api/refunds-client";
import type { RefundRequestStatus } from "../../api/refunds-types";
import { useResource } from "../../api/useResource";
import { Button, Card, ErrorState, LoadingState, PageHeader, Select, StatusText } from "../../components/ui";
import { refundRequestStatusLabel } from "../refunds/refund-status";

const api = createRefundsClient();
const statuses = ["ALL", "PENDING_MERCHANT", "COMPLETED", "REJECTED", "FAILED"] as const;
const money = (value: string) => `${Number(value).toLocaleString("vi-VN")} ₫`;
const dateTime = (value: string) => new Date(value).toLocaleString("vi-VN");

export function AdminRefundHistoryPage() {
  const { accessToken } = useAuthSession();
  const [status, setStatus] = useState<RefundRequestStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const resource = useResource(
    () => api.listAdminRefundRequests({ status: status === "ALL" ? "" : status, page, limit: 10 }, accessToken!),
    [status, page, accessToken],
  );
  const items = resource.data?.items ?? [];
  const totalPages = resource.data?.pagination.totalPages ?? 0;

  return (
    <>
      <PageHeader title="Lịch sử hoàn tiền" />
      <div className="mb-4 max-w-xs">
        <Select aria-label="Lọc trạng thái" value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1); }}>
          {statuses.map((value) => <option key={value} value={value}>{value === "ALL" ? "Tất cả" : refundRequestStatusLabel(value)}</option>)}
        </Select>
      </div>
      {resource.loading ? <LoadingState cards={2} /> : resource.error ? <ErrorState message={resource.error} retry={resource.reload} /> : (
        <div className="space-y-3">
          {items.length === 0 && <Card className="p-6 text-center text-sm muted">Không có yêu cầu hoàn tiền.</Card>}
          {items.map((item) => (
            <Card key={item.id} className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
              <div>
                <p className="font-bold">Đơn #{item.orderId} · {money(item.orderTotalVnd)}</p>
                <p className="mt-1 text-sm muted">{item.memberEmail} · {item.merchantName ?? `Cửa hàng #${item.merchantId}`}</p>
                <StatusText>{refundRequestStatusLabel(item.status)}</StatusText>
              </div>
              <Button variant="outline" onClick={() => setSelectedId(item.id)}>Xem chi tiết</Button>
            </Card>
          ))}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span>Trang {page} / {totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</Button>
                <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Sau</Button>
              </div>
            </div>
          )}
        </div>
      )}
      {selectedId !== null && accessToken && <RefundHistoryDialog requestId={selectedId} token={accessToken} onClose={() => setSelectedId(null)} />}
    </>
  );
}

function RefundHistoryDialog({ requestId, token, onClose }: { requestId: number; token: string; onClose(): void }) {
  const resource = useResource(() => api.getAdminRefundRequest(requestId, token), [requestId, token]);
  const detail = resource.data;
  const request = detail?.refundRequest;
  const settlement = detail?.settlement;
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content aria-describedby={undefined} className="surface fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl p-6">
          <Dialog.Title className="text-xl font-bold">Yêu cầu hoàn tiền #{requestId}</Dialog.Title>
          {resource.loading && <LoadingState cards={1} />}
          {resource.error && <ErrorState message={resource.error} retry={resource.reload} />}
          {detail && request && (
            <div className="mt-4 space-y-4 text-sm">
              <StatusText>{refundRequestStatusLabel(request.status)}</StatusText>
              <dl className="grid gap-2 sm:grid-cols-[auto_1fr]">
                <dt>Cửa hàng</dt><dd>{detail.merchant?.name ?? `#${request.merchantId}`}</dd>
                <dt>Thành viên</dt><dd>{detail.member?.email ?? `#${request.memberId}`}</dd>
                <dt>Đơn hàng</dt><dd>#{detail.order.id} · {money(detail.order.total)}</dd>
                <dt>Yêu cầu của khách</dt><dd>{request.reason}</dd>
                {request.requestedAt && <><dt>Ngày gửi</dt><dd>{dateTime(request.requestedAt)}</dd></>}
                {request.merchantReviewedAt && <><dt>Cửa hàng đã xét duyệt</dt><dd>{dateTime(request.merchantReviewedAt)} · #{request.merchantReviewedById}</dd></>}
                {request.merchantDecisionReason && <><dt>Ghi nhận của cửa hàng</dt><dd>{request.merchantDecisionReason}</dd></>}
                {request.adminReviewedAt && <><dt>Admin đã xét duyệt ở luồng cũ</dt><dd>{dateTime(request.adminReviewedAt)} · #{request.adminReviewedById}</dd></>}
                {request.adminDecisionReason && <><dt>Ghi nhận của Admin</dt><dd>{request.adminDecisionReason}</dd></>}
                {settlement?.status === "COMPLETED" && <><dt>Đã hoàn</dt><dd>{money(settlement.amountVnd)}{settlement.completedAt && ` · ${dateTime(settlement.completedAt)}`}</dd></>}
              </dl>
            </div>
          )}
          <div className="mt-4 flex justify-end"><Button variant="outline" onClick={onClose}>Đóng</Button></div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
