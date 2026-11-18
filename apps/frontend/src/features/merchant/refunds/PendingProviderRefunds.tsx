import { Alert } from "antd";
import { Link } from "react-router-dom";
import { useResource } from "../../../api/useResource";
import { ErrorState } from "../../../components/ui";
import { api, formatPrice } from "../merchant-page-support";
import { CmsDataTable, CmsStatusTag } from "../cms";
import type { OrderDto } from "../../../api/commerce-types";

type Row = OrderDto & { memberEmail?: string };

export function PendingProviderRefunds({ token }: { token: string }) {
  const resource = useResource(() => api.listMerchantOrders(token).then(({ orders }) => orders.filter((order) => order.refundStatus === "PENDING_PROVIDER")), [token]);
  if (resource.error) return <ErrorState message={resource.error} retry={resource.reload} />;
  return (
    <div className="space-y-3">
      <Alert
        type="info"
        showIcon
        title="Giao dịch hoàn tiền qua cổng thanh toán đang chờ đối tác xác nhận tự động; cửa hàng không thể xác nhận thủ công trạng thái này."
      />
      <CmsDataTable<Row> label="Hoàn tiền chờ cổng xác nhận" rows={resource.data ?? []} loading={resource.loading} rowKey="id" emptyText="Không có giao dịch hoàn tiền chờ cổng xác nhận." columns={[
        { title: "Đơn hàng", key: "id", render: (_: unknown, row) => <Link to={`/merchant/orders?orderId=${row.id}`}>#{row.id}</Link> },
        { title: "Thành viên", key: "member", render: (_: unknown, row) => row.memberEmail ?? `#${row.memberId}` },
        { title: "Tổng tiền", dataIndex: "total", key: "total", render: (value: string) => formatPrice(value) },
        { title: "Trạng thái", key: "status", render: () => <CmsStatusTag label="Chờ cổng xác nhận" tone="warning" /> },
        { title: "Thao tác", key: "action", render: (_: unknown, row) => <Link to={`/merchant/orders?orderId=${row.id}`}>Xem đơn hàng</Link> },
      ]} />
    </div>
  );
}
