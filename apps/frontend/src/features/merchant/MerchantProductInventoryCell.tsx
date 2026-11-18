import { useRef, useState } from "react";
import { Alert, Button, Dropdown, Flex, Spin, Tag, Typography } from "antd";
import { createCommerceClient } from "../../api/commerce-http";
import type { ProductDto } from "../../api/commerce-types";
import { useResource } from "../../api/useResource";
import { CmsFormDrawer } from "./cms";
import { InventoryPanel, type InventoryAdjustment } from "./InventoryPanel";

const api = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

function newRequestKey(productId: number) {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `stock-${productId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function MerchantProductInventoryCell({
  product,
  token,
  busy,
  onEdit,
  onStatusChange,
}: {
  product: ProductDto;
  token: string;
  busy: boolean;
  onEdit(): void;
  onStatusChange(): void;
}) {
  const isReward = product.kind === "REWARD";
  const resource = useResource(
    () => isReward ? api.getRewardInventory(product.id, token) : api.getProductInventory(product.id, token),
    [product.id, isReward, token],
  );
  const [drawer, setDrawer] = useState<"adjust" | "history" | null>(null);
  const retry = useRef<{ signature: string; key: string } | null>(null);
  const inventory = resource.data?.inventory;
  const onHand = inventory?.onHandQuantity ?? product.inventory?.onHandQuantity ?? 0;
  const reserved = inventory?.reservedQuantity ?? product.inventory?.reservedQuantity ?? 0;
  const available = inventory?.availableQuantity ?? product.inventory?.availableQuantity ?? 0;
  const threshold = product.lowStockThreshold ?? 5;
  const lowStock = resource.data ? available <= threshold : product.isLowStock ?? available <= threshold;

  async function adjust(adjustment: InventoryAdjustment) {
    const signature = `${adjustment.direction}|${adjustment.quantity}|${adjustment.reason.trim()}`;
    if (!retry.current || retry.current.signature !== signature) {
      retry.current = { signature, key: newRequestKey(product.id) };
    }
    const requestKey = retry.current.key;
    const body = { quantity: adjustment.quantity, reason: adjustment.reason };
    if (isReward) {
      await api.adjustRewardInventory(product.id, adjustment.direction, body, token, requestKey);
      resource.setData(await api.getRewardInventory(product.id, token));
    } else {
      await api.adjustProductInventory(product.id, adjustment.direction, body, token, requestKey);
      resource.setData(await api.getProductInventory(product.id, token));
    }
    retry.current = null;
  }

  const menuItems = [
    { key: "adjust", label: isReward ? "Điều chỉnh số lượng quà" : "Điều chỉnh tồn kho" },
    { key: "history", label: isReward ? "Lịch sử số lượng" : "Lịch sử tồn kho" },
    { type: "divider" as const },
    { key: "edit", label: "Chỉnh sửa sản phẩm" },
    { key: "status", label: product.status === "ACTIVE" ? "Ẩn sản phẩm" : "Hiển thị sản phẩm" },
  ];

  return (
    <Flex align="center" gap={8} wrap>
      <span className="min-w-20">
        {resource.loading ? <Spin size="small" /> : resource.error ? (
          <Typography.Text type="danger" title={resource.error}>Không tải được</Typography.Text>
        ) : (
          <>
            <Typography.Text strong>{available}</Typography.Text>
            <Typography.Text type="secondary" className="ml-1">có thể bán</Typography.Text>
          </>
        )}
      </span>
      {lowStock ? <Tag color="error">Sắp hết (≤ {threshold})</Tag> : null}
      <Dropdown
        menu={{
          items: menuItems,
          onClick: ({ key }) => {
            if (key === "adjust" || key === "history") setDrawer(key);
            if (key === "edit") onEdit();
            if (key === "status") onStatusChange();
          },
        }}
        trigger={["click"]}
      >
        <Button size="small" aria-label={`Thao tác sản phẩm ${product.name}`} disabled={busy}>Thao tác</Button>
      </Dropdown>
      <CmsFormDrawer
        open={drawer !== null}
        title={drawer === "history" ? "Lịch sử tồn kho" : "Điều chỉnh tồn kho"}
        onClose={() => setDrawer(null)}
        width={640}
      >
        {resource.error ? <Alert type="error" showIcon title="Không tải được tồn kho" description={resource.error} className="mb-4" /> : null}
        <InventoryPanel
          balance={{ onHandQuantity: onHand, reservedQuantity: reserved, availableQuantity: available }}
          movements={resource.data?.movements ?? []}
          onAdjust={adjust}
          mode={drawer ?? "adjust"}
          subject="product"
        />
      </CmsFormDrawer>
    </Flex>
  );
}
