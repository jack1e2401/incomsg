// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";

const { getOrder, createRequest } = vi.hoisted(() => ({ getOrder: vi.fn(), createRequest: vi.fn() }));
vi.mock("../../../apps/frontend/src/api/commerce-http", () => ({ createCommerceClient: () => ({
  getMemberOrder: getOrder,
  payMockOrder: vi.fn(),
  cancelOrder: vi.fn(),
}) }));
vi.mock("../../../apps/frontend/src/api/refunds-client", () => ({ createRefundsClient: () => ({
  createMemberRefundRequest: createRequest,
}), translateRefundRequestError: (value: string) => value }));
import { AuthSessionProvider } from "../../../apps/frontend/src/api/auth-session";
import { MemberOrderResult } from "../../../apps/frontend/src/features/member/MemberOrderResult";

const order = {
  id: 42, merchantId: 5, memberId: 1, status: "PAID" as const, subtotal: "100000", discountAmount: "0", total: "100000",
  paidAt: "2026-11-16T00:00:00.000Z", earnedPointsExact: "0", paymentStatus: null,
  items: [{ productId: 7, productName: "Cà phê", unitPrice: "100000", quantity: 1, lineTotal: "100000" }],
  actions: { canCancel: false, canRefund: false, canRequestRefund: true, requiresReconciliation: false },
};
const session = { accessToken: "member-token", user: { id: 1, email: "member@test.local", role: "MEMBER", isActive: true } };
function renderPage() {
  sessionStorage.setItem("loyalty.m2.session", JSON.stringify(session));
  return render(<AuthSessionProvider><MemoryRouter initialEntries={["/s/coffee/orders/42"]}><Routes>
    <Route path="/s/coffee" element={<Context />}><Route path="orders/:orderId" element={<MemberOrderResult />} /></Route>
  </Routes></MemoryRouter></AuthSessionProvider>);
}
function Context() { return <Outlet context={{ merchantId: 5, basePath: "/s/coffee", cart: {} as never }} />; }

describe("V4 member refund requests", () => {
  beforeEach(() => { sessionStorage.clear(); getOrder.mockResolvedValue({ order }); createRequest.mockResolvedValue({ refundRequest: { id: 4, orderId: 42, memberId: 1, merchantId: 5, reason: "Sản phẩm bị lỗi", status: "PENDING_MERCHANT", requestedAt: "2026-11-17T10:00:00.000Z", merchantReviewedById: null, merchantReviewedAt: null, merchantDecisionReason: null, adminReviewedById: null, adminReviewedAt: null, adminDecisionReason: null, createdAt: "2026-11-17T10:00:00.000Z", updatedAt: "2026-11-17T10:00:00.000Z" } }); });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it("submits a required reason and renders the returned request status", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Yêu cầu hoàn tiền" }));
    fireEvent.change(screen.getByLabelText("Lý do hoàn tiền"), { target: { value: "Sản phẩm bị lỗi" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));
    await waitFor(() => expect(createRequest).toHaveBeenCalledWith(42, "Sản phẩm bị lỗi", "member-token"));
    expect(await screen.findByText("Chờ cửa hàng duyệt")).toBeInTheDocument();
    expect(screen.getByText("Lý do: Sản phẩm bị lỗi")).toBeInTheDocument();
  });
});
