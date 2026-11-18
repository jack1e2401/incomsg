import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Button, Flex, Segmented, Spin, Typography } from "antd";
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
  return (
    <div className="grid min-w-0 gap-6">
      <CmsPageHeader title="Đơn hàng" />
      <div className="min-w-0 overflow-x-auto pb-1">
        <Segmented
          aria-label="Chế độ xem đơn hàng"
          value={showFees ? "fees" : "orders"}
          onChange={(value) => setParams(value === "fees" ? { tab: "fees" } : {})}
          options={[
            { label: "Đơn mua và quà đổi thưởng", value: "orders" },
            { label: "Sổ phí bán hàng", value: "fees" },
          ]}
        />
      </div>
      {showFees ? (
        <PlatformFeeLedger token={token} />
      ) : (
        <div className="space-y-8">
          {selectedOrderId === null && (
            <section aria-labelledby="merchant-order-rewards" className="grid min-w-0 gap-4">
              <Typography.Title level={4} id="merchant-order-rewards" style={{ margin: 0 }}>
                Quà đổi thưởng
              </Typography.Title>
              {selectedVoucherId !== null && (
                <Button className="mb-3" onClick={() => setParams({})}>
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
      <MerchantPurchaseOrdersTable
        orders={resource.data}
        onReport={setSelectedOrderForReport}
      />
    );
  }

  return (
    <>
      {notice ? <Alert type="success" showIcon message={notice} className="mb-4" /> : null}
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
