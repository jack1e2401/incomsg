import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useAuthSession } from "../../api/auth-session";
import { createCommerceClient } from "../../api/commerce-http";
import type { OrderDto, RefundPreviewDto } from "../../api/commerce-types";
import { BusyLabel, Button, Field, Input } from "../../components/ui";
import { money } from "../../lib/utils";

const api = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

function useToken() {
  const { accessToken } = useAuthSession();
  if (!accessToken) throw new Error("Phiên đăng nhập đã hết hạn");
  return accessToken;
}

function formatPrice(value: string) {
  return money(Number(value));
}

export interface MerchantRefundDialogProps {
  order: OrderDto | null;
  onClose: () => void;
  onRefundCompleted: (updatedOrder: OrderDto, notice: string) => void;
}

export function MerchantRefundDialog({ order, onClose, onRefundCompleted }: MerchantRefundDialogProps) {
  const token = useToken();
  const [refundPreview, setRefundPreview] = useState<RefundPreviewDto | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundError, setRefundError] = useState("");

  useEffect(() => {
    if (!order) {
      setRefundPreview(null);
      setRefundReason("");
      setRefundError("");
      setPreviewError("");
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);
    setPreviewError("");
    setRefundError("");
    setRefundReason("");
    setRefundPreview(null);
    api
      .getRefundPreview(order.id, token)
      .then((preview) => {
        if (!cancelled) setRefundPreview(preview);
      })
      .catch((err) => {
        if (!cancelled) {
          setPreviewError(err instanceof Error ? err.message : "Không thể tải xem trước hoàn tiền");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });
    return () => {
      cancelled = true;
    };
  }, [order?.id, token]);

  async function submitRefund() {
    if (!order || !refundReason.trim() || refundBusy) return;
    setRefundBusy(true);
    setRefundError("");
    try {
      const result = await api.refundOrder(order.id, { reason: refundReason.trim() }, token);
      const notice =
        result.refund.status === "COMPLETED"
          ? `Đã hoàn tiền đơn #${result.order.id}.`
          : result.refund.status === "PENDING_PROVIDER"
            ? "Yêu cầu hoàn tiền đang chờ cổng thanh toán xác nhận."
            : `Yêu cầu hoàn tiền chưa hoàn tất. Trạng thái: ${result.refund.status}.`;
      onRefundCompleted(result.order, notice);
      onClose();
    } catch (err) {
      setRefundError(err instanceof Error ? err.message : "Không thể hoàn tiền đơn hàng");
    } finally {
      setRefundBusy(false);
    }
  }

  if (!order) return null;

  return (
    <Dialog.Root open onOpenChange={(open) => !refundBusy && !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[#14251b]/45 backdrop-blur-[2px]" />
        <Dialog.Content className="surface fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl p-6 shadow-2xl outline-none sm:p-7">
          <Dialog.Title className="text-xl font-extrabold text-[#20392a]">
            Xem trước hoàn tiền đơn #{order.id}
          </Dialog.Title>
          {loadingPreview ? (
            <p className="mt-4 text-sm muted">Đang tải thông tin hoàn tiền…</p>
          ) : previewError ? (
            <div className="mt-4 rounded-xl bg-[#fae7e3] p-4 text-sm text-[#a4473a]">{previewError}</div>
          ) : refundPreview ? (
            <div className="mt-4 space-y-4 text-sm">
              <div className="rounded-xl bg-[#f7f9f5] p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="muted">Số tiền hoàn</span>
                  <span className="font-extrabold text-lg">{formatPrice(refundPreview.refundAmountVnd)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="muted">Thu hồi tích điểm</span>
                  <span className="font-extrabold text-[#a4473a]">
                    −<span>{refundPreview.earningReversalExact}</span> điểm
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="muted">Khôi phục voucher giảm giá</span>
                  <span>{refundPreview.discountVoucherRestorable ? "Có" : "Không"}</span>
                </div>
              </div>
              <div className="rounded-xl border border-[#e5ece3] p-4">
                <h3 className="text-xs font-extrabold text-[#294a32]">Ví điểm sau hoàn tiền</h3>
                <dl className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="muted">Điểm khả dụng sau hoàn</dt>
                    <dd className="font-bold tabular-nums">
                      {refundPreview.walletAfter.availablePoints ?? "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="muted">Phần dư sau hoàn</dt>
                    <dd className="font-bold tabular-nums">
                      {refundPreview.walletAfter.fractionalCarry ?? "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="muted">Điểm nợ sau hoàn</dt>
                    <dd className="font-bold tabular-nums">{refundPreview.walletAfter.pointDebt ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="muted">Hạng sau hoàn</dt>
                    <dd className="font-bold">
                      {refundPreview.tierBefore} → {refundPreview.tierAfter}
                    </dd>
                  </div>
                </dl>
              </div>
              {refundPreview.providerConfirmationRequired && (
                <p className="rounded-xl bg-[#fff1d6] p-3 text-xs leading-5 text-[#97682a]">
                  Yêu cầu hoàn tiền cần cổng thanh toán xác nhận. Trạng thái ban đầu sẽ là PENDING_PROVIDER và
                  điểm chỉ được thu hồi sau khi hoàn tất xác nhận.
                </p>
              )}
              <Field label="Lý do hoàn tiền">
                <Input
                  required
                  aria-label="Lý do hoàn tiền"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Nhập lý do hoàn tiền..."
                />
              </Field>
              {refundError && (
                <p role="alert" className="rounded-xl bg-[#fae7e3] p-3 text-xs text-[#a4473a]">
                  {refundError}
                </p>
              )}
              <div className="mt-6 flex justify-end gap-2">
                <Button type="button" variant="outline" disabled={refundBusy} onClick={onClose}>
                  Hủy
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={refundBusy || !refundReason.trim()}
                  onClick={() => void submitRefund()}
                >
                  {refundBusy ? <BusyLabel>Đang xử lý</BusyLabel> : "Xác nhận hoàn tiền"}
                </Button>
              </div>
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
