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
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { AuthSessionProvider } from "../../../apps/frontend/src/api/auth-session";
import {
  MemberOrderResult,
  MemberCheckout,
  MemberVouchers,
  MemberOrders,
  MemberWallet,
} from "../../../apps/frontend/src/features/member/BackendMemberPages";
import type { OrderDto } from "../../../apps/frontend/src/api/commerce-types";

function MemberContextLayout({ merchantId, cartLines = [] }: { merchantId: number; cartLines?: any[] }) {
  return (
    <Outlet
      context={{
        merchantId,
        cart: {
          lines: cartLines,
          subtotal: cartLines.reduce((acc, l) => acc + BigInt(l.product.price) * BigInt(l.quantity), 0n),
          quantity: cartLines.reduce((acc, l) => acc + l.quantity, 0),
          clear: vi.fn(),
          removeProduct: vi.fn(),
          setQuantity: vi.fn(),
        },
      }}
    />
  );
}

function renderMemberPage(initialEntry: string, element: React.ReactNode, cartLines: any[] = []) {
  const sessionData = JSON.stringify({
    accessToken: "member-jwt-token",
    user: { id: 9, email: "member@test.local", role: "MEMBER", isActive: true },
  });
  sessionStorage.setItem("loyalty.m2.session", sessionData);
  sessionStorage.setItem("loyalty.auth.session", sessionData);

  return render(
    <AuthSessionProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="/member/:merchantId"
            element={<MemberContextLayout merchantId={7} cartLines={cartLines} />}
          >
            <Route path="wallet" element={element} />
            <Route path="orders" element={element} />
            <Route path="orders/:orderId" element={element} />
            <Route path="checkout" element={element} />
            <Route path="vouchers" element={element} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthSessionProvider>,
  );
}

describe("M6 Member Experience", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("renders order cancellation flow when backend allows canCancel", async () => {
    const pendingOrder: OrderDto = {
      id: 42,
      merchantId: 7,
      memberId: 9,
      status: "PENDING",
      subtotal: "30000",
      discountAmount: "0",
      total: "30000",
      paidAt: null,
      items: [
        { productId: 1, productName: "Cà phê sữa", unitPrice: "30000", quantity: 1, lineTotal: "30000" },
      ],
      earnedPointsExact: null,
      paymentStatus: null,
      refundStatus: null,
      actions: { canCancel: true, canRefund: false, requiresReconciliation: false },
    };

    const cancelledOrder: OrderDto = {
      ...pendingOrder,
      status: "CANCELLED",
      actions: { canCancel: false, canRefund: false, requiresReconciliation: false },
    };

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/member/orders/42") && (!init || init.method === "GET")) {
        return Response.json({ order: pendingOrder });
      }
      if (url.includes("/api/orders/42/cancel") && init?.method === "POST") {
        return Response.json({ order: cancelledOrder, voucherReleased: false, capacityReleasedExact: "0" });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMemberPage("/member/7/orders/42", <MemberOrderResult />);

    await waitFor(() => {
      expect(screen.getByText("Đơn #42")).toBeInTheDocument();
      expect(screen.getByText("Chờ thanh toán")).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole("button", { name: /hủy đơn/i });
    expect(cancelButton).toBeInTheDocument();

    fireEvent.click(cancelButton);

    // Confirmation dialog
    const confirmButton = await screen.findByRole("button", { name: /xác nhận hủy/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText("Đã hủy")).toBeInTheDocument();
    });
  });

  it("does not render cancel button when order.actions is missing or canCancel is false even if status is PENDING", async () => {
    const pendingOrderNoActions: OrderDto = {
      id: 43,
      merchantId: 7,
      memberId: 9,
      status: "PENDING",
      subtotal: "30000",
      discountAmount: "0",
      total: "30000",
      paidAt: null,
      items: [
        { productId: 1, productName: "Cà phê sữa", unitPrice: "30000", quantity: 1, lineTotal: "30000" },
      ],
      earnedPointsExact: null,
      paymentStatus: null,
      refundStatus: null,
      // actions omitted
    };

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/member/orders/43")) {
        return Response.json({ order: pendingOrderNoActions });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMemberPage("/member/7/orders/43", <MemberOrderResult />);

    await waitFor(() => {
      expect(screen.getByText("Đơn #43")).toBeInTheDocument();
      expect(screen.getByText("Chờ thanh toán")).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: /hủy đơn/i })).not.toBeInTheDocument();
  });

  it("renders loyalty events audit including EARN_REVERSAL on MemberOrderResult", async () => {
    const refundedOrder: OrderDto = {
      id: 55,
      merchantId: 7,
      memberId: 9,
      status: "REFUNDED",
      subtotal: "50000",
      discountAmount: "0",
      total: "50000",
      paidAt: "2026-11-10T10:00:00.000Z",
      items: [{ productId: 1, productName: "Bình gốm", unitPrice: "50000", quantity: 1, lineTotal: "50000" }],
      earnedPointsExact: "5.0",
      refundStatus: "COMPLETED",
      loyaltyEvents: [
        {
          id: 1,
          eventRef: "evt_earn_55",
          type: "EARN",
          delta: "5.0",
          balanceAfter: "5.0",
          availablePointsAfter: 5,
          fractionalCarryAfter: "0.0",
          pointDebtAfter: "0",
          orderId: 55,
          memberVoucherId: null,
          reason: "Tích điểm đơn hàng #55",
          source: "MOCK_PAYMENT",
          actorId: null,
          createdAt: "2026-11-10T10:00:00.000Z",
        },
        {
          id: 2,
          eventRef: "evt_rev_55",
          type: "EARN_REVERSAL",
          delta: "-5.0",
          balanceAfter: "0.0",
          availablePointsAfter: 0,
          fractionalCarryAfter: "0.0",
          pointDebtAfter: "0",
          orderId: 55,
          memberVoucherId: null,
          reason: "Thu hồi tích điểm do hoàn tiền đơn hàng #55",
          source: "MERCHANT_REFUND",
          actorId: 2,
          createdAt: "2026-11-11T09:00:00.000Z",
        },
      ],
      actions: { canCancel: false, canRefund: false, requiresReconciliation: false },
    };

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/member/orders/55")) {
        return Response.json({ order: refundedOrder });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMemberPage("/member/7/orders/55", <MemberOrderResult />);

    await waitFor(() => {
      expect(screen.getByText("Đơn #55")).toBeInTheDocument();
      expect(screen.getByText("Đã hoàn tiền")).toBeInTheDocument();
      expect(screen.getByText("Tích điểm đơn hàng #55")).toBeInTheDocument();
      expect(screen.getByText("Thu hồi tích điểm do hoàn tiền đơn hàng #55")).toBeInTheDocument();
      expect(screen.getByText("-5.0")).toBeInTheDocument();
    });
  });

  it("displays earning preview in checkout using stable preview calls without re-fetching on stable net amount", async () => {
    const cartLines = [
      {
        product: { id: 10, name: "Cà phê phin", price: "40000", kind: "SALE", status: "ACTIVE" },
        quantity: 2,
      },
    ];

    let previewCalls = 0;
    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/member/merchants/7/vouchers")) {
        return Response.json({ vouchers: [] });
      }
      if (url.includes("/api/member/merchants/7/loyalty/preview") && init?.method === "POST") {
        previewCalls++;
        return Response.json({
          merchantId: 7,
          active: true,
          netOrderAmountVnd: "80000",
          tierLevel: "BRONZE",
          multiplier: "1.00",
          vndPerPoint: 10000,
          estimatedPointsExact: "8.0",
        });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMemberPage("/member/7/checkout", <MemberCheckout />, cartLines);

    await waitFor(() => {
      expect(screen.getByText(/ước tính tích lũy/i)).toBeInTheDocument();
      expect(screen.getByText(/\+8\.0 điểm/i)).toBeInTheDocument();
    });

    expect(previewCalls).toBe(1);
  });

  it("generates an idempotency key per redemption action and retains it across retries until success", async () => {
    const definitions = [
      {
        id: 5,
        merchantId: 7,
        type: "DISCOUNT" as const,
        title: "Giảm 20k",
        pointsCost: 50,
        discountAmount: "20000",
        rewardDescription: null,
        rewardProductId: null,
        status: "ACTIVE" as const,
      },
    ];
    const initialWallet = {
      merchantId: 7,
      exactBalance: "200",
      availablePoints: 200,
      fractionalCarry: "0",
      pointDebt: "0",
      netLifetimeEarned: "200",
      lifetimeEarnedPoints: 200,
      tier: "BRONZE" as const,
      policy: { merchantId: 7, vndPerPoint: 10000, isActive: true, tiers: [] },
      transactions: [],
    };
    const updatedWallet = {
      ...initialWallet,
      exactBalance: "150",
      availablePoints: 150,
      lifetimeEarnedPoints: 200,
    };
    const redeemedVoucher = {
      id: 101,
      definitionId: 5,
      merchantId: 7,
      memberId: 9,
      title: "Giảm 20k",
      type: "DISCOUNT" as const,
      status: "ACTIVE" as const,
      pointsCost: 50,
      discountAmount: "20000",
      rewardDescription: null,
      redeemedAt: "2026-11-11T12:00:00.000Z",
      usedAt: null,
    };

    const idempotencyKeysUsed: (string | null)[] = [];
    let attempt = 0;

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/merchants/7/vouchers")) {
        return Response.json({ definitions });
      }
      if (url.includes("/api/member/merchants/7/vouchers")) {
        return Response.json({ vouchers: [] });
      }
      if (url.includes("/api/member/merchants/7/wallet")) {
        return Response.json({ wallet: attempt > 1 ? updatedWallet : initialWallet });
      }
      if (url.includes("/api/member/vouchers/5/redeem") && init?.method === "POST") {
        attempt++;
        const headers = new Headers(init.headers);
        idempotencyKeysUsed.push(headers.get("Idempotency-Key"));
        if (attempt === 1) {
          return Response.json({ error: "Temporary network timeout" }, { status: 500 });
        }
        return Response.json({
          voucher: { ...redeemedVoucher, id: 100 + attempt },
          wallet: { availablePoints: 150, lifetimeEarnedPoints: 200 },
        });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMemberPage("/member/7/vouchers", <MemberVouchers />);

    // Wait for catalog and wallet to load
    await waitFor(() => {
      expect(screen.getByText("Giảm 20k")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /đổi voucher/i })).toBeInTheDocument();
    });

    const redeemButton = screen.getByRole("button", { name: /đổi voucher/i });

    // First attempt: fails with 500
    fireEvent.click(redeemButton);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(idempotencyKeysUsed).toHaveLength(1);
    const firstKey = idempotencyKeysUsed[0];
    expect(firstKey).toBeTruthy();

    // Retry attempt: should retain the exact same idempotency key
    fireEvent.click(redeemButton);

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(screen.getByText(/đã đổi “giảm 20k”/i)).toBeInTheDocument();
    });

    expect(idempotencyKeysUsed).toHaveLength(2);
    expect(idempotencyKeysUsed[1]).toBe(firstKey);

    // Subsequent redemption action on the same definition after success: should generate a new key
    fireEvent.click(redeemButton);

    await waitFor(() => {
      expect(idempotencyKeysUsed).toHaveLength(3);
    });

    expect(idempotencyKeysUsed[2]).toBeTruthy();
    expect(idempotencyKeysUsed[2]).not.toBe(firstKey);
  });

  it("renders empty state with an actionable shopping link when member has no orders", async () => {
    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/member/orders") && url.includes("merchantId=7")) {
        return Response.json({ orders: [] });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMemberPage("/member/7/orders", <MemberOrders />);

    await waitFor(() => {
      expect(screen.getByText("Chưa có đơn hàng")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /mua sắm ngay/i })).toHaveAttribute("href", "/member/7");
    });
  });

  it("renders actionable empty state when order does not belong to the current merchant", async () => {
    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/member/orders/99")) {
        return Response.json({
          order: {
            id: 99,
            merchantId: 99,
            memberId: 9,
            status: "PAID",
            subtotal: "50000",
            discountAmount: "0",
            total: "50000",
            paidAt: "2026-11-10T10:00:00.000Z",
            items: [],
            earnedPointsExact: "5",
          },
        });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMemberPage("/member/7/orders/99", <MemberOrderResult />);

    await waitFor(() => {
      expect(screen.getByText("Chưa khả dụng")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /xem danh sách đơn hàng/i })).toHaveAttribute(
        "href",
        "/member/7/orders",
      );
    });
  });

  it("displays accessible voucher redeem button with distinct aria-label and disabled note when points are insufficient", async () => {
    const definitions = [
      {
        id: 8,
        merchantId: 7,
        type: "DISCOUNT" as const,
        title: "Giảm 50k",
        pointsCost: 500,
        discountAmount: "50000",
        rewardDescription: null,
        rewardProductId: null,
        status: "ACTIVE" as const,
      },
    ];
    const lowBalanceWallet = {
      merchantId: 7,
      exactBalance: "50",
      availablePoints: 50,
      fractionalCarry: "0",
      pointDebt: "0",
      netLifetimeEarned: "50",
      lifetimeEarnedPoints: 50,
      tier: "BRONZE" as const,
      policy: { merchantId: 7, vndPerPoint: 10000, isActive: true, tiers: [] },
      transactions: [],
    };

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/merchants/7/vouchers")) {
        return Response.json({ definitions });
      }
      if (url.includes("/api/member/merchants/7/vouchers")) {
        return Response.json({ vouchers: [] });
      }
      if (url.includes("/api/member/merchants/7/wallet")) {
        return Response.json({ wallet: lowBalanceWallet });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMemberPage("/member/7/vouchers", <MemberVouchers />);

    await waitFor(() => {
      expect(screen.getByText("Giảm 50k")).toBeInTheDocument();
      const button = screen.getByRole("button", { name: /đổi voucher “giảm 50k”/i });
      expect(button).toBeDisabled();
      expect(screen.getByText("Chưa đủ điểm để đổi")).toBeInTheDocument();
    });
  });

  it("uses mock payment despite VNPay configuration and confirms from the backend order response", async () => {
    vi.stubEnv("VITE_PAYMENT_MODE", "vnpay");
    const pendingOrder: OrderDto = {
      id: 88,
      merchantId: 7,
      memberId: 9,
      status: "PENDING",
      subtotal: "40000",
      discountAmount: "0",
      total: "40000",
      paidAt: null,
      items: [{ productId: 2, productName: "Trà đào", unitPrice: "40000", quantity: 1, lineTotal: "40000" }],
      earnedPointsExact: null,
      paymentStatus: null,
      refundStatus: null,
      actions: { canCancel: false, canRefund: false, requiresReconciliation: false },
    };

    const paidOrder: OrderDto = {
      ...pendingOrder,
      status: "PAID",
      paidAt: "2026-11-10T10:00:00.000Z",
      earnedPointsExact: "3.5",
    };
    const requests: Array<{ url: string; method: string }> = [];
    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      requests.push({ url, method });
      if (url.includes("/api/member/orders/88") && method === "GET") {
        return Response.json({ order: pendingOrder });
      }
      if (url.includes("/api/orders/88/pay") && method === "POST") {
        return Response.json({ order: paidOrder });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMemberPage("/member/7/orders/88", <MemberOrderResult />);

    await waitFor(() => {
      expect(screen.getByText("Đơn #88")).toBeInTheDocument();
    });

    const mockPayButton = screen.getByRole("button", { name: /thanh toán \(mô phỏng\)/i });
    expect(mockPayButton).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /vnpay/i })).not.toBeInTheDocument();

    fireEvent.click(mockPayButton);

    await waitFor(() => {
      expect(screen.getByText("Thanh toán đã được máy chủ xác nhận.")).toBeInTheDocument();
      expect(screen.getByText("Bạn vừa nhận +3.5 điểm")).toBeInTheDocument();
    });
    expect(requests.some(({ url }) => url.includes("/payment-status") || url.includes("/payments/vnpay"))).toBe(false);
    expect(requests).toContainEqual(expect.objectContaining({ url: expect.stringContaining("/api/orders/88/pay"), method: "POST" }));
  });

  it("renders actionable empty state linking to storefront when MemberWallet has no transactions", async () => {
    const emptyWallet = {
      merchantId: 7,
      exactBalance: "0",
      availablePoints: 0,
      fractionalCarry: "0",
      pointDebt: "0",
      netLifetimeEarned: "0",
      lifetimeEarnedPoints: 0,
      tier: "UNRANKED" as const,
      policy: null,
      transactions: [],
    };

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/member/merchants/7/wallet")) {
        return Response.json({ wallet: emptyWallet });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMemberPage("/member/7/wallet", <MemberWallet />);

    await waitFor(() => {
      expect(screen.getByText("Chưa có giao dịch điểm")).toBeInTheDocument();
      const shopLink = screen.getByRole("link", { name: /khám phá gian hàng/i });
      expect(shopLink).toBeInTheDocument();
      expect(shopLink).toHaveAttribute("href", "/member/7");
    });
  });

  it("renders actionable empty state linking to catalog when member has no owned vouchers", async () => {
    const definitions = [
      {
        id: 12,
        merchantId: 7,
        type: "DISCOUNT" as const,
        title: "Giảm 15k",
        pointsCost: 30,
        discountAmount: "15000",
        rewardDescription: null,
        rewardProductId: null,
        status: "ACTIVE" as const,
      },
    ];
    const testWallet = {
      merchantId: 7,
      exactBalance: "100",
      availablePoints: 100,
      fractionalCarry: "0",
      pointDebt: "0",
      netLifetimeEarned: "100",
      lifetimeEarnedPoints: 100,
      tier: "BRONZE" as const,
      policy: null,
      transactions: [],
    };

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/merchants/7/vouchers")) {
        return Response.json({ definitions });
      }
      if (url.includes("/api/member/merchants/7/vouchers")) {
        return Response.json({ vouchers: [] });
      }
      if (url.includes("/api/member/merchants/7/wallet")) {
        return Response.json({ wallet: testWallet });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMemberPage("/member/7/vouchers", <MemberVouchers />);

    await waitFor(() => {
      expect(screen.getByText("Bạn chưa có voucher")).toBeInTheDocument();
      const actionLink = screen.getByRole("link", { name: /xem voucher có thể đổi/i });
      expect(actionLink).toBeInTheDocument();
      expect(actionLink).toHaveAttribute("href", "#store-vouchers");
    });
  });

  it("renders accessible next action buttons for viewing wallet on REFUND_PENDING orders", async () => {
    const refundPendingOrder: OrderDto = {
      id: 60,
      merchantId: 7,
      memberId: 9,
      status: "REFUND_PENDING",
      subtotal: "35000",
      discountAmount: "0",
      total: "35000",
      paidAt: "2026-11-10T08:00:00.000Z",
      items: [
        { productId: 3, productName: "Nước ép cam", unitPrice: "35000", quantity: 1, lineTotal: "35000" },
      ],
      earnedPointsExact: "3.5",
      refundStatus: "PENDING_PROVIDER",
      actions: { canCancel: false, canRefund: false, requiresReconciliation: false },
    };

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/member/orders/60")) {
        return Response.json({ order: refundPendingOrder });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMemberPage("/member/7/orders/60", <MemberOrderResult />);

    await waitFor(() => {
      expect(screen.getByText("Đơn #60")).toBeInTheDocument();
      expect(screen.getByText("Đang xử lý hoàn tiền")).toBeInTheDocument();
      const walletLink = screen.getByRole("link", { name: /xem ví điểm/i });
      expect(walletLink).toHaveAttribute("href", "/member/7/wallet");
    });
  });

  it("renders distinct accessible aria-labels on order detail links in MemberOrders", async () => {
    const orderList: OrderDto[] = [
      {
        id: 101,
        merchantId: 7,
        memberId: 9,
        status: "PAID",
        subtotal: "50000",
        discountAmount: "0",
        total: "50000",
        paidAt: "2026-11-10T08:00:00.000Z",
        items: [
          { productId: 1, productName: "Bánh mì", unitPrice: "50000", quantity: 1, lineTotal: "50000" },
        ],
        earnedPointsExact: "5",
        refundStatus: null,
        actions: { canCancel: false, canRefund: false, requiresReconciliation: false },
      },
      {
        id: 102,
        merchantId: 7,
        memberId: 9,
        status: "PENDING",
        subtotal: "30000",
        discountAmount: "0",
        total: "30000",
        paidAt: null,
        items: [{ productId: 2, productName: "Cà phê", unitPrice: "30000", quantity: 1, lineTotal: "30000" }],
        earnedPointsExact: null,
        refundStatus: null,
        actions: { canCancel: false, canRefund: false, requiresReconciliation: false },
      },
    ];

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/member/orders") && url.includes("merchantId=7")) {
        return Response.json({ orders: orderList });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMemberPage("/member/7/orders", <MemberOrders />);

    await waitFor(() => {
      expect(screen.getByText("Đơn #101")).toBeInTheDocument();
      expect(screen.getByText("Đơn #102")).toBeInTheDocument();
    });

    const link101 = screen.getByRole("link", { name: "Chi tiết đơn hàng #101" });
    const link102 = screen.getByRole("link", { name: "Chi tiết đơn hàng #102" });
    expect(link101).toHaveAttribute("href", "/member/7/orders/101");
    expect(link102).toHaveAttribute("href", "/member/7/orders/102");
  });
});
