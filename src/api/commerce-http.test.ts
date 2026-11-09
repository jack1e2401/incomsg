import { describe, expect, it, vi } from "vitest";
import { createCommerceClient } from "./commerce-http";

describe("commerce HTTP contract", () => {
  it("creates a single-product pending order with Bearer auth and keeps response status", async () => {
    const backendOrder = {
      id: 41,
      merchantId: 7,
      memberId: 9,
      status: "PENDING",
      subtotal: "45000",
      discountAmount: "0",
      total: "45000",
      paidAt: null,
      items: [{ productId: 12, productName: "Trà", unitPrice: "15000", quantity: 3, lineTotal: "45000" }],
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ order: backendOrder }, { status: 201 }));
    const client = createCommerceClient("http://localhost:3000/", fetcher);

    const response = await client.createOrder({ productId: 12, quantity: 3 }, "member-token");

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toBe("http://localhost:3000/api/orders");
    expect(options?.method).toBe("POST");
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer member-token");
    expect(JSON.parse(String(options?.body))).toEqual({ productId: 12, quantity: 3 });
    expect(response.order).toEqual(backendOrder);
    expect("payOrder" in client).toBe(false);
  });

  it("uses merchant-scoped catalog URL and surfaces backend errors", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ error: "MERCHANT_NOT_ACTIVE" }, { status: 403 }));
    const client = createCommerceClient("", fetcher);

    await expect(client.listPublicProducts(22)).rejects.toThrow("MERCHANT_NOT_ACTIVE");
    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/merchants/22/products");
  });

  it("connects wallet, voucher catalog, owned voucher, and merchant definition routes", async () => {
    const fetcher = vi.fn<typeof fetch>();
    fetcher
      .mockResolvedValueOnce(
        Response.json({
          wallet: {
            merchantId: 22,
            availablePoints: 0,
            lifetimeEarnedPoints: 0,
            tier: "UNRANKED",
            transactions: [],
          },
        }),
      )
      .mockResolvedValueOnce(Response.json({ definitions: [] }))
      .mockResolvedValueOnce(Response.json({ vouchers: [] }))
      .mockResolvedValueOnce(
        Response.json(
          {
            definition: {
              id: 5,
              merchantId: 22,
              type: "DISCOUNT",
              title: "Ưu đãi",
              pointsCost: 100,
              discountAmount: "10000",
              rewardDescription: null,
              isActive: true,
            },
          },
          { status: 201 },
        ),
      );
    const client = createCommerceClient("", fetcher);

    await client.getMemberWallet(22, "member-token");
    await client.listPublicVoucherDefinitions(22);
    await client.listMemberVouchers(22, "member-token");
    await client.createVoucherDefinition(
      {
        type: "DISCOUNT",
        title: "Ưu đãi",
        pointsCost: 100,
        discountAmount: "10000",
        rewardDescription: null,
      },
      "merchant-token",
    );

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "/api/member/merchants/22/wallet",
      "/api/merchants/22/vouchers",
      "/api/member/merchants/22/vouchers",
      "/api/merchant/vouchers",
    ]);
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get("Authorization")).toBe("Bearer member-token");
    expect(new Headers(fetcher.mock.calls[3]?.[1]?.headers).get("Authorization")).toBe(
      "Bearer merchant-token",
    );
    expect(JSON.parse(String(fetcher.mock.calls[3]?.[1]?.body))).toEqual({
      type: "DISCOUNT",
      title: "Ưu đãi",
      pointsCost: 100,
      discountAmount: "10000",
      rewardDescription: null,
    });
  });

  it("connects voucher redemption and reward fulfillment with backend results", async () => {
    const voucher = {
      id: 33,
      definitionId: 5,
      merchantId: 22,
      memberId: 9,
      title: "Quà tặng",
      type: "REWARD",
      status: "AVAILABLE",
      pointsCost: 100,
      discountAmount: null,
      rewardDescription: "Một phần quà",
      redeemedAt: "2026-11-09T10:00:00.000Z",
      usedAt: null,
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json(
          {
            voucher,
            wallet: { availablePoints: 20, lifetimeEarnedPoints: 120 },
          },
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(Response.json({ rewards: [voucher] }))
      .mockResolvedValueOnce(Response.json({ reward: { ...voucher, status: "FULFILLED" } }));
    const client = createCommerceClient("", fetcher);

    const redeemed = await client.redeemVoucher(5, "member-token");
    const rewards = await client.listMerchantRewards("merchant-token");
    const fulfilled = await client.fulfillReward(33, { note: "Trao tại quầy" }, "merchant-token");

    expect(fetcher.mock.calls.map(([url, options]) => [url, options?.method])).toEqual([
      ["/api/member/vouchers/5/redeem", "POST"],
      ["/api/merchant/rewards", "GET"],
      ["/api/merchant/rewards/33/fulfill", "POST"],
    ]);
    expect(JSON.parse(String(fetcher.mock.calls[2]?.[1]?.body))).toEqual({ note: "Trao tại quầy" });
    expect(redeemed.wallet).toEqual({ availablePoints: 20, lifetimeEarnedPoints: 120 });
    expect(rewards.rewards).toEqual([voucher]);
    expect(fulfilled.reward.status).toBe("FULFILLED");
  });

  it("sends the selected owned discount voucher when creating an order", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ order: {} }, { status: 201 }));
    const client = createCommerceClient("", fetcher);

    await client.createOrder({ productId: 12, quantity: 2, voucherId: 33 }, "member-token");

    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      productId: 12,
      quantity: 2,
      voucherId: 33,
    });
  });

  it("supports authoritative mock and VNPay payment status reads", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ order: { id: 41, status: "PAID" } }))
      .mockResolvedValueOnce(
        Response.json({ paymentUrl: "https://sandbox.vnpayment.vn/pay", txnRef: "m6-41" }, { status: 201 }),
      )
      .mockResolvedValueOnce(Response.json({ orderStatus: "PENDING", paymentStatus: "CREATED" }));
    const client = createCommerceClient("", fetcher);

    await expect(client.payMockOrder(41, "member-token")).resolves.toMatchObject({
      order: { status: "PAID" },
    });
    await expect(client.createVnpayPayment(41, "member-token")).resolves.toMatchObject({ txnRef: "m6-41" });
    await expect(client.getPaymentStatus(41, "member-token")).resolves.toEqual({
      orderStatus: "PENDING",
      paymentStatus: "CREATED",
    });
    expect(fetcher.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ["/api/orders/41/pay", "POST"],
      ["/api/orders/41/payments/vnpay", "POST"],
      ["/api/orders/41/payment-status", "GET"],
    ]);
    expect(
      fetcher.mock.calls.every(
        ([, init]) => new Headers(init?.headers).get("Authorization") === "Bearer member-token",
      ),
    ).toBe(true);
  });

  it("uses authenticated admin-only dashboard and merchant directory endpoints", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          stats: { merchants: 2, pendingApplications: 1, paidOrders: 9, totalVolume: "1234000" },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ merchants: [{ id: 7, name: "Mộc Studio", slug: "moc-studio", isActive: true }] }),
      );
    const client = createCommerceClient("", fetcher);
    await client.getAdminDashboard("admin-token");
    await client.listAdminMerchants("admin-token");
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(["/api/admin/dashboard", "/api/admin/merchants"]);
    expect(
      fetcher.mock.calls.every(
        ([, init]) => new Headers(init?.headers).get("Authorization") === "Bearer admin-token",
      ),
    ).toBe(true);
  });

  it("reads member orders and an order detail from owner-scoped endpoints", async () => {
    const order = {
      id: 41,
      merchantId: 7,
      memberId: 9,
      status: "PENDING",
      subtotal: "10000",
      discountAmount: "0",
      total: "10000",
      paidAt: null,
      items: [],
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ orders: [order] }))
      .mockResolvedValueOnce(Response.json({ order }));
    const client = createCommerceClient("", fetcher);
    await expect(client.listMemberOrders(7, "member-token")).resolves.toEqual({ orders: [order] });
    await expect(client.getMemberOrder(41, "member-token")).resolves.toEqual({ order });
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "/api/member/orders?merchantId=7",
      "/api/member/orders/41",
    ]);
  });

  it("lists active merchants from the public directory endpoint", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        merchants: [{ id: 7, name: "Mộc Studio", slug: "moc-studio", isActive: true }],
      }),
    );
    const client = createCommerceClient("", fetcher);
    await expect(client.listMerchants()).resolves.toEqual({
      merchants: [{ id: 7, name: "Mộc Studio", slug: "moc-studio", isActive: true }],
    });
    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/merchants");
  });
});
