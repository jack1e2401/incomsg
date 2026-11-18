// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
const list = vi.hoisted(() => vi.fn());
vi.mock("../../../apps/frontend/src/features/merchant/merchant-page-support", () => ({ api: { listMerchantOrders: list }, formatPrice: (value: string) => `${value} ₫`, orderStatusLabel: () => "Đã thanh toán" }));
import { PendingProviderRefunds } from "../../../apps/frontend/src/features/merchant/refunds/PendingProviderRefunds";
import { MerchantPurchaseOrdersTable, type MerchantOrderRow } from "../../../apps/frontend/src/features/merchant/backend/MerchantPurchaseOrdersTable";
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("shows provider-pending refunds even without a member refund request", async () => {
  list.mockResolvedValue({ orders: [{ id: 842, memberId: 1, total: "45000", status: "REFUND_PENDING", refundStatus: "PENDING_PROVIDER", refundRequest: null }, { id: 844, memberId: 1, total: "49000", status: "REFUNDED", refundStatus: "COMPLETED" }] });
  render(<MemoryRouter><PendingProviderRefunds token="merchant-token" /></MemoryRouter>);
  expect(await screen.findByRole("link", { name: "#842" })).toHaveAttribute("href", "/merchant/orders?orderId=842");
  expect(screen.getByRole("link", { name: "Xem đơn hàng" })).toHaveAttribute("href", "/merchant/orders?orderId=842");
  expect(screen.getByText(/cửa hàng không thể xác nhận thủ công/i)).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "#844" })).not.toBeInTheDocument();
  expect(screen.getByText("Chờ cổng xác nhận")).toBeInTheDocument();
});
it("links only real pending member requests to their own review page", () => {
  const base: MerchantOrderRow = { id: 1, merchantId: 2, memberId: 3, status: "PAID", subtotal: "1", discountAmount: "0", total: "1", paidAt: null, items: [], earnedPointsExact: null, actions: { canCancel: false, canRefund: true, requiresReconciliation: false } };
  const request = { id: 17, status: "PENDING_MERCHANT" as const, reason: "Lỗi", requestedAt: "2026-11-18T00:00:00Z", merchantReviewedAt: null, adminReviewedAt: null, merchantDecisionReason: null, adminDecisionReason: null };
  render(<MemoryRouter><MerchantPurchaseOrdersTable orders={[base, { ...base, id: 2, refundRequest: request }]} onReport={vi.fn()} /></MemoryRouter>);
  expect(screen.getAllByRole("link", { name: "Xử lý yêu cầu hoàn tiền" })).toHaveLength(1);
  expect(screen.getByRole("link", { name: "Xử lý yêu cầu hoàn tiền" })).toHaveAttribute("href", "/merchant/refund-requests?requestId=17");
});
