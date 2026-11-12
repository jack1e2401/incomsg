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
  MerchantLoyalty,
  MerchantOrders,
} from "../../../apps/frontend/src/features/merchant/BackendMerchantPages";

function renderMerchantPage(initialEntry: string, element: React.ReactNode) {
  const sessionData = JSON.stringify({
    accessToken: "merchant-jwt-token",
    user: { id: 2, email: "merchant@test.local", role: "MERCHANT", isActive: true },
  });
  sessionStorage.setItem("loyalty.m2.session", sessionData);
  sessionStorage.setItem("loyalty.auth.session", sessionData);

  return render(
    <AuthSessionProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/merchant/loyalty" element={element} />
          <Route path="/merchant/orders" element={element} />
        </Routes>
      </MemoryRouter>
    </AuthSessionProvider>,
  );
}

describe("M7 Merchant Experience", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders loyalty policy change warning and formula preview in MerchantLoyalty", async () => {
    const config = {
      merchantId: 7,
      vndPerPoint: 10000,
      isActive: true,
      tiers: [
        { level: "BRONZE", minLifetimePoints: 0, multiplier: "1.00" },
        { level: "SILVER", minLifetimePoints: 100, multiplier: "1.25" },
      ],
    };

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/merchant/loyalty") && (!init || init.method === "GET")) {
        return Response.json({ config });
      }
      if (url.includes("/api/merchant/loyalty/preview") && init?.method === "POST") {
        return Response.json({
          netOrderAmountVnd: "50000",
          tierLevel: "SILVER",
          multiplier: "1.25",
          vndPerPoint: 10000,
          active: true,
          estimatedPointsExact: "6.250000000000",
          integerProjection: 6,
          fractionalProjection: "0.250000000000",
          rounding: "HALF_UP",
          scale: 12,
        });
      }
      if (url.includes("/api/merchant/loyalty/transactions")) {
        return Response.json({ items: [], nextCursor: null });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMerchantPage("/merchant/loyalty", <MerchantLoyalty />);

    await waitFor(() => {
      expect(screen.getByText("Cấu hình Loyalty")).toBeInTheDocument();
      expect(screen.getByText(/lưu ý: thay đổi tỷ lệ hoặc hạng/i)).toBeInTheDocument();
    });

    // Check formula preview inputs
    const amountInput = screen.getByLabelText(/số tiền đơn hàng thử nghiệm/i);
    fireEvent.change(amountInput, { target: { value: "50000" } });

    const previewButton = screen.getByRole("button", { name: /tính thử điểm/i });
    fireEvent.click(previewButton);

    await waitFor(() => {
      expect(screen.getByText("6.250000000000")).toBeInTheDocument();
    });

    // Verify obsolete floor copy was removed and exact formula with fractional carry is shown
    expect(screen.queryByText(/làm tròn xuống/i)).not.toBeInTheDocument();
    expect(screen.getByText(/fractional carry/i)).toBeInTheDocument();
  });

  it("displays exact fractional earned points in MerchantOrders rather than rounding down to 0", async () => {
    const orders = [
      {
        id: 99,
        merchantId: 7,
        memberId: 9,
        memberEmail: "member@test.local",
        status: "PAID",
        subtotal: "6000",
        discountAmount: "0",
        total: "6000",
        paidAt: "2026-11-12T00:00:00.000Z",
        items: [{ productId: 1, productName: "Trà", unitPrice: "6000", quantity: 1, lineTotal: "6000" }],
        earnedPoints: 0,
        earnedPointsExact: "0.6",
      },
    ];

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/merchant/orders")) {
        return Response.json({ orders });
      }
      if (url.includes("/api/merchant/rewards")) {
        return Response.json({ rewards: [] });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });
    renderMerchantPage("/merchant/orders", <MerchantOrders />);

    await waitFor(() => {
      expect(screen.getByText("+0.6 điểm")).toBeInTheDocument();
      expect(screen.queryByText("+0 điểm")).not.toBeInTheDocument();
    });
  });

  it("handles merchant refund preview and reasoned refund submission in MerchantOrders", async () => {
    const orders = [
      {
        id: 77,
        merchantId: 7,
        memberId: 9,
        memberEmail: "member@test.local",
        status: "PAID",
        subtotal: "100000",
        discountAmount: "0",
        total: "100000",
        paidAt: "2026-11-10T10:00:00.000Z",
        items: [
          { productId: 1, productName: "Sản phẩm A", unitPrice: "100000", quantity: 1, lineTotal: "100000" },
        ],
        earnedPoints: 10,
        earnedPointsExact: "10.0",
        paymentStatus: "SUCCEEDED",
        refundStatus: null,
        actions: { canCancel: false, canRefund: true, requiresReconciliation: false },
      },
    ];

    const refundPreview = {
      orderId: 77,
      refundAmountVnd: "100000",
      refundStatus: null,
      earningReversalExact: "10.0",
      walletBefore: {
        exactBalance: "10.0",
        availablePoints: 10,
        fractionalCarry: "0.0",
        pointDebt: "0",
        netLifetimeEarned: "10.0",
        lifetimeEarnedPoints: 10,
        tier: "BRONZE",
      },
      walletAfter: {
        exactBalance: "0.0",
        availablePoints: 0,
        fractionalCarry: "0.0",
        pointDebt: "0",
        netLifetimeEarned: "0.0",
        lifetimeEarnedPoints: 0,
        tier: "BRONZE",
      },
      tierBefore: "BRONZE",
      tierAfter: "BRONZE",
      discountVoucherRestorable: false,
      providerConfirmationRequired: false,
    };

    const refundResult = {
      refund: {
        id: 99,
        status: "COMPLETED",
        amountVnd: "100000",
        reason: "Khách đổi trả sản phẩm lỗi",
        requestedById: 2,
        requestedAt: "2026-11-11T12:00:00.000Z",
        completedAt: "2026-11-11T12:00:00.000Z",
        providerReference: null,
      },
      order: {
        ...orders[0],
        status: "REFUNDED",
        refundStatus: "COMPLETED",
        actions: { canCancel: false, canRefund: false, requiresReconciliation: false },
      },
      walletImpact: {},
    };

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/merchant/orders/77/refund-preview")) {
        return Response.json(refundPreview);
      }
      if (url.includes("/api/merchant/orders/77/refund") && init?.method === "POST") {
        return Response.json(refundResult);
      }
      if (url.includes("/api/merchant/orders") && (!init || init.method === "GET")) {
        return Response.json({ orders });
      }
      if (url.includes("/api/merchant/rewards")) {
        return Response.json({ rewards: [] });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMerchantPage("/merchant/orders", <MerchantOrders />);

    await waitFor(() => {
      expect(screen.getByText("Đơn #77")).toBeInTheDocument();
      expect(screen.getByText("Đã thanh toán")).toBeInTheDocument();
    });

    const refundBtn = screen.getByRole("button", { name: /hoàn tiền/i });
    fireEvent.click(refundBtn);

    await waitFor(() => {
      expect(screen.getByText(/xem trước hoàn tiền đơn #77/i)).toBeInTheDocument();
      expect(screen.getByText("10.0")).toBeInTheDocument(); // Earning reversal exact
    });

    const reasonInput = screen.getByLabelText(/lý do hoàn tiền/i);
    fireEvent.change(reasonInput, { target: { value: "Khách đổi trả sản phẩm lỗi" } });

    const confirmRefundBtn = screen.getByRole("button", { name: /xác nhận hoàn tiền/i });
    fireEvent.click(confirmRefundBtn);

    await waitFor(() => {
      expect(screen.getByText("Đã hoàn tiền")).toBeInTheDocument();
    });
  });

  it("allows merchant to cancel unfulfilled reward voucher with reason", async () => {
    const rewards = [
      {
        id: 15,
        definitionId: 5,
        merchantId: 7,
        memberId: 9,
        title: "Bình giữ nhiệt",
        type: "REWARD",
        status: "AVAILABLE",
        pointsCost: 50,
        discountAmount: null,
        rewardDescription: "Bình giữ nhiệt 500ml",
        redeemedAt: "2026-11-10T10:00:00.000Z",
        usedAt: null,
      },
    ];

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/merchant/orders")) {
        return Response.json({ orders: [] });
      }
      if (url.includes("/api/merchant/rewards") && (!init || init.method === "GET")) {
        return Response.json({ rewards });
      }
      if (url.includes("/api/merchant/rewards/15/cancel") && init?.method === "POST") {
        return Response.json({
          reward: {
            ...rewards[0],
            status: "CANCELLED",
            cancelledAt: "2026-11-11T12:00:00.000Z",
            cancelledById: 2,
            cancellationReason: "Hết quà tặng trong kho",
          },
        });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMerchantPage("/merchant/orders", <MerchantOrders />);

    await waitFor(() => {
      expect(screen.getByText("Bình giữ nhiệt")).toBeInTheDocument();
      expect(screen.getByText("Chờ trao")).toBeInTheDocument();
    });

    const cancelRewardBtn = screen.getByRole("button", { name: /hủy quà/i });
    fireEvent.click(cancelRewardBtn);

    await waitFor(() => {
      expect(screen.getByText(/lý do hủy quà/i)).toBeInTheDocument();
    });

    const reasonInput = screen.getByLabelText(/lý do hủy quà/i);
    fireEvent.change(reasonInput, { target: { value: "Hết quà tặng trong kho" } });

    const confirmCancelBtn = screen.getByRole("button", { name: /xác nhận hủy quà/i });
    fireEvent.click(confirmCancelBtn);

    await waitFor(() => {
      expect(screen.getByText(/đã hủy trao “bình giữ nhiệt”/i)).toBeInTheDocument();
      expect(screen.getByText("Lý do: Hết quà tặng trong kho")).toBeInTheDocument();
      expect(screen.getByText("Người xử lý #2")).toBeInTheDocument();
    });
  });

  it("filters and displays loyalty transactions in MerchantLoyalty ledger tab", async () => {
    const config = {
      merchantId: 7,
      vndPerPoint: 10000,
      isActive: true,
      tiers: [{ level: "BRONZE", minLifetimePoints: 0, multiplier: "1.00" }],
    };

    const txItem = {
      id: 101,
      eventRef: "EVT-EARN-101",
      type: "EARN",
      delta: "0.800000000000",
      balanceAfter: "24.800000000000",
      availablePointsAfter: 24,
      fractionalCarryAfter: "0.800000000000",
      pointDebtAfter: "0",
      reason: "Tích điểm đơn hàng #77",
      source: "MOCK_PAYMENT",
      actorId: null,
      orderId: 77,
      memberVoucherId: null,
      createdAt: "2026-11-10T10:00:00.000Z",
      memberId: 9,
      memberEmail: "member@test.local",
    };
    const nextTxItem = {
      ...txItem,
      id: 102,
      eventRef: "EVT-EARN-102",
      delta: "1.000000000000",
      balanceAfter: "25.800000000000",
      availablePointsAfter: 25,
      fractionalCarryAfter: "0.800000000000",
      reason: "Tích điểm đơn hàng #78",
      orderId: 78,
    };

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/merchant/loyalty/transactions")) {
        return url.includes("cursor=next")
          ? Response.json({ items: [nextTxItem], nextCursor: null })
          : Response.json({ items: [txItem], nextCursor: "next" });
      }
      if (url.includes("/api/merchant/loyalty") && (!init || init.method === "GET")) {
        return Response.json({ config });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMerchantPage("/merchant/loyalty", <MerchantLoyalty />);

    await waitFor(() => {
      expect(screen.getByText("Cấu hình Loyalty")).toBeInTheDocument();
    });

    const ledgerTabBtn = screen.getByRole("button", { name: /lịch sử giao dịch điểm/i });
    fireEvent.click(ledgerTabBtn);

    await waitFor(() => {
      expect(screen.getByText("#101")).toBeInTheDocument();
      expect(screen.getByText("EVT-EARN-101")).toBeInTheDocument();
      expect(screen.getByText("Tích điểm đơn hàng #77")).toBeInTheDocument();
      expect(screen.getByText("+0.800000000000")).toBeInTheDocument();
      expect(screen.getByText(/điểm khả dụng sau gd: 24/i)).toBeInTheDocument();
      expect(screen.getByText(/phần dư sau gd: 0\.800000000000/i)).toBeInTheDocument();
      expect(screen.getByText(/nợ điểm sau gd: 0/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /xem thêm giao dịch/i }));

    await waitFor(() => {
      expect(screen.getByText("#101")).toBeInTheDocument();
      expect(screen.getByText("#102")).toBeInTheDocument();
      expect(screen.getByText("EVT-EARN-102")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /xem thêm giao dịch/i })).not.toBeInTheDocument();
    });

    // Test search filter inputs
    const memberIdInput = screen.getByLabelText(/id thành viên/i);
    fireEvent.change(memberIdInput, { target: { value: "9" } });

    const searchBtn = screen.getByRole("button", { name: /tìm kiếm/i });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(mockFetchHandler).toHaveBeenCalledWith(expect.stringContaining("memberId=9"), expect.anything());
    });
  });

  it("does not infer merchant refund permission when backend actions are missing", async () => {
    const orders = [
      {
        id: 79,
        merchantId: 7,
        memberId: 9,
        memberEmail: "member@test.local",
        status: "PAID",
        subtotal: "100000",
        discountAmount: "0",
        total: "100000",
        paidAt: "2026-11-10T10:00:00.000Z",
        items: [
          {
            productId: 1,
            productName: "Sản phẩm C",
            unitPrice: "100000",
            quantity: 1,
            lineTotal: "100000",
          },
        ],
        earnedPoints: 10,
        earnedPointsExact: "10",
      },
    ];
    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/merchant/orders")) return Response.json({ orders });
      if (url.includes("/api/merchant/rewards")) return Response.json({ rewards: [] });
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMerchantPage("/merchant/orders", <MerchantOrders />);

    await waitFor(() => expect(screen.getByText("Đơn #79")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /^hoàn tiền$/i })).not.toBeInTheDocument();
  });

  it("renders pending provider refund status for VNPay orders without inferring success", async () => {
    const orders = [
      {
        id: 88,
        merchantId: 7,
        memberId: 9,
        memberEmail: "member@test.local",
        status: "REFUND_PENDING",
        subtotal: "200000",
        discountAmount: "0",
        total: "200000",
        paidAt: "2026-11-10T10:00:00.000Z",
        items: [
          { productId: 1, productName: "Sản phẩm B", unitPrice: "200000", quantity: 1, lineTotal: "200000" },
        ],
        earnedPoints: 20,
        earnedPointsExact: "20.0",
        paymentStatus: "SUCCEEDED",
        refundStatus: "PENDING_PROVIDER",
        actions: { canCancel: false, canRefund: false, requiresReconciliation: false },
      },
    ];

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/merchant/orders") && (!init || init.method === "GET")) {
        return Response.json({ orders });
      }
      if (url.includes("/api/merchant/rewards")) {
        return Response.json({ rewards: [] });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMerchantPage("/merchant/orders", <MerchantOrders />);

    await waitFor(() => {
      expect(screen.getByText("Đơn #88")).toBeInTheDocument();
      expect(screen.getByText("Đang hoàn tiền")).toBeInTheDocument();
      expect(screen.getByText("Chờ cổng xác nhận hoàn tiền")).toBeInTheDocument();
      // Since actions.canRefund is false, refund button should not be rendered
      expect(screen.queryByRole("button", { name: /^hoàn tiền$/i })).not.toBeInTheDocument();
    });
  });

  it("fulfills a pending reward voucher with optional note", async () => {
    const rewards = [
      {
        id: 16,
        definitionId: 5,
        merchantId: 7,
        memberId: 9,
        title: "Áo thun kỷ niệm",
        type: "REWARD",
        status: "PENDING_FULFILLMENT",
        pointsCost: 30,
        discountAmount: null,
        rewardDescription: "Áo thun size L",
        redeemedAt: "2026-11-10T10:00:00.000Z",
        usedAt: null,
      },
    ];

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/merchant/orders")) {
        return Response.json({ orders: [] });
      }
      if (url.includes("/api/merchant/rewards/16/fulfill") && init?.method === "POST") {
        return Response.json({
          reward: {
            ...rewards[0],
            status: "FULFILLED",
            fulfilledAt: "2026-11-11T13:00:00.000Z",
            fulfilledById: 2,
            note: "Trao quà tại quầy",
          },
        });
      }
      if (url.includes("/api/merchant/rewards") && (!init || init.method === "GET")) {
        return Response.json({ rewards });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMerchantPage("/merchant/orders", <MerchantOrders />);

    await waitFor(() => {
      expect(screen.getByText("Áo thun kỷ niệm")).toBeInTheDocument();
      expect(screen.getByText("Chờ trao")).toBeInTheDocument();
    });

    const noteInput = screen.getByLabelText(/ghi chú trao quà/i);
    fireEvent.change(noteInput, { target: { value: "Trao quà tại quầy" } });

    const fulfillBtn = screen.getByRole("button", { name: /xác nhận đã trao/i });
    fireEvent.click(fulfillBtn);

    await waitFor(() => {
      expect(screen.getByText(/đã xác nhận trao “áo thun kỷ niệm”/i)).toBeInTheDocument();
      expect(screen.getByText("Người xác nhận #2")).toBeInTheDocument();
      expect(screen.getByText("Ghi chú: Trao quà tại quầy")).toBeInTheDocument();
    });
  });

  it("shows the exact wallet debt and tier projected by a refund preview", async () => {
    const orders = [
      {
        id: 99,
        merchantId: 7,
        memberId: 9,
        memberEmail: "member@test.local",
        status: "PAID",
        subtotal: "6000",
        discountAmount: "0",
        total: "6000",
        paidAt: "2026-11-11T10:00:00.000Z",
        items: [{ productId: 1, productName: "Cà phê", unitPrice: "6000", quantity: 1, lineTotal: "6000" }],
        earnedPoints: 0,
        earnedPointsExact: "0.6",
        paymentStatus: null,
        refundStatus: null,
        actions: { canCancel: false, canRefund: true, requiresReconciliation: false },
      },
    ];
    const refundPreview = {
      orderId: 99,
      refundAmountVnd: "6000",
      refundStatus: null,
      earningReversalExact: "0.6",
      walletBefore: {
        exactBalance: "0.2",
        availablePoints: 0,
        fractionalCarry: "0.2",
        pointDebt: "0",
        netLifetimeEarned: "1.2",
        lifetimeEarnedPoints: 1,
        tier: "SILVER",
      },
      walletAfter: {
        exactBalance: "-0.4",
        availablePoints: 0,
        fractionalCarry: "0",
        pointDebt: "0.4",
        netLifetimeEarned: "0.6",
        lifetimeEarnedPoints: 0,
        tier: "BRONZE",
      },
      tierBefore: "SILVER",
      tierAfter: "BRONZE",
      discountVoucherRestorable: false,
      providerConfirmationRequired: true,
    };

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/merchant/orders/99/refund-preview")) return Response.json(refundPreview);
      if (url.includes("/api/merchant/orders") && (!init || init.method === "GET"))
        return Response.json({ orders });
      if (url.includes("/api/merchant/rewards")) return Response.json({ rewards: [] });
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMerchantPage("/merchant/orders", <MerchantOrders />);

    await waitFor(() => expect(screen.getByText("Đơn #99")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /^hoàn tiền$/i }));

    await waitFor(() => {
      expect(screen.getByText(/điểm nợ sau hoàn/i)).toBeInTheDocument();
      expect(screen.getByText("0.4")).toBeInTheDocument();
      expect(screen.getByText("SILVER → BRONZE")).toBeInTheDocument();
    });
  });

  it("reports a provider refund as pending until the backend confirms completion", async () => {
    const paidOrder = {
      id: 88,
      merchantId: 7,
      memberId: 9,
      memberEmail: "member@test.local",
      status: "PAID",
      subtotal: "200000",
      discountAmount: "0",
      total: "200000",
      paidAt: "2026-11-11T10:00:00.000Z",
      items: [
        { productId: 1, productName: "Sản phẩm B", unitPrice: "200000", quantity: 1, lineTotal: "200000" },
      ],
      earnedPoints: 20,
      earnedPointsExact: "20",
      paymentStatus: "SUCCEEDED",
      refundStatus: null,
      actions: { canCancel: false, canRefund: true, requiresReconciliation: false },
    };
    const pendingOrder = {
      ...paidOrder,
      status: "REFUND_PENDING",
      refundStatus: "PENDING_PROVIDER",
      actions: { canCancel: false, canRefund: false, requiresReconciliation: false },
    };
    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/merchant/orders/88/refund-preview")) {
        return Response.json({
          orderId: 88,
          refundAmountVnd: "200000",
          refundStatus: null,
          earningReversalExact: "20",
          walletBefore: { availablePoints: 20, fractionalCarry: "0", pointDebt: "0" },
          walletAfter: { availablePoints: 0, fractionalCarry: "0", pointDebt: "0" },
          tierBefore: "BRONZE",
          tierAfter: "UNRANKED",
          discountVoucherRestorable: false,
          providerConfirmationRequired: true,
        });
      }
      if (url.includes("/api/merchant/orders/88/refund") && init?.method === "POST") {
        return Response.json({
          refund: {
            id: 99,
            status: "PENDING_PROVIDER",
            amountVnd: "200000",
            reason: "Khách yêu cầu hoàn tiền",
            requestedById: 2,
            requestedAt: "2026-11-11T12:00:00.000Z",
            completedAt: null,
            providerReference: null,
          },
          order: pendingOrder,
          walletImpact: null,
        });
      }
      if (url.includes("/api/merchant/orders") && (!init || init.method === "GET")) {
        return Response.json({ orders: [paidOrder] });
      }
      if (url.includes("/api/merchant/rewards")) return Response.json({ rewards: [] });
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMerchantPage("/merchant/orders", <MerchantOrders />);
    await waitFor(() => expect(screen.getByText("Đơn #88")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /^hoàn tiền$/i }));
    fireEvent.change(await screen.findByLabelText(/lý do hoàn tiền/i), {
      target: { value: "Khách yêu cầu hoàn tiền" },
    });
    fireEvent.click(screen.getByRole("button", { name: /xác nhận hoàn tiền/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Yêu cầu hoàn tiền đang chờ cổng thanh toán xác nhận.",
      );
      expect(screen.getByText("Chờ cổng xác nhận hoàn tiền")).toBeInTheDocument();
      expect(screen.queryByText(/^Đã hoàn tiền$/i)).not.toBeInTheDocument();
    });
  });
});
