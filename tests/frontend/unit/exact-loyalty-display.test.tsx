// @vitest-environment jsdom
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

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { AuthSessionProvider } from "../../../apps/frontend/src/api/auth-session";
import {
  MemberOrderResult,
  MemberWallet,
} from "../../../apps/frontend/src/features/member/BackendMemberPages";
import type { OrderDto, WalletDto } from "../../../apps/frontend/src/api/commerce-types";

function MemberContextLayout({ merchantId }: { merchantId: number }) {
  return (
    <Outlet
      context={{
        merchantId,
        cart: { items: [], totalCount: 0, add: vi.fn(), remove: vi.fn(), clear: vi.fn() },
      }}
    />
  );
}

function renderWithProviders(initialEntry: string, element: React.ReactNode) {
  sessionStorage.setItem(
    "loyalty.auth.session",
    JSON.stringify({
      accessToken: "member-jwt-token",
      user: { id: 9, email: "member@test.local", role: "MEMBER", isActive: true },
    }),
  );

  return render(
    <AuthSessionProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/member/:merchantId" element={<MemberContextLayout merchantId={7} />}>
            <Route path="wallet" element={element} />
            <Route path="orders/:orderId" element={element} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthSessionProvider>,
  );
}

describe("MemberWallet and MemberOrderResult exact points display", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders exact fractional carry, net lifetime, and positive debt on MemberWallet", async () => {
    const realWalletDto: WalletDto = {
      merchantId: 7,
      exactBalance: "1.2",
      availablePoints: 1,
      fractionalCarry: "0.2",
      pointDebt: "0",
      netLifetimeEarned: "1.2",
      lifetimeEarnedPoints: 1,
      tier: "BRONZE",
      policy: {
        merchantId: 7,
        vndPerPoint: 10000,
        isActive: true,
        tiers: [{ level: "BRONZE", minLifetimePoints: 0, multiplier: "1.00" }],
      },
      transactions: [
        {
          id: 101,
          type: "EARN",
          delta: "0.6",
          balanceAfter: "1.2",
          availablePointsAfter: 1,
          fractionalCarryAfter: "0.2",
          pointDebtAfter: "0",
          reason: "Tích điểm đơn hàng #41",
          orderId: 41,
          memberVoucherId: null,
          createdAt: "2026-11-11T10:00:00.000Z",
        },
        {
          id: 100,
          type: "EARN",
          delta: "0.6",
          balanceAfter: "0.6",
          availablePointsAfter: 0,
          fractionalCarryAfter: "0.6",
          pointDebtAfter: "0",
          reason: "Tích điểm đơn hàng #40",
          orderId: 40,
          memberVoucherId: null,
          createdAt: "2026-11-11T09:00:00.000Z",
        },
      ],
    };

    mockFetchHandler = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/member/merchants/7/wallet")) {
        return new Response(JSON.stringify({ wallet: realWalletDto }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not found", { status: 404 });
    };

    renderWithProviders("/member/7/wallet", <MemberWallet />);

    // Available integer points
    await waitFor(() => {
      expect(screen.getByText("1")).toBeDefined();
    });

    // Exact carry display
    expect(screen.getByText("0.2")).toBeDefined();
    expect(screen.getByText(/Phần lẻ:/)).toBeDefined();

    // Debt is zero, should not show debt alert
    expect(screen.queryByText(/Nợ điểm:/)).toBeNull();

    // Net lifetime exact points
    expect(screen.getByText("1.2")).toBeDefined();

    // Ledger exact deltas and balances
    const deltas = screen.getAllByText("+0.6");
    expect(deltas.length).toBe(2);

    expect(screen.getByText("Số dư 1.2")).toBeDefined();
    expect(screen.getByText("Số dư 0.6")).toBeDefined();

    // Ledger order links
    const orderLink41 = screen.getByRole("link", { name: "Đơn hàng #41" });
    expect(orderLink41.getAttribute("href")).toBe("/member/7/orders/41");

    const orderLink40 = screen.getByRole("link", { name: "Đơn hàng #40" });
    expect(orderLink40.getAttribute("href")).toBe("/member/7/orders/40");
  });

  it("shows point debt when positive and renders voucher links in ledger", async () => {
    const debtWalletDto: WalletDto = {
      merchantId: 7,
      exactBalance: "-0.5",
      availablePoints: 0,
      fractionalCarry: "0",
      pointDebt: "0.5",
      netLifetimeEarned: "2",
      lifetimeEarnedPoints: 2,
      tier: "BRONZE",
      transactions: [
        {
          id: 102,
          type: "REDEEM_DISCOUNT",
          delta: "-1",
          balanceAfter: "-0.5",
          availablePointsAfter: 0,
          fractionalCarryAfter: "0",
          pointDebtAfter: "0.5",
          reason: "Đổi ưu đãi giảm giá",
          orderId: null,
          memberVoucherId: 18,
          createdAt: "2026-11-11T11:00:00.000Z",
        },
      ],
    };

    mockFetchHandler = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/member/merchants/7/wallet")) {
        return new Response(JSON.stringify({ wallet: debtWalletDto }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not found", { status: 404 });
    };

    renderWithProviders("/member/7/wallet", <MemberWallet />);

    await waitFor(() => {
      expect(screen.getByText(/Nợ điểm:/)).toBeDefined();
    });
    expect(screen.getByText("0.5")).toBeDefined();

    // Ledger negative delta and voucher link
    expect(screen.getByText("-1")).toBeDefined();
    expect(screen.getByText("Số dư -0.5")).toBeDefined();

    const voucherLink = screen.getByRole("link", { name: "Voucher #18" });
    expect(voucherLink.getAttribute("href")).toBe("/member/7/vouchers");
  });

  it("displays exact confirmed points on paid order detail without client math", async () => {
    const paidOrderDto: OrderDto = {
      id: 55,
      merchantId: 7,
      memberId: 9,
      status: "PAID",
      subtotal: "6000",
      discountAmount: "0",
      total: "6000",
      paidAt: "2026-11-11T12:00:00.000Z",
      items: [
        {
          productId: 1,
          productName: "Cà phê sữa",
          unitPrice: "6000",
          quantity: 1,
          lineTotal: "6000",
        },
      ],
      earnedPoints: 0,
      earnedPointsExact: "0.6",
    };

    mockFetchHandler = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/member/orders/55")) {
        return new Response(JSON.stringify({ order: paidOrderDto }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not found", { status: 404 });
    };

    renderWithProviders("/member/7/orders/55", <MemberOrderResult />);

    await waitFor(() => {
      expect(screen.getByText("Thanh toán đã được máy chủ xác nhận.")).toBeDefined();
    });
    expect(screen.getByText("Bạn vừa nhận +0.6 điểm")).toBeDefined();
  });

  it("displays zero points message when exact earned points is 0", async () => {
    const zeroOrderDto: OrderDto = {
      id: 56,
      merchantId: 7,
      memberId: 9,
      status: "PAID",
      subtotal: "0",
      discountAmount: "0",
      total: "0",
      paidAt: "2026-11-11T12:00:00.000Z",
      items: [],
      earnedPoints: 0,
      earnedPointsExact: "0",
    };

    mockFetchHandler = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/member/orders/56")) {
        return new Response(JSON.stringify({ order: zeroOrderDto }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not found", { status: 404 });
    };

    renderWithProviders("/member/7/orders/56", <MemberOrderResult />);

    await waitFor(() => {
      expect(screen.getByText("Đơn này không phát sinh điểm.")).toBeDefined();
    });
  });

  it("does not compute or preview earned points on pending orders", async () => {
    const pendingOrderDto: OrderDto = {
      id: 57,
      merchantId: 7,
      memberId: 9,
      status: "PENDING",
      subtotal: "120000",
      discountAmount: "0",
      total: "120000",
      paidAt: null,
      items: [
        {
          productId: 2,
          productName: "Bình giữ nhiệt",
          unitPrice: "120000",
          quantity: 1,
          lineTotal: "120000",
        },
      ],
      earnedPoints: null,
      earnedPointsExact: null,
    };

    mockFetchHandler = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/member/orders/57")) {
        return new Response(JSON.stringify({ order: pendingOrderDto }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not found", { status: 404 });
    };

    renderWithProviders("/member/7/orders/57", <MemberOrderResult />);

    await waitFor(() => {
      expect(screen.getByText("Chờ thanh toán")).toBeDefined();
    });

    expect(screen.queryByText(/Bạn vừa nhận/)).toBeNull();
    expect(screen.getByText(/Điểm được cập nhật sau khi máy chủ xác nhận thanh toán/)).toBeDefined();
  });
});
