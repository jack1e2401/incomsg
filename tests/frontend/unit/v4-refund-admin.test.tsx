// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthSessionProvider } from "../../../apps/frontend/src/api/auth-session";
import { AdminRefundHistoryPage } from "../../../apps/frontend/src/features/admin/AdminRefundHistoryPage";

const api = vi.hoisted(() => ({ listAdminRefundRequests: vi.fn(), getAdminRefundRequest: vi.fn() }));
vi.mock("../../../apps/frontend/src/api/refunds-client", () => ({ createRefundsClient: () => api }));

afterEach(() => { cleanup(); vi.clearAllMocks(); sessionStorage.clear(); });

it("reads recorded refund history and offers no decision actions", async () => {
  sessionStorage.setItem("loyalty.m2.session", JSON.stringify({ accessToken: "token", user: { id: 1, email: "admin@example.com", role: "ADMIN", isActive: true } }));
  const request = {
    id: 9, orderId: 42, memberId: 3, merchantId: 7, reason: "Hàng lỗi", status: "COMPLETED",
    requestedAt: "2026-11-17T00:00:00Z", merchantReviewedById: 2, merchantReviewedAt: "2026-11-17T01:00:00Z",
    merchantDecisionReason: "Đã kiểm tra", adminReviewedById: 1, adminReviewedAt: "2026-11-17T02:00:00Z",
  };
  api.listAdminRefundRequests.mockResolvedValue({
    items: [{ ...request, orderTotalVnd: "50000", memberEmail: "member@example.com", merchantName: "Mộc" }],
    pagination: { page: 1, totalPages: 1 },
  });
  api.getAdminRefundRequest.mockResolvedValue({
    refundRequest: request, merchant: { name: "Mộc" }, member: { email: "member@example.com" },
    order: { id: 42, total: "50000" }, settlement: { status: "COMPLETED", amountVnd: "50000" },
  });
  render(<AuthSessionProvider><MemoryRouter><AdminRefundHistoryPage /></MemoryRouter></AuthSessionProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Xem chi tiết" }));

  const detail = within(screen.getByRole("dialog"));
  expect(await detail.findByText("Đã kiểm tra")).toBeInTheDocument();
  expect(detail.getByText("Admin đã xét duyệt ở luồng cũ")).toBeInTheDocument();
  expect(detail.getByText("50.000 ₫")).toBeInTheDocument();
  expect(detail.getAllByRole("button")).toHaveLength(1);
  expect(detail.getByRole("button", { name: "Đóng" })).toBeInTheDocument();
});
