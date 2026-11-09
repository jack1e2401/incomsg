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
});
