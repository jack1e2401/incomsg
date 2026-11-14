import { useEffect, useState } from "react";
import { Link, useParams, useOutletContext } from "react-router-dom";
import { ArrowLeft, Sparkle } from "@phosphor-icons/react";
import * as Dialog from "@radix-ui/react-dialog";
import { useAuthSession } from "../../api/auth-session";
import { createCommerceClient } from "../../api/commerce-http";
import type { OrderStatus, PointTransactionType } from "../../api/commerce-types";
import { useResource } from "../../api/useResource";
import {
  Button,
  BusyLabel,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusText,
} from "../../components/ui";
import { ConfirmActionDialog } from "../../components/ui/ConfirmActionDialog";
import { memberTierLabel } from "./MemberLoyaltyPolicyDialog";
import { OrderLoyaltyPolicySnapshot } from "../orders/OrderLoyaltyPolicySnapshot";

const commerce = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");
const money = (value: string | bigint) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(
    typeof value === "bigint" ? value : Number(value),
  );

interface MemberContext {
  merchantId: number;
}

function useMerchantContext() {
  return useOutletContext<MemberContext>();
}

function orderStatusTone(status: OrderStatus): "green" | "amber" | "neutral" | "red" | "purple" {
  switch (status) {
    case "PAID":
      return "green";
    case "PENDING":
    case "REFUND_PENDING":
      return "amber";
    case "REFUNDED":
      return "purple";
    case "FAILED":
      return "red";
    case "CANCELLED":
    default:
      return "neutral";
  }
}

function orderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case "PAID":
      return "Đã thanh toán";
    case "PENDING":
      return "Chờ thanh toán";
    case "REFUND_PENDING":
      return "Đang hoàn tiền";
    case "REFUNDED":
      return "Đã hoàn tiền";
    case "FAILED":
      return "Thất bại";
    case "CANCELLED":
      return "Đã hủy";
    default:
      return status;
  }
}

function transactionTypeLabel(type: PointTransactionType) {
  switch (type) {
    case "EARN":
      return "Tích điểm";
    case "REDEEM_DISCOUNT":
      return "Đổi ưu đãi";
    case "REDEEM_REWARD":
      return "Đổi quà";
    case "EARN_REVERSAL":
      return "Thu hồi tích điểm";
    case "REDEMPTION_REVERSAL":
      return "Hoàn điểm đổi thưởng";
    case "ADMIN_ADJUSTMENT":
      return "Điều chỉnh quản trị";
    case "LEGACY_BACKFILL":
      return "Khởi tạo ban đầu";
    default:
      return type;
  }
}

function Unavailable({
  title,
  description,
  merchantId,
}: {
  title: string;
  description: string;
  merchantId: number;
}) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState
        title="Chưa khả dụng"
        description={description}
        action={
          <Button asChild variant="outline">
            <Link to={`/member/${merchantId}/orders`}>Xem danh sách đơn hàng</Link>
          </Button>
        }
      />
    </>
  );
}

export function MemberOrderResult() {
  const { merchantId } = useMerchantContext();
  const { accessToken } = useAuthSession();
  const orderId = Number(useParams().orderId);
  const orderResource = useResource(
    () => commerce.getMemberOrder(orderId, accessToken!).then(({ order }) => order),
    [orderId, merchantId, accessToken],
  );
  const order = orderResource.data?.merchantId === merchantId ? orderResource.data : null;
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [reservationExpiredDialogOpen, setReservationExpiredDialogOpen] = useState(false);

  useEffect(() => {
    if (order?.status !== "PENDING" || !order.stockReservedUntil) return;

    const expiresAt = new Date(order.stockReservedUntil).getTime();
    if (!Number.isFinite(expiresAt)) return;

    const now = Date.now();
    setCurrentTime(now);
    if (expiresAt <= now) {
      setReservationExpiredDialogOpen(true);
      return;
    }

    const intervalId = window.setInterval(() => {
      const tick = Date.now();
      setCurrentTime(tick);
      if (tick >= expiresAt) {
        setReservationExpiredDialogOpen(true);
        window.clearInterval(intervalId);
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [order?.status, order?.stockReservedUntil]);
  async function pay() {
    if (!order || !accessToken || busy || order.status !== "PENDING") return;
    setBusy(true);
    setActionError("");
    try {
      const response = await commerce.payMockOrder(order.id, accessToken);
      orderResource.setData(response.order);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Không thể bắt đầu thanh toán");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelOrder() {
    if (!order || !accessToken || cancelling) return;
    setCancelling(true);
    setCancelError("");
    try {
      const result = await commerce.cancelOrder(order.id, accessToken);
      orderResource.setData(result.order);
      setCancelDialogOpen(false);
    } catch (reason) {
      setCancelError(reason instanceof Error ? reason.message : "Không thể hủy đơn hàng");
    } finally {
      setCancelling(false);
    }
  }

  const canCancel = order?.actions?.canCancel === true;
  const reservedUntil = order?.stockReservedUntil ? new Date(order.stockReservedUntil).getTime() : null;
  const remainingSeconds = reservedUntil === null
    ? null
    : Math.max(0, Math.ceil((reservedUntil - currentTime) / 1000));
  const remainingLabel = remainingSeconds === null
    ? null
    : `${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(remainingSeconds % 60).padStart(2, "0")}`;

  if (orderResource.loading) return <LoadingState cards={1} />;
  if (orderResource.error) return <ErrorState message={orderResource.error} retry={orderResource.reload} />;
  if (!order)
    return (
      <Unavailable
        title="Không tải được đơn hàng"
        description="Đơn không tồn tại hoặc không thuộc cửa hàng hiện tại."
        merchantId={merchantId}
      />
    );

  return (
    <>
      <Link
        to={`/member/${merchantId}/orders`}
        className="mb-5 inline-flex items-center gap-2 rounded text-sm font-bold text-[#335e3d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335e3d]"
      >
        <ArrowLeft aria-hidden="true" size={16} /> Danh sách đơn hàng
      </Link>
      <PageHeader title={`Đơn #${order.id}`} />
      <Card className="p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusText tone={orderStatusTone(order.status)}>{orderStatusLabel(order.status)}</StatusText>
          {order.refundStatus === "PENDING_PROVIDER" && (
            <StatusText tone="amber">Chờ cổng thanh toán xác nhận hoàn tiền</StatusText>
          )}
        </div>
        <div className="mt-5 space-y-3">
          {order.items.map((item) => (
            <div key={item.productId} className="flex justify-between gap-3 text-sm">
              <span className="min-w-0 break-words">
                {item.productName} × {item.quantity}
              </span>
              <span className="shrink-0 font-bold tabular-nums break-words">{money(item.lineTotal)}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 space-y-2 border-t border-[#e5ece3] pt-5 text-sm">
          <div className="flex justify-between gap-3">
            <span className="muted">Tạm tính</span>
            <span className="shrink-0 tabular-nums break-words">{money(order.subtotal)}</span>
          </div>
          {order.discountAmount !== "0" && (
            <div className="flex justify-between gap-3 text-[#357044]">
              <span className="muted">Voucher giảm giá</span>
              <span className="shrink-0 tabular-nums break-words">−{money(order.discountAmount)}</span>
            </div>
          )}
        </div>
        <div className="mt-3 flex justify-between border-t border-[#e5ece3] pt-4 font-extrabold">
          <span>Tổng cộng</span>
          <span className="shrink-0 tabular-nums break-words">{money(order.total)}</span>
        </div>
        {actionError && (
          <div role="alert" className="mt-4 rounded-xl bg-[#fee2e2] p-3 text-sm text-[#a4473a]">
            <p className="break-words">{actionError}</p>
          </div>
        )}
        {order.status === "PENDING" ? (
          <div className="mt-5 rounded-xl bg-[#fff1d6] p-4">
            <p className="text-xs leading-5 text-[#97682a] break-words">
              Đơn đang chờ thanh toán. Điểm được cập nhật sau khi máy chủ xác nhận thanh toán.
            </p>
            {remainingLabel && (
              <p className="mt-1 text-xs text-[#97682a]" role="timer" aria-label={`Thời gian giữ sản phẩm còn ${remainingLabel}`}>
                {remainingSeconds === 0 ? (
                  "Thời gian giữ sản phẩm đã hết."
                ) : (
                  <>Thời gian giữ sản phẩm còn <span className="font-bold tabular-nums">{remainingLabel}</span>.</>
                )}
              </p>
            )}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button type="button" className="w-full sm:w-auto" disabled={busy || remainingSeconds === 0} onClick={pay}>
                {busy ? <BusyLabel>Đang xác nhận thanh toán</BusyLabel> : "Thanh toán (mô phỏng)"}
              </Button>
              {canCancel && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={busy || cancelling}
                  onClick={() => setCancelDialogOpen(true)}
                >
                  Hủy đơn
                </Button>
              )}
            </div>
          </div>
        ) : order.status === "CANCELLED" ? (
          <div className="mt-5 rounded-xl bg-[#f0f4ee] p-4 text-[#3c5243]">
            <div role="status">
              <p className="text-sm font-semibold">Đơn hàng đã được hủy.</p>
              <p className="mt-1 text-xs text-[#527353] break-words">
                Voucher và hạn mức điểm liên quan đã được giải phóng an toàn.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="mt-4 w-full sm:w-auto">
              <Link to={`/member/${merchantId}`}>Tiếp tục mua hàng</Link>
            </Button>
          </div>
        ) : order.status === "REFUNDED" ? (
          <div className="mt-5 rounded-2xl bg-[#edf1ea] p-4 text-[#294a32] sm:p-5">
            <div role="status">
              <p className="text-sm font-bold">Đơn hàng đã hoàn tiền.</p>
              <p className="mt-1 text-xs muted break-words">Giao dịch hoàn tiền đã được xử lý thành công.</p>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                <Link to={`/member/${merchantId}/wallet`}>Xem ví điểm</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                <Link to={`/member/${merchantId}`}>Tiếp tục mua sắm</Link>
              </Button>
            </div>
          </div>
        ) : order.status === "REFUND_PENDING" ? (
          <div className="mt-5 rounded-xl bg-[#fff1d6] p-4">
            <div role="status">
              <p className="text-sm font-semibold text-[#97682a]">Đang xử lý hoàn tiền</p>
              <p className="mt-1 text-xs leading-5 text-[#97682a] break-words">
                Yêu cầu hoàn tiền đang được xử lý
                {order.refundStatus === "PENDING_PROVIDER" ? " bởi đối tác thanh toán" : ""}.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="mt-4 w-full sm:w-auto">
              <Link to={`/member/${merchantId}/wallet`}>Xem ví điểm</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl bg-[#e8f1e2] p-4 text-[#294a32] sm:p-5">
            <div role="status">
              <p className="text-sm">Thanh toán đã được máy chủ xác nhận.</p>
              {order.earnedPointsExact !== "0" && order.earnedPointsExact ? (
                <p className="mt-2 text-xl font-extrabold break-words">
                  Bạn vừa nhận +{order.earnedPointsExact} điểm
                </p>
              ) : (
                <p className="mt-2 text-sm">Đơn này không phát sinh điểm.</p>
              )}
              {order.promotedToTier && (
                <p className="mt-3 flex items-center gap-2 font-bold break-words">
                  <Sparkle aria-hidden="true" size={18} weight="fill" className="shrink-0" />
                  Chúc mừng! Bạn đã lên hạng {memberTierLabel[order.promotedToTier]}.
                </p>
              )}
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                <Link to={`/member/${merchantId}/wallet`}>Xem ví điểm</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                <Link to={`/member/${merchantId}`}>Tiếp tục mua sắm</Link>
              </Button>
            </div>
          </div>
        )}
        {order.loyaltyEvents && order.loyaltyEvents.length > 0 && (
          <div className="mt-6 border-t border-[#e5ece3] pt-5">
            <h3 className="text-sm font-extrabold text-[#294a32]">Lịch sử điểm của đơn hàng</h3>
            <div className="mt-3 divide-y divide-[#edf1ea] rounded-xl border border-[#e5ece3] bg-[#fcfdfa]">
              {order.loyaltyEvents.map((event) => {
                const isNeg = event.delta.startsWith("-");
                return (
                  <div
                    key={event.id}
                    className="flex flex-col gap-1.5 p-3 text-xs sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[#294a32] break-words">{event.reason}</p>
                      <p className="mt-0.5 text-[#637269] break-words">
                        {transactionTypeLabel(event.type)} ·{" "}
                        {new Date(event.createdAt).toLocaleString("vi-VN")}
                      </p>
                    </div>
                    <div className="flex items-center justify-between sm:block sm:text-right">
                      <span
                        className={`font-extrabold tabular-nums break-words ${isNeg ? "text-[#a4473a]" : "text-[#357044]"}`}
                      >
                        {isNeg ? event.delta : `+${event.delta}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {order.status !== "PENDING" && order.status !== "CANCELLED" && (
          <div className="mt-6 border-t border-[#e5ece3] pt-5">
            <OrderLoyaltyPolicySnapshot policy={order.appliedLoyaltyPolicy ?? null} />
          </div>
        )}
      </Card>
      <ConfirmActionDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="Hủy đơn hàng"
        description="Bạn có chắc chắn muốn hủy đơn hàng này? Voucher và hạn mức điểm sẽ được giải phóng."
        confirmLabel="Xác nhận hủy"
        destructive
        busy={cancelling}
        error={cancelError}
        onConfirm={handleCancelOrder}
      />
      <Dialog.Root open={reservationExpiredDialogOpen} onOpenChange={setReservationExpiredDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-[#14251b]/45 backdrop-blur-[2px]" />
          <Dialog.Content className="surface fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl p-6 shadow-2xl outline-none sm:p-7">
            <Dialog.Title className="text-xl font-extrabold text-[#20392a]">
              Thời gian giữ sản phẩm đã hết
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 muted">
              Đơn này đã hết thời gian giữ sản phẩm. Quay lại cửa hàng để chọn sản phẩm và tạo đơn mới.
            </Dialog.Description>
            <div className="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <Dialog.Close asChild>
                <Button type="button" variant="outline">Đóng</Button>
              </Dialog.Close>
              <Button asChild>
                <Link to={`/member/${merchantId}`}>Quay lại cửa hàng</Link>
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
