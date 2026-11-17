import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import type { OrderDto } from "../../../api/commerce-types";
import { useResource } from "../../../api/useResource";
import {
  StatusText,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../../../components/ui";
import { PlatformFeeLedger } from "../../finance/PlatformFeeLedger";
import { MerchantAbuseReportDialog } from "../MerchantAbuseReportDialog";
import { MerchantRewardQueue } from "../MerchantRewardQueue";
import { OrderLoyaltyPolicySnapshot } from "../../orders/OrderLoyaltyPolicySnapshot";
import { api, formatPrice, orderStatusLabel, orderStatusTone, useToken } from "../merchant-page-support";

export function MerchantOrders() {
  const token = useToken();
  const [params, setParams] = useSearchParams();
  const showFees = params.get("tab") === "fees";
  const orderId = Number(params.get("orderId"));
  const selectedOrderId = Number.isSafeInteger(orderId) && orderId > 0 ? orderId : null;
  const voucherId = Number(params.get("voucherId"));
  const selectedVoucherId = Number.isSafeInteger(voucherId) && voucherId > 0 ? voucherId : null;
  return (
    <>
      <PageHeader title="Đơn hàng" />
      <div className="mb-5 flex flex-wrap gap-2" aria-label="Chế độ xem đơn hàng">
        <Button
          type="button"
          size="sm"
          variant={showFees ? "outline" : "default"}
          aria-pressed={!showFees}
          onClick={() => setParams({})}
        >
          Đơn mua và quà đổi thưởng
        </Button>
        <Button
          type="button"
          size="sm"
          variant={showFees ? "default" : "outline"}
          aria-pressed={showFees}
          onClick={() => setParams({ tab: "fees" })}
        >
          Sổ phí bán hàng
        </Button>
      </div>
      {showFees ? (
        <PlatformFeeLedger token={token} />
      ) : (
        <div className="space-y-8">
          {selectedOrderId === null && (
            <section aria-labelledby="merchant-order-rewards">
              <h2 id="merchant-order-rewards" className="mb-3 text-lg font-extrabold">
                Quà đổi thưởng
              </h2>
              {selectedVoucherId !== null && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mb-3"
                  onClick={() => setParams({})}
                >
                  Tất cả quà đổi thưởng
                </Button>
              )}
              <MerchantRewardQueue
                key={selectedVoucherId ?? "all"}
                voucherId={selectedVoucherId ?? undefined}
              />
            </section>
          )}
          {selectedVoucherId === null && (
            <section aria-labelledby="merchant-purchase-orders">
              <h2 id="merchant-purchase-orders" className="mb-3 text-lg font-extrabold">
                Đơn mua hàng
              </h2>
              {selectedOrderId !== null && (
                <div className="mb-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setParams({ tab: "fees" })}
                  >
                    Về sổ phí
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setParams({})}>
                    Tất cả đơn hàng
                  </Button>
                </div>
              )}
              <MerchantPurchaseOrders key={selectedOrderId ?? "all"} orderId={selectedOrderId} />
            </section>
          )}
        </div>
      )}
    </>
  );
}

function MerchantPurchaseOrders({ orderId }: { orderId: number | null }) {
  const token = useToken();
  const resource = useResource<(OrderDto & { memberEmail?: string })[]>(
    () =>
      orderId === null
        ? api.listMerchantOrders(token).then(({ orders }) => orders)
        : api.getMerchantOrder(orderId, token).then(({ order }) => [order]),
    [token, orderId],
  );
  const [selectedOrderForReport, setSelectedOrderForReport] = useState<
    (OrderDto & { memberEmail?: string }) | null
  >(null);
  const [policyOrderId, setPolicyOrderId] = useState<number | null>(null);
  const policyOrder = useResource(
    () =>
      policyOrderId === null
        ? Promise.resolve(null)
        : api.getMerchantOrder(policyOrderId, token).then(({ order }) => order),
    [policyOrderId, token],
  );
  const [notice, setNotice] = useState("");

  return (
    <>
      {notice && (
        <p role="status" className="mb-4 text-sm text-[#357044]">
          {notice}
        </p>
      )}
      {resource.loading ? (
        <LoadingState cards={2} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !resource.data?.length ? (
        <EmptyState
          title="Chưa có đơn hàng"
          description="Đơn của Member sẽ xuất hiện sau khi được tạo tại cửa hàng này."
        />
      ) : (
        <div className="space-y-3">
          {resource.data.map((order) => {
            const canRefund = order.actions?.canRefund === true;
            return (
              <Card key={order.id} className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-extrabold">Đơn #{order.id}</h3>
                    <StatusText tone={orderStatusTone(order.status)}>
                      {orderStatusLabel(order.status)}
                    </StatusText>
                    {order.refundStatus === "PENDING_PROVIDER" && (
                      <StatusText tone="amber">Chờ cổng xác nhận hoàn tiền</StatusText>
                    )}
                    {order.refundStatus === "COMPLETED" && order.status !== "REFUNDED" && (
                      <StatusText tone="purple">Đã hoàn tiền</StatusText>
                    )}
                    {order.refundRequest && (
                      <StatusText tone={order.refundRequest.status === "REJECTED" ? "red" : "amber"}>
                        Yêu cầu hoàn tiền: {order.refundRequest.status}
                      </StatusText>
                    )}
                  </div>
                  <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm text-[#53685a]">
                    <span className="font-semibold text-[#294833]">Thành viên #{order.memberId}</span>
                    {order.memberEmail && <span className="min-w-0 wrap-anywhere">{order.memberEmail}</span>}
                  </p>
                  <p className="mt-2 text-xs muted">
                    {order.items.map((item) => `${item.productName} × ${item.quantity}`).join(", ")}
                  </p>
                  {order.paidAt && (
                    <p className="mt-1 text-xs muted">
                      Thanh toán {new Date(order.paidAt).toLocaleString("vi-VN")}
                    </p>
                  )}
                </div>
                <div className="text-left sm:text-right">
                  {Number(order.discountAmount) > 0 ? (
                    <dl className="space-y-1 tabular-nums sm:min-w-52">
                      <div className="flex flex-wrap justify-between gap-x-4 text-xs muted">
                        <dt>Tạm tính</dt>
                        <dd>{formatPrice(order.subtotal)}</dd>
                      </div>
                      <div className="flex flex-wrap justify-between gap-x-4 text-xs muted">
                        <dt>Voucher giảm giá</dt>
                        <dd>−{formatPrice(order.discountAmount)}</dd>
                      </div>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                        <dt className="text-xs muted">Tổng cộng</dt>
                        <dd className="text-lg font-extrabold">{formatPrice(order.total)}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="text-lg font-extrabold">{formatPrice(order.total)}</p>
                  )}
                  {order.status === "PAID" &&
                    (order.earnedPointsExact != null || order.earnedPoints != null) && (
                      <p className="mt-1 text-xs font-semibold text-[#357044]">
                        +{order.earnedPointsExact ?? order.earnedPoints?.toLocaleString("vi-VN")} điểm
                      </p>
                    )}
                  <div className="mt-3 flex flex-wrap items-center justify-start gap-2 sm:justify-end">
                    {order.paidAt && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPolicyOrderId(policyOrderId === order.id ? null : order.id)}
                      >
                        {policyOrderId === order.id ? "Ẩn chính sách" : "Chính sách đã áp dụng"}
                      </Button>
                    )}
                    {canRefund && !order.refundRequest && (
                      <Link className="inline-flex h-9 items-center rounded-xl border px-3 text-sm" to="/merchant/refund-requests">
                        Xử lý yêu cầu hoàn tiền
                      </Link>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedOrderForReport(order)}
                    >
                      Báo cáo vi phạm
                    </Button>
                  </div>
                </div>
                {policyOrderId === order.id && (
                  <div className="sm:col-span-2">
                    {policyOrder.loading ? (
                      <p className="text-sm muted">Đang tải chính sách…</p>
                    ) : policyOrder.error ? (
                      <p role="alert" className="text-sm text-[#a4473a]">
                        {policyOrder.error}
                      </p>
                    ) : (
                      <OrderLoyaltyPolicySnapshot policy={policyOrder.data?.appliedLoyaltyPolicy ?? null} />
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <MerchantAbuseReportDialog
        order={selectedOrderForReport}
        onClose={() => setSelectedOrderForReport(null)}
        onReportSubmitted={(_report, msg) => {
          setNotice(msg);
        }}
      />
    </>
  );
}
