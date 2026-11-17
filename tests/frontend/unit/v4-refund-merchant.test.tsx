// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthSessionProvider } from "../../../apps/frontend/src/api/auth-session";
import { MerchantRefundRequestsPage } from "../../../apps/frontend/src/features/merchant/refunds/MerchantRefundRequestsPage";

const mocks = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), approve: vi.fn(), reject: vi.fn() }));
vi.mock("../../../apps/frontend/src/api/refunds-client", () => ({ createRefundsClient: () => ({ listMerchantRefundRequests: mocks.list, getMerchantRefundRequest: mocks.get, approveMerchantRefundRequest: mocks.approve, rejectMerchantRefundRequest: mocks.reject }) }));
const item = { id: 11, orderId: 21, memberId: 4, merchantId: 2, reason: "Hàng lỗi", status: "PENDING_MERCHANT" as const, requestedAt: "2026-11-17T00:00:00Z", merchantReviewedById: null, merchantReviewedAt: null, merchantDecisionReason: null, adminReviewedById: null, adminReviewedAt: null, adminDecisionReason: null, createdAt: "", updatedAt: "", orderTotalVnd: "50000", orderStatus: "PAID" as const, memberEmail: "m@test.local" };
const detail = { refundRequest: item, order: { id: 21, merchantId: 2, memberId: 4, status: "PAID" as const, subtotal: "50000", discountAmount: "0", total: "50000", paidAt: null, items: [{ productId: 1, productName: "Tea", unitPrice: "50000", quantity: 1, lineTotal: "50000" }], earnedPointsExact: "5", actions: { canRefund: false, canCancel: false, requiresReconciliation: false } }, preview: { orderId: 21, refundAmountVnd: "50000", refundStatus: null, earningReversalExact: "5", walletBefore: { availablePoints: 10, netLifetimeEarned: "10", pointDebt: "0", fractionalCarry: "0" }, walletAfter: { availablePoints: 5, netLifetimeEarned: "5", pointDebt: "0", fractionalCarry: "0" }, tierBefore: "BRONZE", tierAfter: "BRONZE", discountVoucherRestorable: true, providerConfirmationRequired: false, challenges: [{ challengeId: 1, title: "First", type: "ORDER_COUNT", targetValue: "3", currentValueBefore: "3", currentValueAfter: "2", rewardStateBefore: "REWARDED", rewardStateAfter: "IN_PROGRESS", grantStatusBefore: "GRANTED", grantStatusAfter: "REVERSED", pointsToReverseExact: "5", budgetSpentBefore: "5", budgetSpentAfter: "0" }] } };
function renderPage(initialEntry = "/merchant/refund-requests") { const s = JSON.stringify({ accessToken: "merchant-token", user: { id: 2, email: "merchant@test.local", role: "MERCHANT", isActive: true } }); sessionStorage.setItem("loyalty.m2.session", s); sessionStorage.setItem("loyalty.auth.session", s); return render(<AuthSessionProvider><MemoryRouter initialEntries={[initialEntry]}><MerchantRefundRequestsPage /></MemoryRouter></AuthSessionProvider>); }
describe("merchant refund request approvals", () => { beforeEach(() => { sessionStorage.clear(); mocks.list.mockResolvedValue({ items: [item], pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 } }); mocks.get.mockResolvedValue(detail); mocks.approve.mockResolvedValue({ refundRequest: { ...item, status: "PENDING_ADMIN" } }); mocks.reject.mockResolvedValue({ refundRequest: { ...item, status: "REJECTED" } }); }); afterEach(() => { cleanup(); vi.clearAllMocks(); });
 it("renders refund requests in a named data table", async () => {
   renderPage();
   expect(await screen.findByRole("table", { name: "Yêu cầu hoàn tiền" })).toBeInTheDocument();
 });
 it("restores the selected refund detail from the URL", async () => {
   renderPage("/merchant/refund-requests?requestId=11");
   expect(await screen.findByText(/Nhiệm vụ: First/)).toBeInTheDocument();
   expect(screen.getByRole("heading", { name: "Yêu cầu hoàn tiền #11" })).toBeInTheDocument();
 });
 it("shows the preview and requires confirmation before executing the refund", async () => {
   mocks.approve.mockResolvedValue({ refundRequest: { ...item, status: "COMPLETED" } });
   renderPage();
   await screen.findByText("Hàng lỗi");
   fireEvent.click(screen.getByRole("button", { name: "Xem & Duyệt" }));
   expect(await screen.findByText(/Nhiệm vụ: First/)).toBeInTheDocument();
   expect(screen.getAllByText(/50\.000/).length).toBeGreaterThan(0);
   fireEvent.click(screen.getByRole("button", { name: "Duyệt hoàn tiền" }));
   expect(mocks.approve).not.toHaveBeenCalled();
   fireEvent.click(screen.getByRole("button", { name: "Xác nhận hoàn tiền" }));
   await waitFor(() => expect(mocks.approve).toHaveBeenCalledWith(11, "merchant-token", undefined));
 });
 it("requires a rejection reason", async () => { renderPage(); await screen.findByText("Hàng lỗi"); fireEvent.click(screen.getByRole("button", { name: "Xem & Duyệt" })); await screen.findByText(/Nhiệm vụ: First/); const reject = screen.getByRole("button", { name: "Từ chối" }); expect(reject).toBeDisabled(); fireEvent.change(screen.getByPlaceholderText("Nhập ghi chú; bắt buộc khi từ chối"), { target: { value: "Sai thông tin" } }); fireEvent.click(reject); await waitFor(() => expect(mocks.reject).toHaveBeenCalledWith(11, "Sai thông tin", "merchant-token")); });
 it("displays projected point debt and tier demotion in preview", async () => {
   mocks.get.mockResolvedValue({
     ...detail,
     preview: {
       ...detail.preview,
       walletAfter: { availablePoints: 0, netLifetimeEarned: "0.6", pointDebt: "0.4", fractionalCarry: "0" },
       tierBefore: "SILVER",
       tierAfter: "BRONZE",
     },
   });
   renderPage();
   await screen.findByText("Hàng lỗi");
   fireEvent.click(screen.getByRole("button", { name: "Xem & Duyệt" }));
   expect(await screen.findByText(/nợ 0\.4/)).toBeInTheDocument();
   expect(screen.getByText("SILVER")).toBeInTheDocument();
   expect(screen.getByText("BRONZE")).toBeInTheDocument();
 });
});
