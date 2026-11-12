// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockFetchHandler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

vi.mock("../../../apps/frontend/src/api/commerce-http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../apps/frontend/src/api/commerce-http")>();
  return {
    ...actual,
    createCommerceClient: (baseUrl: string, fetcher?: typeof fetch) => {
      return actual.createCommerceClient(baseUrl, (input, init) => {
        if (mockFetchHandler) return mockFetchHandler(input, init);
        return (fetcher ?? fetch)(input, init);
      });
    },
  };
});

import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthSessionProvider } from "../../../apps/frontend/src/api/auth-session";
import {
  MerchantOrders,
  MerchantAbuseReportDialog,
} from "../../../apps/frontend/src/features/merchant/BackendMerchantPages";

function renderWithMerchantSession(element: React.ReactNode) {
  const sessionData = JSON.stringify({
    accessToken: "merchant-jwt-token",
    user: { id: 2, email: "merchant@test.local", role: "MERCHANT", isActive: true },
  });
  sessionStorage.setItem("loyalty.m2.session", sessionData);
  sessionStorage.setItem("loyalty.auth.session", sessionData);

  return render(
    <AuthSessionProvider>
      <MemoryRouter initialEntries={["/merchant/orders"]}>
        <Routes>
          <Route path="/merchant/orders" element={element} />
        </Routes>
      </MemoryRouter>
    </AuthSessionProvider>,
  );
}

describe("Merchant Abuse Report Dialog & Order Actions", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const sampleOrder = {
    id: 88,
    merchantId: 5,
    memberId: 19,
    memberEmail: "abusive.member@incom.local",
    status: "PAID" as const,
    subtotal: "150000",
    discountAmount: "0",
    total: "150000",
    paidAt: "2026-11-12T08:00:00.000Z",
    items: [{ productId: 1, productName: "Cà phê Muối", unitPrice: "75000", quantity: 2, lineTotal: "150000" }],
    earnedPointsExact: "15.000000000000",
    actions: { canCancel: false, canRefund: true, requiresReconciliation: false },
  };

  it("renders 'Báo cáo vi phạm' button for orders and opens the report dialog", async () => {
    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/merchant/orders/rewards")) {
        return Response.json({ rewards: [] });
      }
      if (url.includes("/api/merchant/orders")) {
        return Response.json({ orders: [sampleOrder] });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderWithMerchantSession(<MerchantOrders />);

    await waitFor(() => {
      expect(screen.getByText("Đơn #88")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Báo cáo vi phạm" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Báo cáo vi phạm" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Báo cáo vi phạm đơn #88" })).toBeInTheDocument();
      expect(screen.getAllByText(/abusive\.member@incom\.local/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByPlaceholderText(/Mô tả cụ thể hành vi vi phạm/i)).toBeInTheDocument();
    });
  });

  it("validates that reason cannot be empty", async () => {
    const onClose = vi.fn();
    const onReportSubmitted = vi.fn();

    renderWithMerchantSession(
      <MerchantAbuseReportDialog
        order={sampleOrder}
        onClose={onClose}
        onReportSubmitted={onReportSubmitted}
      />,
    );

    expect(screen.getByRole("heading", { name: "Báo cáo vi phạm đơn #88" })).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: "Gửi báo cáo" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Vui lòng nhập lý do báo cáo vi phạm.")).toBeInTheDocument();
    });
    expect(onReportSubmitted).not.toHaveBeenCalled();
  });

  it("submits abuse report to POST /api/merchant/abuse-reports and invokes onReportSubmitted", async () => {
    const onClose = vi.fn();
    const onReportSubmitted = vi.fn();

    let postedBody: unknown = null;
    let postedMethod = "";
    let authHeader: string | null = null;

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/merchant/abuse-reports") && init?.method === "POST") {
        postedMethod = init.method;
        postedBody = JSON.parse(String(init.body));
        authHeader = new Headers(init.headers).get("Authorization");
        return Response.json(
          {
            report: {
              id: 50,
              merchantId: 5,
              reporterId: 2,
              memberId: 19,
              orderId: 88,
              reason: "Tài khoản gian lận hoàn tiền nhiều lần",
              createdAt: "2026-11-12T10:00:00.000Z",
            },
          },
          { status: 201 },
        );
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderWithMerchantSession(
      <MerchantAbuseReportDialog
        order={sampleOrder}
        onClose={onClose}
        onReportSubmitted={onReportSubmitted}
      />,
    );

    const textarea = screen.getByPlaceholderText(/Mô tả cụ thể hành vi vi phạm/i);
    fireEvent.change(textarea, { target: { value: "Tài khoản gian lận hoàn tiền nhiều lần" } });

    const submitBtn = screen.getByRole("button", { name: "Gửi báo cáo" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onReportSubmitted).toHaveBeenCalledWith(
        expect.objectContaining({ id: 50, orderId: 88, memberId: 19 }),
        "Đã gửi báo cáo vi phạm cho đơn #88.",
      );
      expect(onClose).toHaveBeenCalled();
    });

    expect(postedMethod).toBe("POST");
    expect(authHeader).toBe("Bearer merchant-jwt-token");
    expect(postedBody).toEqual({
      memberId: 19,
      orderId: 88,
      reason: "Tài khoản gian lận hoàn tiền nhiều lần",
    });
  });

  it("displays translated error message when backend returns an error code", async () => {
    const onClose = vi.fn();
    const onReportSubmitted = vi.fn();

    mockFetchHandler = vi.fn().mockImplementation(async () => {
      return Response.json({ error: "MEMBER_NOT_FOUND" }, { status: 404 });
    });

    renderWithMerchantSession(
      <MerchantAbuseReportDialog
        order={sampleOrder}
        onClose={onClose}
        onReportSubmitted={onReportSubmitted}
      />,
    );

    const textarea = screen.getByPlaceholderText(/Mô tả cụ thể hành vi vi phạm/i);
    fireEvent.change(textarea, { target: { value: "Vi phạm" } });

    const submitBtn = screen.getByRole("button", { name: "Gửi báo cáo" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Không tìm thấy thành viên trong cửa hàng.")).toBeInTheDocument();
    });
    expect(onReportSubmitted).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes dialog when 'Hủy' is clicked", async () => {
    const onClose = vi.fn();
    const onReportSubmitted = vi.fn();

    renderWithMerchantSession(
      <MerchantAbuseReportDialog
        order={sampleOrder}
        onClose={onClose}
        onReportSubmitted={onReportSubmitted}
      />,
    );

    const cancelBtn = screen.getByRole("button", { name: "Hủy" });
    fireEvent.click(cancelBtn);

    expect(onClose).toHaveBeenCalled();
  });
});
