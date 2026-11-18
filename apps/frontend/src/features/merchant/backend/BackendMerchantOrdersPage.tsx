import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Button, Flex, Input, Segmented, Select, Spin, Typography } from "antd";
import type { OrderDto } from "../../../api/commerce-types";
import { useResource } from "../../../api/useResource";
import { EmptyState, ErrorState } from "../../../components/ui";
import { PlatformFeeLedger } from "../../finance/PlatformFeeLedger";
import { MerchantAbuseReportDialog } from "../MerchantAbuseReportDialog";
import { MerchantRewardQueue } from "../MerchantRewardQueue";
import { CmsPageHeader } from "../cms";
import { MerchantPurchaseOrdersTable } from "./MerchantPurchaseOrdersTable";
import { MerchantPurchaseOrderDetail } from "./MerchantPurchaseOrderDetail";
import { api, useToken } from "../merchant-page-support";

export function MerchantOrders() {
  const token = useToken();
  const [params, setParams] = useSearchParams();
  const showFees = params.get("tab") === "fees";
  const orderId = Number(params.get("orderId"));
  const selectedOrderId = Number.isSafeInteger(orderId) && orderId > 0 ? orderId : null;
  const voucherId = Number(params.get("voucherId"));
  const selectedVoucherId = Number.isSafeInteger(voucherId) && voucherId > 0 ? voucherId : null;
  const tab = showFees ? "fees" : selectedVoucherId !== null || params.get("tab") === "rewards" ? "rewards" : "orders";
  return (
    <div className="grid min-w-0 gap-6">
      <CmsPageHeader title="Đơn hàng" />
      <div className="min-w-0 overflow-x-auto pb-1">
        <Segmented
          aria-label="Chế độ xem đơn hàng"
          style={{ background: "#e9f0e9", border: "1px solid #d7e4d8", padding: 4 }}
          value={tab}
          onChange={(value) => setParams(value === "orders" ? {} : { tab: String(value) })}
          options={[
            { label: "Đơn mua hàng", value: "orders" },
            { label: "Quà đổi thưởng", value: "rewards" },
            { label: "Sổ phí bán hàng", value: "fees" },
          ]}
        />
      </div>
      {showFees ? (
        <PlatformFeeLedger token={token} />
      ) : (
        <div className="space-y-8">
          {tab === "rewards" && selectedOrderId === null && (
            <section aria-labelledby="merchant-order-rewards" className="grid min-w-0 gap-4">
              <Typography.Title level={4} id="merchant-order-rewards" style={{ margin: 0 }}>
                Quà đổi thưởng
              </Typography.Title>
              {selectedVoucherId !== null && (
                <Button className="mb-3" onClick={() => setParams({ tab: "rewards" })}>
                  Tất cả quà đổi thưởng
                </Button>
              )}
              <MerchantRewardQueue
                key={selectedVoucherId ?? "all"}
                voucherId={selectedVoucherId ?? undefined}
              />
            </section>
          )}
          {tab === "orders" && selectedVoucherId === null && (
            <section aria-labelledby="merchant-purchase-orders" className="grid min-w-0 gap-4">
              <Typography.Title level={4} id="merchant-purchase-orders" style={{ margin: 0 }}>
                Đơn mua hàng
              </Typography.Title>
              {selectedOrderId !== null ? (
                <MerchantPurchaseOrders key={selectedOrderId} orderId={selectedOrderId} />
              ) : (
                <MerchantPurchaseOrders key="all" orderId={null} />
              )}
            </section>
          )}
        </div>
      )}
    </div>
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
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const normalizedQuery = query.trim().toLocaleLowerCase("vi-VN").replace(/^#/, "");
  const filteredOrders = (resource.data ?? []).filter((order) =>
    (status === "ALL" || order.status === status) &&
    (!normalizedQuery || String(order.id).includes(normalizedQuery) || String(order.memberId).includes(normalizedQuery) || order.memberEmail?.toLocaleLowerCase("vi-VN").includes(normalizedQuery)),
  );

  let content;
  if (resource.loading) {
    content = <Flex justify="center" className="py-10"><Spin description="Đang tải đơn hàng…" /></Flex>;
  } else if (resource.error) {
    content = <ErrorState message={resource.error} retry={resource.reload} />;
  } else if (!resource.data?.length) {
    content = (
      <EmptyState
        title="Chưa có đơn hàng"
        description="Đơn của Member sẽ xuất hiện sau khi được tạo tại cửa hàng này."
      />
    );
  } else if (orderId !== null) {
    const order = resource.data[0];
    content = order ? (
      <MerchantPurchaseOrderDetail order={order} onReport={() => setSelectedOrderForReport(order)} />
    ) : null;
  } else {
    content = (
      <div className="grid gap-4">
        <Flex gap={12} wrap>
          <Input aria-label="Tìm đơn hàng" placeholder="Mã đơn hoặc thành viên" value={query} onChange={(event) => setQuery(event.target.value)} style={{ width: 260, maxWidth: "100%" }} allowClear />
          <Select aria-label="Lọc trạng thái đơn hàng" value={status} onChange={setStatus} style={{ width: 180 }} options={[
            { value: "ALL", label: "Tất cả trạng thái" }, { value: "PENDING", label: "Chờ thanh toán" },
            { value: "PAID", label: "Đã thanh toán" }, { value: "FAILED", label: "Thất bại" },
            { value: "CANCELLED", label: "Đã hủy" }, { value: "REFUND_PENDING", label: "Đang hoàn tiền" },
            { value: "REFUNDED", label: "Đã hoàn tiền" },
          ]} />
        </Flex>
        <MerchantPurchaseOrdersTable orders={filteredOrders} onReport={setSelectedOrderForReport} />
      </div>
    );
  }

  return (
    <>
      {notice ? <Alert type="success" showIcon title={notice} className="mb-4" /> : null}
      {content}
      <MerchantAbuseReportDialog
        order={selectedOrderForReport}
        onClose={() => setSelectedOrderForReport(null)}
        onReportSubmitted={(_report, msg) => {
          setSelectedOrderForReport(null);
          setNotice(msg);
        }}
      />
    </>
  );
}
