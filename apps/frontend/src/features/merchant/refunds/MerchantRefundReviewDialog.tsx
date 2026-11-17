import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { createRefundsClient, translateRefundRequestError } from "../../../api/refunds-client";
import type { ExtendedRefundPreviewDto, RefundRequestDetailResponse, RefundRequestStatus } from "../../../api/refunds-types";
import { Button, Field, Input } from "../../../components/ui";
import { isRefundAwaitingMerchant, refundRequestStatusLabel } from "../../refunds/refund-status";

const api = createRefundsClient();
const money = (value: string) => `${Number(value).toLocaleString("vi-VN")} ₫`;
const formatPts = (value: string) => Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 4 });

type Props = {
  requestId: number;
  token: string;
  onClose(): void;
  onUpdated(status: RefundRequestStatus): void;
};

function RefundPreview({ preview }: { preview: ExtendedRefundPreviewDto }) {
  const { walletBefore, walletAfter } = preview;
  const rows = [
    ["Số tiền hoàn", "0 ₫", money(preview.refundAmountVnd)],
    ["Điểm khả dụng", walletBefore.availablePoints, `${walletAfter.availablePoints} (nợ ${walletAfter.pointDebt}, dư ${walletAfter.fractionalCarry})`],
    ["Điểm tích lũy trọn đời", walletBefore.netLifetimeEarned, walletAfter.netLifetimeEarned],
    ["Hạng", preview.tierBefore, preview.tierAfter],
    ["Voucher", "—", preview.discountVoucherRestorable ? "Khôi phục" : "Không đổi"],
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead><tr><th className="p-2">Chỉ số</th><th>Hiện tại</th><th>Dự kiến sau hoàn tiền</th></tr></thead>
        <tbody>
          {rows.map(([label, before, after]) => (
            <tr key={label} className="border-t"><th scope="row" className="p-2 font-medium">{label}</th><td>{before}</td><td>{after}</td></tr>
          ))}
          {preview.challenges?.map((challenge) => (
            <tr key={challenge.challengeId} className="border-t">
              <th scope="row" className="p-2 font-medium">Nhiệm vụ: {challenge.title} (tiến độ / thưởng / ngân sách)</th>
              <td>{challenge.currentValueBefore} · {challenge.rewardStateBefore} · {formatPts(challenge.budgetSpentBefore)}</td>
              <td>{challenge.currentValueAfter} · {challenge.rewardStateAfter} · {formatPts(challenge.budgetSpentAfter)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MerchantRefundReviewDialog({ requestId, token, onClose, onUpdated }: Props) {
  const [data, setData] = useState<RefundRequestDetailResponse | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let active = true;
    api.getMerchantRefundRequest(requestId, token).then((result) => {
      if (active) setData(result);
    }).catch((cause: unknown) => {
      if (active) setError(translateRefundRequestError(cause instanceof Error ? cause.message : "INVALID_INPUT"));
    });
    return () => { active = false; };
  }, [requestId, token]);

  async function decide(action: "approve" | "reject") {
    if (busy || (action === "reject" && !note.trim())) return;
    setBusy(true);
    setError("");
    try {
      const { refundRequest } = action === "approve"
        ? await api.approveMerchantRefundRequest(requestId, token, note.trim() || undefined)
        : await api.rejectMerchantRefundRequest(requestId, note.trim(), token);
      onUpdated(refundRequest.status);
    } catch (cause) {
      setError(translateRefundRequestError(cause instanceof Error ? cause.message : "INVALID_INPUT"));
    } finally {
      setBusy(false);
    }
  }

  const pending = data && isRefundAwaitingMerchant(data.refundRequest.status);
  const providerRequired = data?.preview.providerConfirmationRequired;
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content aria-describedby={undefined} className="surface fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl p-6">
          <Dialog.Title className="text-xl font-bold">Yêu cầu hoàn tiền #{requestId}</Dialog.Title>
          {!data && !error && <p className="mt-4">Đang tải…</p>}
          {data && (
            <div className="mt-4 space-y-4 text-sm">
              <p>Đơn #{data.order.id} · {data.order.items.map((item) => `${item.productName} × ${item.quantity}`).join(", ")} · {money(data.order.total)}</p>
              <p>{data.refundRequest.reason}</p>
              {pending ? (
                <>
                  <RefundPreview preview={data.preview} />
                  {providerRequired && <p>Đơn này được thanh toán qua VNPay. Cửa hàng chưa thể hoàn tiền qua cổng này.</p>}
                  <Field label="Ghi chú / lý do"><Input maxLength={255} disabled={busy || confirming} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nhập ghi chú; bắt buộc khi từ chối" /></Field>
                </>
              ) : (
                <div>
                  <p className="font-semibold">{refundRequestStatusLabel(data.refundRequest.status)}</p>
                  <p>{data.refundRequest.adminDecisionReason ?? data.refundRequest.merchantDecisionReason}</p>
                </div>
              )}
            </div>
          )}
          {error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
          {confirming && data && <p className="mt-4 text-sm">Xác nhận hoàn {money(data.preview.refundAmountVnd)} cho đơn #{data.order.id}?</p>}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {confirming ? (
              <>
                <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>Quay lại</Button>
                <Button disabled={busy} onClick={() => void decide("approve")}>Xác nhận hoàn tiền</Button>
              </>
            ) : (
              <>
                <Button variant="outline" disabled={busy} onClick={onClose}>Đóng</Button>
                {pending && (
                  <>
                    <Button variant="danger" disabled={busy || !note.trim()} onClick={() => void decide("reject")}>Từ chối</Button>
                    <Button disabled={busy || providerRequired} onClick={() => setConfirming(true)}>Duyệt hoàn tiền</Button>
                  </>
                )}
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
