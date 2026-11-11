import { describe, expect, it } from "vitest";
import { createMockApi } from "../../../../apps/frontend/src/api/mock";

describe("mock commerce adapter", () => {
  it("keeps wallets scoped to their merchant", async () => {
    const api = createMockApi();
    const a = await api.getWallet("moc");
    const b = await api.getWallet("hikari");
    expect(a.merchantId).toBe("moc");
    expect(b.merchantId).toBe("hikari");
    expect(a.tier).toBe("Silver");
    expect(b.tier).toBe("Unranked");
  });

  it("creates a pending order without awarding points or tier", async () => {
    const api = createMockApi();
    const before = await api.getWallet("hikari");
    const result = await api.createOrder({ merchantId: "hikari", items: [{ productId: "p4", quantity: 1 }] });
    const after = await api.getWallet("hikari");
    expect(result.status).toBe("PENDING");
    expect(result.earnedPoints).toBe(0);
    expect(after).toEqual(before);
  });

  it("redeems against one wallet once and keeps lifetime tier", async () => {
    const api = createMockApi();
    const before = await api.getWallet("moc");
    const result = await api.redeemVoucher("v1", "moc");
    expect(result.wallet.availablePoints).toBe(before.availablePoints - 200);
    expect(result.wallet.lifetimeEarnedPoints).toBe(before.lifetimeEarnedPoints);
    expect(result.wallet.tier).toBe(before.tier);
    await expect(api.redeemVoucher("v2", "moc")).rejects.toThrow("Không đủ điểm");
  });

  it("rejects voucher redemption against another merchant wallet", async () => {
    const api = createMockApi();
    const before = await api.getWallet("moc");
    await expect(api.redeemVoucher("v1", "hikari")).rejects.toThrow("Voucher không khả dụng");
    expect(await api.getWallet("moc")).toEqual(before);
  });

  it("does not expose merchant management for pending merchants", async () => {
    const api = createMockApi();
    expect(await api.canManageMerchant("gommay")).toBe(false);
    await api.approveApplication("a1");
    expect(await api.canManageMerchant("gommay")).toBe(true);
  });

  it("rejects cross-merchant product, voucher and reward mutations", async () => {
    const api = createMockApi();
    await expect(api.toggleProduct("p1", "hikari")).rejects.toThrow("Không tìm thấy sản phẩm");
    await expect(api.toggleVoucherDefinition("v1", "hikari")).rejects.toThrow("Không tìm thấy voucher");
    await expect(api.fulfillReward("mv-reward", "hikari")).rejects.toThrow("Không tìm thấy phần thưởng");
  });

  it("limits member order history to the current member and merchant", async () => {
    const api = createMockApi();
    const orders = await api.listMemberOrders("moc");
    expect(orders).toHaveLength(1);
    expect(orders[0].memberName).toBe("Mai Anh");
    expect((await api.listMemberVouchers("moc")).some((voucher) => voucher.id === "mv-other")).toBe(false);
  });

  it("initializes a merchant wallet and loyalty config after approval", async () => {
    const api = createMockApi();
    await api.approveApplication("a1");
    expect(await api.getWallet("gommay")).toMatchObject({
      merchantId: "gommay",
      tier: "Unranked",
      availablePoints: 0,
    });
    expect((await api.getLoyaltyConfig("gommay")).merchantId).toBe("gommay");
    const saved = await api.saveLoyaltyConfig({
      merchantId: "gommay",
      baseAmount: 12000,
      tiers: [
        { tier: "Bronze", threshold: 0, multiplier: 1 },
        { tier: "Silver", threshold: 1000, multiplier: 1.2 },
        { tier: "Gold", threshold: 5000, multiplier: 1.5 },
        { tier: "Platinum", threshold: 10000, multiplier: 2 },
      ],
    });
    expect((await api.getLoyaltyConfig("gommay")).baseAmount).toBe(saved.baseAmount);
  });

  it("prevents saving another merchant's product or voucher by ID", async () => {
    const api = createMockApi();
    await expect(
      api.saveProduct({ id: "p1", merchantId: "hikari", name: "Tampered", price: 1 }),
    ).rejects.toThrow("Không tìm thấy sản phẩm");
    await expect(
      api.saveVoucherDefinition({
        id: "v1",
        merchantId: "hikari",
        title: "Tampered",
        kind: "DISCOUNT",
        pointsCost: 1,
      }),
    ).rejects.toThrow("Không tìm thấy voucher");
  });
});
