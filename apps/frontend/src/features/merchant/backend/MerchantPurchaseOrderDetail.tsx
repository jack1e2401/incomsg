import { useState } from "react";
import { Button, Card, Descriptions, Flex, Typography, type TableColumnsType } from "antd";
import { Link } from "react-router-dom";
import { CmsDataTable, CmsDetailLayout, CmsStatusTag } from "../cms";
import { formatPrice, orderStatusLabel } from "../merchant-page-support";
import { OrderLoyaltyPolicySnapshot } from "../../orders/OrderLoyaltyPolicySnapshot";
import type { MerchantOrderRow } from "./MerchantPurchaseOrdersTable";

function statusTone(status: MerchantOrderRow["status"]) {
  if (status === "PAID") return "success" as const;
  if (status === "PENDING" || status === "REFUND_PENDING") return "warning" as const;
  if (status === "FAILED") return "error" as const;
  if (status === "REFUNDED") return "info" as const;
  return "neutral" as const;
}

export function MerchantPurchaseOrderDetail({
  order,
  onReport,
}: {
  order: MerchantOrderRow;
  onReport(): void;
}) {
  const [showPolicy, setShowPolicy] = useState(false);
  const itemColumns: TableColumnsType<MerchantOrderRow["items"][number]> = [
    { title: "Sản phẩm", dataIndex: "productName", key: "productName" },
    { title: "Số lượng", dataIndex: "quantity", key: "quantity", align: "right", width: 100 },
    { title: "Đơn giá", dataIndex: "unitPrice", key: "unitPrice", align: "right", render: formatPrice },
    { title: "Thành tiền", dataIndex: "lineTotal", key: "lineTotal", align: "right", render: formatPrice },
  ];
  const action = (
    <Flex gap={8} wrap>
      {order.actions?.canRefund === true && !order.refundRequest ? (
        <Button type="primary"><Link to="/merchant/refund-requests">Xử lý yêu cầu hoàn tiền</Link></Button>
      ) : null}
      <Button onClick={onReport}>Báo cáo vi phạm</Button>
    </Flex>
  );

  return (
    <CmsDetailLayout
      title={`Đơn #${order.id}`}
      backTo="/merchant/orders"
      backLabel="Quay lại đơn hàng"
      status={<CmsStatusTag label={orderStatusLabel(order.status)} tone={statusTone(order.status)} />}
      action={action}
    >
      <Card title="Thông tin đơn hàng" size="small">
        <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 3 }}>
          <Descriptions.Item label="Thành viên">
            <Flex vertical gap={2}>
              <span>#{order.memberId}</span>
              {order.memberEmail ? <Typography.Text type="secondary">{order.memberEmail}</Typography.Text> : null}
            </Flex>
          </Descriptions.Item>
          <Descriptions.Item label="Tạm tính">{formatPrice(order.subtotal)}</Descriptions.Item>
          <Descriptions.Item label="Voucher giảm giá">−{formatPrice(order.discountAmount)}</Descriptions.Item>
          <Descriptions.Item label="Tổng cộng"><Typography.Text strong>{formatPrice(order.total)}</Typography.Text></Descriptions.Item>
          <Descriptions.Item label="Thanh toán">{order.paidAt ? new Date(order.paidAt).toLocaleString("vi-VN") : "—"}</Descriptions.Item>
          <Descriptions.Item label="Điểm tích lũy">
            {order.status === "PAID" && (order.earnedPointsExact != null || order.earnedPoints != null)
              ? `+${order.earnedPointsExact ?? order.earnedPoints?.toLocaleString("vi-VN")} điểm`
              : "—"}
          </Descriptions.Item>
        </Descriptions>
        {order.refundStatus === "PENDING_PROVIDER" ? (
          <CmsStatusTag label="Chờ cổng xác nhận hoàn tiền" tone="warning" />
        ) : null}
        {order.refundStatus === "COMPLETED" && order.status !== "REFUNDED" ? (
          <CmsStatusTag label="Đã hoàn tiền" tone="info" />
        ) : null}
        {order.refundRequest ? (
          <CmsStatusTag label={`Yêu cầu hoàn tiền: ${order.refundRequest.status}`} tone="warning" />
        ) : null}
      </Card>
      <Card title="Sản phẩm trong đơn" size="small">
        <CmsDataTable label="Sản phẩm trong đơn" rows={order.items} columns={itemColumns} rowKey="productId" />
      </Card>
      {order.paidAt ? (
        <Card
          title="Chính sách loyalty đã áp dụng"
          size="small"
          extra={<Button type="link" onClick={() => setShowPolicy((value) => !value)}>{showPolicy ? "Ẩn" : "Xem"}</Button>}
        >
          {showPolicy ? <OrderLoyaltyPolicySnapshot policy={order.appliedLoyaltyPolicy ?? null} /> : null}
        </Card>
      ) : null}
    </CmsDetailLayout>
  );
}
