import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react";
import { useAuthSession } from "../../api/auth-session";
import { createRefundsClient } from "../../api/refunds-client";
import type { RefundRequestDetailResponse, RefundRequestStatus } from "../../api/refunds-types";
import { useResource } from "../../api/useResource";
import { Button, Card, ErrorState, Field, Input, LoadingState, PageHeader, Select } from "../../components/ui";

const refundsApi = createRefundsClient();
const statusOptions: { value: RefundRequestStatus | "ALL"; label: string }[] = [
  { value: "PENDING_ADMIN", label: "Chờ Admin duyệt" }, { value: "COMPLETED", label: "Đã hoàn tiền" },
  { value: "REJECTED", label: "Đã từ chối" }, { value: "ALL", label: "Tất cả" },
];
const money = (value: string) => `${Number(value || 0).toLocaleString("vi-VN")} ₫`;
const formatPts = (value: string) => Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 4 });

export function AdminRefundApprovalsPage() {
  const { accessToken } = useAuthSession();
  const [status, setStatus] = useState<RefundRequestStatus | "ALL">("PENDING_ADMIN");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [version, setVersion] = useState(0);
  const resource = useResource(
    () => refundsApi.listAdminRefundRequests({ status: status === "ALL" ? "" : status, page, limit: 10 }, accessToken!),
    [status, page, accessToken, version],
  );
  return <>
    <PageHeader title="Duyệt hoàn tiền" />
    <div className="mb-4 max-w-xs"><Select aria-label="Lọc trạng thái" value={status} onChange={(event) => { setStatus(event.target.value as RefundRequestStatus | "ALL"); setPage(1); }}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></div>
    {resource.loading ? <LoadingState cards={2} /> : resource.error ? <ErrorState message={resource.error} retry={resource.reload} /> : !resource.data?.items.length ? <Card className="p-8 text-center text-sm muted">Không có yêu cầu hoàn tiền.</Card> : <>
      <div className="space-y-3">{resource.data.items.map((item) => <Card key={item.id} className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div><p className="font-bold text-[#20392a]">Đơn #{item.orderId} · {money(item.orderTotalVnd)}</p><p className="mt-1 text-sm text-[#5d6f62]">{item.memberEmail} · {item.merchantName ?? `Cửa hàng #${item.merchantId}`}</p><p className="mt-1 text-xs text-[#68786c]">{item.reason}</p></div>
        <Button variant="outline" onClick={() => setSelectedId(item.id)}>Xem và duyệt</Button>
      </Card>)}</div>
      {resource.data.pagination.totalPages > 1 && <div className="mt-5 flex items-center justify-between text-sm"><span>Trang {page} / {resource.data.pagination.totalPages}</span><div className="flex gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</Button><Button variant="outline" disabled={page >= resource.data.pagination.totalPages} onClick={() => setPage(page + 1)}>Sau</Button></div></div>}
    </>}
    {selectedId !== null && accessToken && <RefundReviewDialog requestId={selectedId} token={accessToken} onClose={() => setSelectedId(null)} onChanged={() => { setSelectedId(null); setVersion((value) => value + 1); }} />}
  </>;
}

function RefundReviewDialog({ requestId, token, onClose, onChanged }: { requestId: number; token: string; onClose(): void; onChanged(): void }) {
  const [detail, setDetail] = useState<RefundRequestDetailResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [decisionMode, setDecisionMode] = useState<"idle" | "confirm" | "reject">("idle");
  const [rejectReason, setRejectReason] = useState("");
  useEffect(() => {
    let active = true;
    setDecisionMode("idle");
    setRejectReason("");
    refundsApi.getAdminRefundRequest(requestId, token).then((value) => { if (active) setDetail(value); }).catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "Không tải được yêu cầu."); });
    return () => { active = false; };
  }, [requestId, token]);

  async function approve() {
    setBusy(true); setError("");
    try { await refundsApi.approveAdminRefundRequest(requestId, token); onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : "Không thể phê duyệt."); }
    finally { setBusy(false); setDecisionMode("idle"); }
  }
  async function reject() {
    if (!rejectReason.trim()) { setError("Vui lòng nhập lý do từ chối."); return; }
    setBusy(true); setError("");
    try { await refundsApi.rejectAdminRefundRequest(requestId, rejectReason.trim(), token); onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : "Không thể từ chối."); }
    finally { setBusy(false); setDecisionMode("idle"); }
  }
  const preview = detail?.preview;
  const rows: [string, string, string][] = preview ? [
    ["Số tiền hoàn", "0 ₫", money(preview.refundAmountVnd)],
    ["Ví điểm", preview.walletBefore.exactBalance ?? "—", preview.walletAfter.exactBalance ?? "—"],
    ["Điểm tích lũy trọn đời", preview.walletBefore.netLifetimeEarned ?? "—", preview.walletAfter.netLifetimeEarned ?? "—"],
    ["Hạng thành viên", preview.tierBefore, preview.tierAfter],
    ["Voucher", preview.discountVoucherRestorable ? "Có thể khôi phục" : "Không khôi phục", preview.discountVoucherRestorable ? "Khôi phục" : "Không đổi"],
  ] : [];
  return (
    <Dialog.Root open onOpenChange={(open) => !busy && !open && onClose()}>
      <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" /><Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-white p-5 shadow-xl outline-none sm:p-7">
        <div className="flex justify-between"><Dialog.Title className="text-xl font-extrabold">Yêu cầu hoàn tiền #{requestId}</Dialog.Title><button aria-label="Đóng" onClick={onClose}><X size={20} /></button></div>
        {!detail && !error && <div className="mt-5"><LoadingState cards={1} /></div>}{error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        {detail && <div className="mt-5 space-y-5">
          <div className="grid gap-3 rounded-2xl bg-[#f5f7f3] p-4 text-sm sm:grid-cols-2"><p><b>Cửa hàng:</b> {detail.merchant?.name ?? `#${detail.refundRequest.merchantId}`}</p><p><b>Thành viên:</b> {detail.member?.email ?? `#${detail.refundRequest.memberId}`}</p><p><b>Đơn hàng:</b> #{detail.order.id} · {money(detail.order.total)}</p><p><b>Lý do:</b> {detail.refundRequest.reason}</p><p className="sm:col-span-2"><b>Ghi chú duyệt của cửa hàng:</b> {detail.refundRequest.merchantDecisionReason || "—"}</p></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[540px] border-collapse text-left text-sm"><caption className="mb-2 text-left font-bold">Trước / sau hoàn tiền</caption><thead><tr className="border-b"><th className="p-2">Chỉ số</th><th className="p-2">Trước</th><th className="p-2">Sau</th></tr></thead><tbody>{rows.map(([label, before, after]) => <tr key={label} className="border-b"><th className="p-2 font-medium">{label}</th><td className="p-2">{before}</td><td className="p-2">{after}</td></tr>)}{preview?.challenges?.map((challenge) => <tr key={challenge.challengeId} className="border-b"><th className="p-2 font-medium">{challenge.title} · tiến độ / thưởng / ngân sách</th><td className="p-2">{challenge.currentValueBefore} · {challenge.rewardStateBefore} · {challenge.grantStatusBefore ?? "—"} · {formatPts(challenge.budgetSpentBefore)}</td><td className="p-2">{challenge.currentValueAfter} · {challenge.rewardStateAfter} · {challenge.grantStatusAfter ?? "—"} · {formatPts(challenge.budgetSpentAfter)}</td></tr>)}</tbody></table></div>
          {detail.refundRequest.status === "PENDING_ADMIN" && decisionMode === "idle" && <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => { setError(""); setDecisionMode("reject"); }}>Từ chối</Button><Button disabled={busy} onClick={() => { setError(""); setDecisionMode("confirm"); }}>Phê duyệt &amp; Thực thi hoàn tiền</Button></div>}
          {detail.refundRequest.status === "PENDING_ADMIN" && decisionMode === "confirm" && (
            <div className="rounded-2xl border border-[#dce6da] bg-[#f7faf5] p-4">
              <p className="font-bold text-[#20392a]">Thực thi hoàn tiền?</p>
              <p className="mt-1 text-sm text-[#5d6f62]">Hệ thống sẽ thực hiện hoàn tiền theo dữ liệu mới nhất tại thời điểm xử lý.</p>
              <div className="mt-4 flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setDecisionMode("idle")}>Hủy</Button><Button disabled={busy} onClick={() => void approve()}>Xác nhận</Button></div>
            </div>
          )}
          {detail.refundRequest.status === "PENDING_ADMIN" && decisionMode === "reject" && (
            <div className="rounded-2xl border border-[#f2c9c2] bg-[#fdf6f5] p-4 space-y-3">
              <Field label="Lý do thực hiện">
                <Input aria-label="Lý do thực hiện" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Nhập lý do từ chối yêu cầu..." />
              </Field>
              <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setDecisionMode("idle")}>Hủy</Button><Button variant="danger" disabled={busy || !rejectReason.trim()} onClick={() => void reject()}>Từ chối</Button></div>
            </div>
          )}
        </div>}
      </Dialog.Content></Dialog.Portal>
    </Dialog.Root>
  );
}
