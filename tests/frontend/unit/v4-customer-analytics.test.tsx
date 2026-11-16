// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockFetchHandler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

vi.mock("../../../apps/frontend/src/api/analytics-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../apps/frontend/src/api/analytics-client")>();
  return {
    ...actual,
    createAnalyticsClient: (baseUrl: string, fetcher?: typeof fetch) => {
      return actual.createAnalyticsClient(baseUrl, (input, init) => {
        if (mockFetchHandler) return mockFetchHandler(input, init);
        return (fetcher ?? fetch)(input, init);
      });
    },
  };
});

vi.mock("../../../apps/frontend/src/features/merchant/MerchantRevenuePlot", () => ({
  default: ({ days }: { days: { label: string; amount: number }[] }) => (
    <div data-testid="mock-revenue-plot">{days.length} points</div>
  ),
}));

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthSessionProvider } from "../../../apps/frontend/src/api/auth-session";
import { MerchantCustomersPage } from "../../../apps/frontend/src/features/customers/MerchantCustomersPage";
import { MerchantCustomerDetailPage } from "../../../apps/frontend/src/features/customers/MerchantCustomerDetailPage";
import { MerchantAnalyticsPage } from "../../../apps/frontend/src/features/analytics/MerchantAnalyticsPage";
import { useEnsureMembership } from "../../../apps/frontend/src/features/customers/useEnsureMembership";

function setSession(role: "MERCHANT" | "MEMBER", id = 2) {
  const sessionData = JSON.stringify({
    accessToken: `${role.toLowerCase()}-jwt-token`,
    user: { id, email: `${role.toLowerCase()}@test.local`, role, isActive: true },
  });
  sessionStorage.setItem("loyalty.m2.session", sessionData);
  sessionStorage.setItem("loyalty.auth.session", sessionData);
}

function renderWithRouter(initialEntry: string, element: React.ReactNode, routePath: string) {
  return render(
    <AuthSessionProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path={routePath} element={element} />
        </Routes>
      </MemoryRouter>
    </AuthSessionProvider>,
  );
}

function EnsureProbe({ slug }: { slug: string }) {
  const state = useEnsureMembership({ slug });
  return <div data-testid="ensure-status">{state.membership?.tier ?? (state.loading ? "loading" : "idle")}</div>;
}

describe("V4 Workstreams D & E UI", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders MerchantCustomersPage with filters and zero-order/refund-pending rows", async () => {
    setSession("MERCHANT");
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/merchant/customers")) {
        return Response.json({
          items: [
            {
              memberId: 101,
              email: "alice@test.local",
              joinedAt: "2026-11-01T00:00:00.000Z",
              tier: "SILVER",
              availablePoints: 45,
              exactBalance: "45.5",
              fractionalCarry: "0.5",
              netLifetimeEarned: "1200",
              pointDebt: "0",
              paidOrderCount: 3,
              refundPendingOrderCount: 1,
              refundPendingSpendVnd: "50000",
              netSpendVnd: "350000",
              lastPurchaseAt: "2026-11-15T10:00:00.000Z",
            },
            {
              memberId: 102,
              email: "bob@test.local",
              joinedAt: "2026-11-10T00:00:00.000Z",
              tier: "UNRANKED",
              availablePoints: 0,
              exactBalance: "0",
              fractionalCarry: "0",
              netLifetimeEarned: "0",
              pointDebt: "0",
              paidOrderCount: 0,
              refundPendingOrderCount: 0,
              refundPendingSpendVnd: "0",
              netSpendVnd: "0",
              lastPurchaseAt: null,
            },
          ],
          pagination: { page: 1, limit: 20, totalItems: 2, totalPages: 1 },
        });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });
    mockFetchHandler = fetchSpy;

    renderWithRouter("/merchant/customers", <MerchantCustomersPage />, "/merchant/customers");

    await waitFor(() => {
      const table = screen.getByRole("table", { name: "Danh sách khách hàng" });
      expect(within(table).getByText("alice@test.local")).toBeInTheDocument();
      expect(within(table).getByText("bob@test.local")).toBeInTheDocument();
      expect(within(table).getByText("+1 chờ hoàn")).toBeInTheDocument();
      expect(within(table).getByText("Chưa xếp hạng")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Trạng thái mua hàng"), { target: { value: "non_buyers" } });
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("purchaseStatus=non_buyers"),
        expect.anything(),
      );
    });
  });

  it("renders MerchantCustomerDetailPage with stats, wallet, ledger, vouchers, and orders", async () => {
    setSession("MERCHANT");
    mockFetchHandler = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/merchant/customers/101")) {
        return Response.json({
          customer: {
            member: { id: 101, email: "alice@test.local", joinedAt: "2026-11-01T00:00:00.000Z" },
            stats: {
              totalOrders: 2,
              paidOrderCount: 1,
              refundPendingOrderCount: 1,
              refundedOrderCount: 0,
              netSpendVnd: "150000",
              refundPendingSpendVnd: "50000",
              averageOrderValueVnd: "75000",
              lastPurchaseAt: "2026-11-15T10:00:00.000Z",
            },
            wallet: {
              merchantId: 1,
              policy: {
                merchantId: 1,
                vndPerPoint: 10000,
                isActive: true,
                tiers: [{ level: "BRONZE", minLifetimePoints: 0, multiplier: "1.00" }],
              },
              exactBalance: "15.25",
              availablePoints: 15,
              fractionalCarry: "0.25",
              pointDebt: "0",
              netLifetimeEarned: "15.25",
              lifetimeEarnedPoints: 15,
              tier: "BRONZE",
            },
            pointLedger: [
              {
                id: 1,
                type: "EARN",
                delta: "15.25",
                balanceAfter: "15.25",
                availablePointsAfter: 15,
                fractionalCarryAfter: "0.25",
                pointDebtAfter: "0",
                reason: "Earned from order #55",
                eventRef: "ev-1",
                source: "MOCK_PAYMENT",
                actorId: 101,
                orderId: 55,
                memberVoucherId: null,
                createdAt: "2026-11-15T10:00:00.000Z",
              },
            ],
            vouchers: [
              {
                id: 9,
                definitionId: 3,
                merchantId: 1,
                memberId: 101,
                title: "Giảm 20k",
                type: "DISCOUNT",
                status: "USED",
                reserved: false,
                pointsCost: 10,
                discountAmount: "20000",
                rewardDescription: null,
                redeemedAt: "2026-11-10T00:00:00.000Z",
                usedAt: "2026-11-12T00:00:00.000Z",
              },
            ],
            orders: [
              {
                id: 55,
                merchantId: 1,
                memberId: 101,
                status: "PAID",
                subtotal: "100000",
                discountAmount: "0",
                total: "100000",
                paidAt: "2026-11-15T10:00:00.000Z",
                earnedPointsExact: "10",
                items: [{ productId: 1, productName: "Matcha", unitPrice: "100000", quantity: 1, lineTotal: "100000" }],
              },
            ],
          },
        });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderWithRouter("/merchant/customers/101", <MerchantCustomerDetailPage />, "/merchant/customers/:memberId");

    await waitFor(() => {
      expect(screen.getByText("alice@test.local")).toBeInTheDocument();
      expect(screen.getByText("Earned from order #55")).toBeInTheDocument();
      expect(screen.getByText("Giảm 20k")).toBeInTheDocument();
      expect(screen.getByText("Matcha ×1")).toBeInTheDocument();
      expect(screen.getByText("0.25")).toBeInTheDocument();
    });
  });

  it("renders MerchantAnalyticsPage KPIs, chart, tables, and validates range", async () => {
    setSession("MERCHANT");
    mockFetchHandler = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/merchant/analytics")) {
        return Response.json({
          range: { from: "2026-11-01", to: "2026-11-16", granularity: "day", timezone: "Asia/Ho_Chi_Minh" },
          kpis: {
            netRevenueVnd: "500000",
            paidOnlyRevenueVnd: "450000",
            refundPendingRevenueVnd: "50000",
            refundedRevenueVnd: "20000",
            paidOrderCount: 5,
            refundPendingOrderCount: 1,
            refundedOrderCount: 1,
            averageOrderValueVnd: "100000",
            totalMembers: 20,
            newMembers: 4,
            returningCustomers: 3,
          },
          revenueSeries: [{ bucket: "2026-11-16", label: "16/11", revenueVnd: "500000", orderCount: 5 }],
          topProducts: [{ productId: 1, productName: "Cà phê sữa", sku: "CF-01", unitsSold: 10, revenueVnd: "350000" }],
          slowMovingProducts: [{ productId: 2, productName: "Trà đào", sku: "TD-01", unitsSold: 0, revenueVnd: "0", availableQuantity: 12 }],
          noSales90DaysProducts: [{ productId: 2, productName: "Trà đào", sku: "TD-01", availableQuantity: 12, lastSoldAt: null }],
          lowStockProducts: [{ productId: 3, productName: "Bánh mì", sku: "BM-01", availableQuantity: 2, lowStockThreshold: 5 }],
        });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderWithRouter("/merchant/analytics", <MerchantAnalyticsPage />, "/merchant/analytics");

    await waitFor(() => {
      expect(screen.getByText("Phân tích cửa hàng")).toBeInTheDocument();
      expect(screen.getByTestId("mock-revenue-plot")).toHaveTextContent("1 points");
      expect(screen.getByText("Cà phê sữa")).toBeInTheDocument();
      expect(screen.getAllByText("Trà đào").length).toBeGreaterThan(0);
      expect(screen.getByText("Bánh mì")).toBeInTheDocument();
    });

    // Validate invalid range > 366 days
    fireEvent.change(screen.getByLabelText("Từ ngày"), { target: { value: "2025-01-01" } });
    fireEvent.change(screen.getByLabelText("Đến ngày"), { target: { value: "2026-11-16" } });
    fireEvent.click(screen.getByRole("button", { name: "Xem báo cáo" }));
    expect(screen.getByRole("alert")).toHaveTextContent("tối đa là 366 ngày");
  });

  it("useEnsureMembership posts once for MEMBER and skips for MERCHANT", async () => {
    setSession("MEMBER", 7);
    const spy = vi.fn(async () =>
      Response.json({
        membership: { id: 1, merchantId: 2, memberId: 7, tier: "UNRANKED", createdAt: "2026-11-16T00:00:00Z" },
        created: true,
      }),
    );
    mockFetchHandler = spy;

    render(
      <AuthSessionProvider>
        <EnsureProbe slug="tra-sua-moc" />
      </AuthSessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("ensure-status")).toHaveTextContent("UNRANKED");
    });
    expect(spy).toHaveBeenCalledTimes(1);

    cleanup();
    sessionStorage.clear();
    setSession("MERCHANT", 2);
    spy.mockClear();

    render(
      <AuthSessionProvider>
        <EnsureProbe slug="tra-sua-moc" />
      </AuthSessionProvider>,
    );
    expect(screen.getByTestId("ensure-status")).toHaveTextContent("idle");
    expect(spy).not.toHaveBeenCalled();
  });
});
