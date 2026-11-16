import { ArrowLeft } from "@phosphor-icons/react";
import { Link, useParams } from "react-router-dom";
import { createAnalyticsClient } from "../../api/analytics-client";
import { useAuthSession } from "../../api/auth-session";
import type { MemberVoucherStatus, OrderStatus } from "../../api/commerce-types";
import { useResource } from "../../api/useResource";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatCard,
  StatusText,
} from "../../components/ui";
import { formatPointDelta, pointTransactionLabel } from "../member/LoyaltyWalletContent";
import { MemberLoyaltyPolicyDialog } from "../member/MemberLoyaltyPolicyDialog";
import { money } from "../../lib/utils";

const analyticsApi = createAnalyticsClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

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
    default:
      return "neutral";
  }
}

function voucherStatusLabel(status: MemberVoucherStatus): string {
  switch (status) {
    case "AVAILABLE":
      return "Khả dụng";
    case "RESERVED":
      return "Đang giữ";
    case "USED":
      return "Đã dùng";
    case "PENDING_FULFILLMENT":
      return "Chờ trao quà";
    case "FULFILLED":
      return "Đã trao";
    case "CANCELLED":
      return "Đã hủy";
    default:
      return status;
  }
}

export function MerchantCustomerDetailPage() {
  const { memberId } = useParams();
  const { accessToken } = useAuthSession();
  const resource = useResource(
    () => analyticsApi.getMerchantCustomerDetail(memberId ?? "", accessToken!),
    [memberId, accessToken],
  );

  const customer = resource.data?.customer;

  return (
    <div className="space-y-6">
      <Button asChild variant="outline" size="sm">
        <Link to="/merchant/customers">
          <ArrowLeft size={16} aria-hidden="true" /> Danh sách khách hàng
        </Link>
      </Button>

      {resource.loading ? (
        <LoadingState cards={3} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : (
        customer && (
          <>
            <PageHeader
              title={customer.member.email}
              description={`Thành viên #${customer.member.id} · Tham gia ${new Date(customer.member.joinedAt).toLocaleDateString("vi-VN")}`}
              action={<MemberLoyaltyPolicyDialog policy={customer.wallet.policy} />}
            />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Tổng đơn hàng"
                value={customer.stats.totalOrders}
                note={`${customer.stats.paidOrderCount} đã trả · ${customer.stats.refundPendingOrderCount} chờ hoàn · ${customer.stats.refundedOrderCount} đã hoàn`}
              />
              <StatCard
                label="Chi tiêu ròng"
                value={money(Number(customer.stats.netSpendVnd))}
                note={
                  customer.stats.refundPendingOrderCount > 0
                    ? `Chờ hoàn: ${money(Number(customer.stats.refundPendingSpendVnd))}`
                    : "Tính trên đơn PAID + REFUND_PENDING"
                }
              />
              <StatCard
                label="Giá trị đơn trung bình"
                value={money(Number(customer.stats.averageOrderValueVnd))}
              />
              <StatCard
                label="Mua gần nhất"
                value={
                  customer.stats.lastPurchaseAt
                    ? new Date(customer.stats.lastPurchaseAt).toLocaleDateString("vi-VN")
                    : "Chưa mua"
                }
              />
            </div>

            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-extrabold text-[#20392a]">Ví điểm Loyalty</h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <dt className="text-xs font-bold muted">Hạng hiện tại</dt>
                  <dd className="mt-1 text-lg font-extrabold">
                    {customer.wallet.tier === "UNRANKED" ? "Chưa xếp hạng" : customer.wallet.tier}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold muted">Điểm khả dụng</dt>
                  <dd className="mt-1 text-lg font-extrabold tabular-nums">
                    {customer.wallet.availablePoints.toLocaleString("vi-VN")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold muted">Phần lẻ tích lũy</dt>
                  <dd className="mt-1 text-lg font-extrabold tabular-nums">{customer.wallet.fractionalCarry}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold muted">Tổng điểm tích lũy</dt>
                  <dd className="mt-1 text-lg font-extrabold tabular-nums">
                    {customer.wallet.netLifetimeEarned}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold muted">Nợ điểm</dt>
                  <dd className="mt-1 text-lg font-extrabold tabular-nums text-[#a4473a]">
                    {customer.wallet.pointDebt}
                  </dd>
                </div>
              </dl>
            </Card>

            <section aria-label="Lịch sử đơn hàng" className="space-y-3">
              <h2 className="text-lg font-extrabold text-[#20392a]">Lịch sử đơn hàng</h2>
              {customer.orders.length === 0 ? (
                <EmptyState title="Chưa có đơn hàng" description="Khách hàng chưa phát sinh đơn hàng nào." />
              ) : (
                <div className="surface overflow-x-auto rounded-3xl">
                  <table className="w-full min-w-[700px] border-collapse text-left text-sm">
                    <thead className="bg-[#f7f9f5] text-xs font-bold uppercase tracking-wide text-[#65746a]">
                      <tr>
                        <th scope="col" className="px-5 py-3.5">
                          Đơn hàng
                        </th>
                        <th scope="col" className="px-4 py-3.5">
                          Trạng thái
                        </th>
                        <th scope="col" className="px-4 py-3.5">
                          Sản phẩm
                        </th>
                        <th scope="col" className="px-4 py-3.5 text-right">
                          Tổng thanh toán
                        </th>
                        <th scope="col" className="px-4 py-3.5 text-right">
                          Điểm tích
                        </th>
                        <th scope="col" className="px-4 py-3.5">
                          Thanh toán lúc
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {customer.orders.map((order) => (
                        <tr key={order.id} className="border-t border-[#edf1ea]">
                          <th scope="row" className="px-5 py-3.5 font-bold">
                            #{order.id}
                          </th>
                          <td className="px-4 py-3.5">
                            <StatusText tone={orderStatusTone(order.status)}>
                              {orderStatusLabel(order.status)}
                            </StatusText>
                          </td>
                          <td className="px-4 py-3.5 text-xs muted">
                            {order.items.map((item) => `${item.productName} ×${item.quantity}`).join(", ")}
                          </td>
                          <td className="px-4 py-3.5 text-right font-semibold tabular-nums">
                            {money(Number(order.total))}
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums">
                            {order.earnedPointsExact ?? "—"}
                          </td>
                          <td className="px-4 py-3.5 text-xs muted">
                            {order.paidAt ? new Date(order.paidAt).toLocaleString("vi-VN") : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section aria-label="Sổ biến động điểm" className="space-y-3">
              <h2 className="text-lg font-extrabold text-[#20392a]">Sổ biến động điểm</h2>
              {customer.pointLedger.length === 0 ? (
                <EmptyState title="Chưa có giao dịch điểm" description="Chưa ghi nhận biến động điểm nào." />
              ) : (
                <div className="surface overflow-x-auto rounded-3xl">
                  <table className="w-full min-w-[700px] border-collapse text-left text-sm">
                    <thead className="bg-[#f7f9f5] text-xs font-bold uppercase tracking-wide text-[#65746a]">
                      <tr>
                        <th scope="col" className="px-5 py-3.5">
                          Thời gian
                        </th>
                        <th scope="col" className="px-4 py-3.5">
                          Loại
                        </th>
                        <th scope="col" className="px-4 py-3.5">
                          Lý do
                        </th>
                        <th scope="col" className="px-4 py-3.5 text-right">
                          Biến động
                        </th>
                        <th scope="col" className="px-4 py-3.5 text-right">
                          Số dư sau
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {customer.pointLedger.map((tx) => (
                        <tr key={tx.id} className="border-t border-[#edf1ea]">
                          <td className="px-5 py-3.5 text-xs muted">
                            {new Date(tx.createdAt).toLocaleString("vi-VN")}
                          </td>
                          <td className="px-4 py-3.5 font-medium">{pointTransactionLabel(tx.type)}</td>
                          <td className="px-4 py-3.5">{tx.reason}</td>
                          <td
                            className={`px-4 py-3.5 text-right font-bold tabular-nums ${
                              tx.delta.startsWith("-") ? "text-[#a4473a]" : "text-[#357044]"
                            }`}
                          >
                            {formatPointDelta(tx.delta)}
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums">{tx.balanceAfter}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section aria-label="Lịch sử voucher" className="space-y-3">
              <h2 className="text-lg font-extrabold text-[#20392a]">Voucher đã đổi</h2>
              {customer.vouchers.length === 0 ? (
                <EmptyState title="Chưa đổi voucher" description="Khách hàng chưa đổi voucher hoặc quà nào." />
              ) : (
                <div className="surface overflow-x-auto rounded-3xl">
                  <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                    <thead className="bg-[#f7f9f5] text-xs font-bold uppercase tracking-wide text-[#65746a]">
                      <tr>
                        <th scope="col" className="px-5 py-3.5">
                          Voucher
                        </th>
                        <th scope="col" className="px-4 py-3.5">
                          Loại
                        </th>
                        <th scope="col" className="px-4 py-3.5">
                          Trạng thái
                        </th>
                        <th scope="col" className="px-4 py-3.5 text-right">
                          Điểm đổi
                        </th>
                        <th scope="col" className="px-4 py-3.5">
                          Ngày đổi
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {customer.vouchers.map((voucher) => (
                        <tr key={voucher.id} className="border-t border-[#edf1ea]">
                          <th scope="row" className="px-5 py-3.5 font-bold">
                            {voucher.title}
                          </th>
                          <td className="px-4 py-3.5">{voucher.type === "DISCOUNT" ? "Giảm giá" : "Quà tặng"}</td>
                          <td className="px-4 py-3.5">{voucherStatusLabel(voucher.status)}</td>
                          <td className="px-4 py-3.5 text-right tabular-nums">
                            {voucher.pointsCost.toLocaleString("vi-VN")}
                          </td>
                          <td className="px-4 py-3.5 text-xs muted">
                            {new Date(voucher.redeemedAt).toLocaleString("vi-VN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )
      )}
    </div>
  );
}
