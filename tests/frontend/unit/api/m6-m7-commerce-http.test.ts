import { describe, expect, it, vi } from "vitest";
import { createCommerceClient } from "../../../../apps/frontend/src/api/commerce-http";

describe("M6 & M7 commerce HTTP client", () => {
  it("cancels an unpaid pending order with Bearer auth", async () => {
    const cancelResponse = {
      order: {
        id: 42,
        merchantId: 7,
        memberId: 9,
        status: "CANCELLED",
        subtotal: "20000",
        discountAmount: "0",
        total: "20000",
        paidAt: null,
        items: [],
        earnedPointsExact: null,
        actions: { canCancel: false, canRefund: false, requiresReconciliation: false },
      },
      voucherReleased: true,
      capacityReleasedExact: "0",
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(cancelResponse, { status: 200 }));
    const client = createCommerceClient("http://localhost:3000", fetcher);

    const response = await client.cancelOrder(42, "member-token");

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toBe("http://localhost:3000/api/orders/42/cancel");
    expect(options?.method).toBe("POST");
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer member-token");
    expect(response).toEqual(cancelResponse);
  });

  it("fetches member earning preview without creating ledger state", async () => {
    const previewDto = {
      merchantId: 7,
      active: true,
      netOrderAmountVnd: "50000",
      tierLevel: "SILVER",
      multiplier: "1.25",
      vndPerPoint: 10000,
      estimatedPointsExact: "6.25",
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(previewDto, { status: 200 }));
    const client = createCommerceClient("", fetcher);

    const response = await client.previewMemberEarning(7, "50000", "member-token");

    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/member/merchants/7/loyalty/preview");
    expect(fetcher.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      netOrderAmountVnd: "50000",
    });
    expect(response).toEqual(previewDto);
  });

  it("fetches merchant loyalty formula preview", async () => {
    const previewDto = {
      netOrderAmountVnd: "100000",
      tierLevel: "GOLD",
      multiplier: "1.50",
      vndPerPoint: 10000,
      active: true,
      estimatedPointsExact: "15.000000000000",
      integerProjection: 15,
      fractionalProjection: "0.000000000000",
      rounding: "HALF_UP",
      scale: 12,
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(previewDto, { status: 200 }));
    const client = createCommerceClient("", fetcher);

    const response = await client.previewMerchantLoyalty(
      { netOrderAmountVnd: "100000", tierLevel: "GOLD" },
      "merchant-token",
    );

    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/merchant/loyalty/preview");
    expect(fetcher.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      netOrderAmountVnd: "100000",
      tierLevel: "GOLD",
    });
    expect(response).toEqual(previewDto);
  });

  it("queries merchant loyalty transactions with filters and cursor", async () => {
    const transactionsDto = {
      items: [
        {
          id: 88,
          eventRef: "evt_88",
          type: "EARN_REVERSAL",
          delta: "-0.6",
          balanceAfter: "0.6",
          availablePointsAfter: 0,
          fractionalCarryAfter: "0.6",
          pointDebtAfter: "0",
          orderId: 41,
          memberVoucherId: null,
          reason: "Hoàn tiền đơn hàng #41",
          source: "MERCHANT_REFUND",
          actorId: 2,
          createdAt: "2026-11-11T12:00:00.000Z",
          memberId: 9,
          memberEmail: "member@test.local",
        },
      ],
      nextCursor: "cursor_abc",
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(transactionsDto, { status: 200 }));
    const client = createCommerceClient("", fetcher);

    const response = await client.listMerchantTransactions(
      { memberId: 9, type: "EARN_REVERSAL", cursor: "cursor_start", limit: 20 },
      "merchant-token",
    );

    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "/api/merchant/loyalty/transactions?memberId=9&type=EARN_REVERSAL&cursor=cursor_start&limit=20",
    );
    expect(response).toEqual(transactionsDto);
  });

  it("requests refund preview and executes reasoned order refund", async () => {
    const refundPreview = {
      orderId: 41,
      refundAmountVnd: "60000",
      refundStatus: null,
      earningReversalExact: "6.0",
      walletBefore: { exactBalance: "6.0" },
      walletAfter: { exactBalance: "0.0" },
      tierBefore: "BRONZE",
      tierAfter: "BRONZE",
      discountVoucherRestorable: true,
      providerConfirmationRequired: false,
    };
    const refundResult = {
      refund: {
        id: 1,
        status: "COMPLETED",
        amountVnd: "60000",
        reason: "Khách trả hàng tại quầy",
        requestedById: 2,
        requestedAt: "2026-11-11T12:00:00.000Z",
        completedAt: "2026-11-11T12:00:00.000Z",
        providerReference: null,
      },
      order: { id: 41, status: "REFUNDED", refundStatus: "COMPLETED" },
      walletImpact: { reversalExact: "6.0" },
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(refundPreview, { status: 200 }))
      .mockResolvedValueOnce(Response.json(refundResult, { status: 200 }));
    const client = createCommerceClient("", fetcher);

    const preview = await client.getRefundPreview(41, "merchant-token");
    const refund = await client.refundOrder(41, { reason: "Khách trả hàng tại quầy" }, "merchant-token");

    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/merchant/orders/41/refund-preview");
    expect(fetcher.mock.calls[1]?.[0]).toBe("/api/merchant/orders/41/refund");
    expect(fetcher.mock.calls[1]?.[1]?.method).toBe("POST");
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({
      reason: "Khách trả hàng tại quầy",
    });
    expect(preview).toEqual(refundPreview);
    expect(refund).toEqual(refundResult);
  });

  it("cancels unfulfilled reward voucher with reason", async () => {
    const cancelResponse = {
      reward: {
        memberVoucherId: 15,
        status: "CANCELLED",
        memberId: 9,
        cancellationReason: "Hết hàng quà tặng",
      },
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(cancelResponse, { status: 200 }));
    const client = createCommerceClient("", fetcher);

    const response = await client.cancelReward(15, { reason: "Hết hàng quà tặng" }, "merchant-token");

    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/merchant/rewards/15/cancel");
    expect(fetcher.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      reason: "Hết hàng quà tặng",
    });
    expect(response).toEqual(cancelResponse);
  });

  it("requires a non-empty idempotency key for voucher redemption", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = createCommerceClient("", fetcher);

    await expect(client.redeemVoucher(5, "member-token", "")).rejects.toThrow(
      "Idempotency key is required to redeem a voucher",
    );
    await expect(client.redeemVoucher(5, "member-token", "   ")).rejects.toThrow(
      "Idempotency key is required to redeem a voucher",
    );
    await expect(client.redeemVoucher(5, "member-token", undefined as any)).rejects.toThrow(
      "Idempotency key is required to redeem a voucher",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("sends Idempotency-Key header with trimmed value to redeemVoucher", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ voucher: { id: 1 }, wallet: { availablePoints: 0, lifetimeEarnedPoints: 0 } }),
      );
    const client = createCommerceClient("", fetcher);

    await client.redeemVoucher(5, "member-token", "  key-12345  ");

    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get("Idempotency-Key")).toBe("key-12345");
  });
});
