// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
const { api } = vi.hoisted(() => ({ api: { listAdminRefundRequests: vi.fn(), getAdminRefundRequest: vi.fn(), approveAdminRefundRequest: vi.fn(), rejectAdminRefundRequest: vi.fn() } }));
vi.mock("../../../apps/frontend/src/api/refunds-client", () => ({ createRefundsClient: () => api }));
import { AuthSessionProvider } from "../../../apps/frontend/src/api/auth-session";
import { AdminRefundApprovalsPage } from "../../../apps/frontend/src/features/admin/AdminRefundApprovalsPage";

afterEach(() => { cleanup(); vi.restoreAllMocks(); sessionStorage.clear(); });

it("loads the admin preview and supports approve and reject actions", async () => {
  sessionStorage.setItem("loyalty.m2.session", JSON.stringify({ accessToken: "token", user: { id: 1, email: "admin@example.com", role: "ADMIN", isActive: true } }));
  api.listAdminRefundRequests.mockResolvedValue({ items: [{ id: 9, orderId: 42, memberId: 3, merchantId: 7, reason: "Hàng lỗi", status: "PENDING_ADMIN", requestedAt: "2026-11-17", merchantReviewedById: 2, merchantReviewedAt: null, merchantDecisionReason: "Đã kiểm tra", adminReviewedById: null, adminReviewedAt: null, adminDecisionReason: null, createdAt: "", updatedAt: "", orderTotalVnd: "50000", orderStatus: "PAID", memberEmail: "member@example.com", merchantName: "Mộc" }], pagination: { page: 1, limit: 10, totalItems: 1, totalPages: 1 } });
  api.getAdminRefundRequest.mockResolvedValue({ refundRequest: { id: 9, orderId: 42, memberId: 3, merchantId: 7, reason: "Hàng lỗi", status: "PENDING_ADMIN", requestedAt: "", merchantReviewedById: 2, merchantReviewedAt: null, merchantDecisionReason: "Đã kiểm tra", adminReviewedById: null, adminReviewedAt: null, adminDecisionReason: null, createdAt: "", updatedAt: "" }, merchant: { id: 7, name: "Mộc", slug: "moc" }, member: { id: 3, email: "member@example.com" }, order: { id: 42, total: "50000" }, preview: { refundAmountVnd: "50000", walletBefore: { exactBalance: "80", netLifetimeEarned: "100" }, walletAfter: { exactBalance: "20", netLifetimeEarned: "40" }, tierBefore: "SILVER", tierAfter: "BRONZE", discountVoucherRestorable: true, challenges: [{ challengeId: 2, title: "Mua 3 lần", currentValueBefore: "3", currentValueAfter: "2", rewardStateBefore: "REWARDED", rewardStateAfter: "IN_PROGRESS", budgetSpentBefore: "20", budgetSpentAfter: "0" }] } });
  api.rejectAdminRefundRequest.mockResolvedValue({ refundRequest: {} });
  api.approveAdminRefundRequest.mockResolvedValue({ refundRequest: {}, refund: {}, order: {}, walletImpact: {}, challengeReversals: [] });
  render(<AuthSessionProvider><MemoryRouter initialEntries={["/admin/refund-requests"]}><Routes><Route path="/admin/refund-requests" element={<AdminRefundApprovalsPage />} /></Routes></MemoryRouter></AuthSessionProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Xem và duyệt" }));
  expect(await screen.findByText("member@example.com")).toBeInTheDocument();
  expect(screen.getByText("Trước / sau hoàn tiền")).toBeInTheDocument();
  expect(screen.getByText("Mua 3 lần · tiến độ / thưởng / ngân sách")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Từ chối" }));
  fireEvent.change(screen.getByLabelText(/Lý do thực hiện/), { target: { value: "Không đủ điều kiện" } });
  fireEvent.click(screen.getAllByRole("button", { name: "Từ chối" }).at(-1)!);
  await waitFor(() => expect(api.rejectAdminRefundRequest).toHaveBeenCalledWith(9, "Không đủ điều kiện", "token"));
  fireEvent.click(await screen.findByRole("button", { name: "Xem và duyệt" }));
  fireEvent.click(await screen.findByRole("button", { name: "Phê duyệt & Thực thi hoàn tiền" }));
  fireEvent.click(await screen.findByRole("button", { name: "Xác nhận" }));
  await waitFor(() => expect(api.approveAdminRefundRequest).toHaveBeenCalledWith(9, "token"));
});
