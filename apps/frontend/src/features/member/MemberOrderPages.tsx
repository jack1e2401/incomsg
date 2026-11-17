import { Link } from "react-router-dom";
import { useAuthSession } from "../../api/auth-session";
import type { OrderStatus } from "../../api/commerce-types";
import { useResource } from "../../api/useResource";
import {
  StatusText,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../../components/ui";
import { commerce, money, useMerchantContext } from "./member-context";

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

export { MemberOrderResult } from "./MemberOrderResult";

export function MemberOrders() {
  const { merchantId, basePath } = useMerchantContext();
  const { accessToken } = useAuthSession();
  const resource = useResource(
    () => commerce.listMemberOrders(merchantId, accessToken!).then(({ orders }) => orders),
    [merchantId, accessToken],
  );
  return (
    <>
      <PageHeader title="Đơn hàng" description={`Đơn của bạn tại cửa hàng #${merchantId}.`} />
      {resource.loading ? (
        <LoadingState cards={2} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !resource.data?.length ? (
        <EmptyState
          title="Chưa có đơn hàng"
          description="Đơn bạn tạo tại cửa hàng này sẽ xuất hiện ở đây."
          action={
            <Button asChild>
              <Link to={basePath}>Mua sắm ngay</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {resource.data.map((order) => (
            <Card
              key={order.id}
              className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
            >
              <div className="min-w-0 flex-1">
                <p className="font-extrabold break-words">Đơn #{order.id}</p>
                <p className="mt-1 text-xs muted break-words">
                  {order.items.map((item) => `${item.productName} × ${item.quantity}`).join(", ")}
                </p>
              </div>
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <div className="text-left sm:text-right">
                  <p className="font-bold tabular-nums break-words">{money(order.total)}</p>
                  <StatusText tone={orderStatusTone(order.status)}>
                    {orderStatusLabel(order.status)}
                  </StatusText>
                  {order.refundRequest && (
                    <StatusText tone={order.refundRequest.status === "REJECTED" ? "red" : order.refundRequest.status === "COMPLETED" ? "green" : "amber"}>
                      {order.refundRequest.status === "PENDING_MERCHANT" ? "Chờ cửa hàng duyệt" : order.refundRequest.status === "PENDING_ADMIN" ? "Chờ Admin duyệt" : order.refundRequest.status === "REJECTED" ? "Từ chối hoàn tiền" : order.refundRequest.status === "COMPLETED" ? "Đã hoàn tiền" : "Đang xử lý hoàn tiền"}
                    </StatusText>
                  )}
                  {order.refundStatus === "PENDING_PROVIDER" && (
                    <p className="text-[10px] text-[#97682a] break-words">Chờ cổng hoàn tiền</p>
                  )}
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <Link to={`${basePath}/orders/${order.id}`} aria-label={`Chi tiết đơn hàng #${order.id}`}>
                    Chi tiết
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
