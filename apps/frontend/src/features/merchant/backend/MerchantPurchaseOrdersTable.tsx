import { Button, Flex, Space, Typography, type TableColumnsType } from "antd";
import { Link } from "react-router-dom";
import type { OrderDto } from "../../../api/commerce-types";
import { formatPrice, orderStatusLabel } from "../merchant-page-support";
import { CmsDataTable, CmsStatusTag } from "../cms";

export type MerchantOrderRow = OrderDto & { memberEmail?: string };

const tone = (status: OrderDto["status"]) => {
  switch (status) {
    case "PAID": return "success" as const;
    case "PENDING":
    case "REFUND_PENDING": return "warning" as const;
    case "FAILED": return "error" as const;
    case "REFUNDED": return "info" as const;
    default: return "neutral" as const;
  }
};

function refundLabel(order: OrderDto): string[] {
  const labels: string[] = [];
  if (order.refundStatus === "PENDING_PROVIDER") labels.push("Chờ cổng xác nhận hoàn tiền");
  if (order.refundStatus === "COMPLETED" && order.status !== "REFUNDED") labels.push("Đã hoàn tiền");
  if (order.refundRequest) labels.push(`Yêu cầu hoàn tiền: ${order.refundRequest.status}`);
  return labels;
}

export function MerchantPurchaseOrdersTable({
  orders,
  onReport,
}: {
  orders: MerchantOrderRow[];
  onReport(order: MerchantOrderRow): void;
}) {
  const columns: TableColumnsType<MerchantOrderRow> = [
    {
      title: "Đơn hàng",
      dataIndex: "id",
      key: "id",
      width: 118,
      render: (_: unknown, order) => <Link to={`/merchant/orders?orderId=${order.id}`}>Đơn #{order.id}</Link>,
    },
    {
      title: "Thành viên",
      key: "member",
      width: 230,
      render: (_: unknown, order) => (
        <div className="min-w-0 break-words">
          <div>#{order.memberId}</div>
          {order.memberEmail ? <Typography.Text type="secondary">{order.memberEmail}</Typography.Text> : null}
        </div>
      ),
    },
    {
      title: "Sản phẩm",
      key: "items",
      width: 260,
      render: (_: unknown, order) => (
        <Typography.Text>
          {order.items.map((item) => `${item.productName} × ${item.quantity}`).join(", ")}
        </Typography.Text>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 240,
      render: (status: OrderDto["status"], order) => (
        <Space orientation="vertical" size={4}>
          <CmsStatusTag label={orderStatusLabel(status)} tone={tone(status)} />
          {refundLabel(order).map((label) => (
            <CmsStatusTag key={label} label={label} tone={label.startsWith("Yêu cầu") ? "warning" : "info"} />
          ))}
        </Space>
      ),
    },
    {
      title: "Tổng tiền",
      dataIndex: "total",
      key: "total",
      width: 150,
      align: "right",
      render: (value: string) => <Typography.Text strong>{formatPrice(value)}</Typography.Text>,
    },
    {
      title: "Điểm tích lũy",
      key: "earnedPoints",
      width: 160,
      render: (_: unknown, order) =>
        order.status === "PAID" && (order.earnedPointsExact != null || order.earnedPoints != null)
          ? `+${order.earnedPointsExact ?? order.earnedPoints?.toLocaleString("vi-VN")} điểm`
          : "—",
    },
    {
      title: "Thanh toán",
      dataIndex: "paidAt",
      key: "paidAt",
      width: 180,
      render: (value: string | null) => value ? new Date(value).toLocaleString("vi-VN") : "—",
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 200,
      render: (_: unknown, order) => (
        <Flex vertical align="start" gap={8}>
          {order.actions?.canRefund === true && !order.refundRequest ? (
            <Link to="/merchant/refund-requests">Xử lý yêu cầu hoàn tiền</Link>
          ) : null}
          <Button size="small" onClick={() => onReport(order)}>Báo cáo vi phạm</Button>
        </Flex>
      ),
    },
  ];

  return <CmsDataTable label="Đơn mua hàng" rows={orders} columns={columns} rowKey="id" tableLayout="fixed" scroll={{ x: 1538 }} />;
}
