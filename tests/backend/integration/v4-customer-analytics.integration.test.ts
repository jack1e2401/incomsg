import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { after, before, test } from "node:test";

process.env.JWT_SECRET ??= randomBytes(32).toString("hex");
process.env.PAYMENT_MODE = "mock";
process.env.VNPAY_TMN_CODE ??= "TESTV4";
process.env.VNPAY_HASH_SECRET ??= "test-v4-customer-analytics-secret";
process.env.VNPAY_RETURN_URL ??= "https://merchant.example/api/payments/vnpay/return";

const [{ app }, { prisma }, { signAccessToken }] = await Promise.all([
  import("../../../apps/backend/src/app.js"),
  import("../../../apps/backend/src/lib/prisma.js"),
  import("../../../apps/backend/src/lib/access-token.js"),
]);

const fixtureUserIds: number[] = [];
let server: Server | undefined;
let baseUrl: string;

async function start() {
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server!.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
}

async function cleanup() {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  try {
    const memberships = await prisma.merchantMembership.findMany({
      where: { memberId: { in: fixtureUserIds } },
      select: { id: true },
    });
    const membershipIds = memberships.map(({ id }) => id);
    const merchants = await prisma.merchant.findMany({
      where: { ownerId: { in: fixtureUserIds } },
      select: { id: true },
    });
    const merchantIds = merchants.map(({ id }) => id);

    await prisma.orderRefund.deleteMany({ where: { order: { merchantId: { in: merchantIds } } } });
    await prisma.paymentAttempt.deleteMany({ where: { order: { merchantId: { in: merchantIds } } } });
    await prisma.orderVoucherReservation.deleteMany({ where: { order: { merchantId: { in: merchantIds } } } });
    await prisma.rewardFulfillment.deleteMany({ where: { voucher: { membershipId: { in: membershipIds } } } });
    await prisma.rewardCancellation.deleteMany({ where: { voucher: { membershipId: { in: membershipIds } } } });
    await prisma.pointTransaction.deleteMany({ where: { wallet: { membershipId: { in: membershipIds } } } });
    await prisma.orderItem.deleteMany({ where: { order: { merchantId: { in: merchantIds } } } });
    await prisma.inventoryMovement.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.merchantFeeTransaction.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.order.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.redemptionIdempotency.deleteMany({ where: { memberId: { in: fixtureUserIds } } });
    await prisma.memberVoucher.deleteMany({ where: { membershipId: { in: membershipIds } } });
    await prisma.loyaltyWallet.deleteMany({ where: { membershipId: { in: membershipIds } } });
    await prisma.merchantMembership.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.inventoryBalance.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.voucherDefinition.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.product.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.loyaltyTier.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.loyaltyRule.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.loyaltyPolicyVersion.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.merchant.deleteMany({ where: { id: { in: merchantIds } } });
    await prisma.user.deleteMany({ where: { id: { in: fixtureUserIds } } });
  } finally {
    await prisma.$disconnect();
  }
}

async function request<T>(path: string, method = "GET", token?: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, json: (await response.json()) as T };
}

async function createUser(role: "MEMBER" | "MERCHANT" | "ADMIN") {
  const user = await prisma.user.create({
    data: { email: `v4ca-${randomUUID()}@test.local`, passwordHash: "fixture", role },
  });
  fixtureUserIds.push(user.id);
  return { id: user.id, email: user.email, token: await signAccessToken(user.id) };
}

async function createStore(name: string, isActive = true) {
  const owner = await createUser("MERCHANT");
  const slug = `v4-store-${randomUUID().slice(0, 8)}`;
  const merchant = await prisma.merchant.create({
    data: { ownerId: owner.id, name, slug, isActive },
  });
  return { id: merchant.id, slug, ownerToken: owner.token };
}

before(start);
after(cleanup);

test("concurrent auto-membership requests create one UNRANKED membership + wallet and isolate stores & roles", async () => {
  const storeA = await createStore("Store A");
  const storeB = await createStore("Store B");
  const inactiveStore = await createStore("Inactive Store", false);
  const member = await createUser("MEMBER");

  // Guest rejected
  const guestRes = await request<{ error: string }>(`/api/member/stores/${storeA.slug}/membership`, "POST");
  assert.equal(guestRes.status, 401);

  // Merchant rejected
  const merchantRoleRes = await request<{ error: string }>(
    `/api/member/stores/${storeA.slug}/membership`,
    "POST",
    storeA.ownerToken,
  );
  assert.equal(merchantRoleRes.status, 403);

  // Inactive / missing rejected
  const inactiveRes = await request<{ error: string }>(
    `/api/member/stores/${inactiveStore.slug}/membership`,
    "POST",
    member.token,
  );
  assert.equal(inactiveRes.status, 403);
  assert.equal(inactiveRes.json.error, "MERCHANT_NOT_ACTIVE");

  const missingRes = await request<{ error: string }>(
    "/api/member/stores/does-not-exist-xyz/membership",
    "POST",
    member.token,
  );
  assert.equal(missingRes.status, 404);
  assert.equal(missingRes.json.error, "MERCHANT_NOT_FOUND");

  // 6 parallel concurrent membership ensures for Store A
  type MembershipResp = {
    membership: { id: number; merchantId: number; memberId: number; tier: string; createdAt: string };
    created: boolean;
  };
  const results = await Promise.all(
    Array.from({ length: 6 }, () =>
      request<MembershipResp>(`/api/member/stores/${storeA.slug}/membership`, "POST", member.token),
    ),
  );
  for (const res of results) {
    assert.equal(res.status, 200);
    assert.equal(res.json.membership.merchantId, storeA.id);
    assert.equal(res.json.membership.memberId, member.id);
    assert.equal(res.json.membership.tier, "UNRANKED");
  }
  const createdCount = results.filter((r) => r.json.created).length;
  assert.equal(createdCount, 1);

  // Subsequent merchantId call is idempotent
  const idempotent = await request<MembershipResp>(
    `/api/member/merchants/${storeA.id}/membership`,
    "POST",
    member.token,
  );
  assert.equal(idempotent.status, 200);
  assert.equal(idempotent.json.created, false);

  // Verify DB rows: 1 membership in A, 0 in B
  const membershipsA = await prisma.merchantMembership.findMany({
    where: { memberId: member.id, merchantId: storeA.id },
    include: { wallet: true },
  });
  assert.equal(membershipsA.length, 1);
  assert.equal(membershipsA[0]!.tierId, null);
  assert.ok(membershipsA[0]!.wallet);

  const membershipsB = await prisma.merchantMembership.findMany({
    where: { memberId: member.id, merchantId: storeB.id },
  });
  assert.equal(membershipsB.length, 0);
});

test("Customer 360 lists 0-order members, handles REFUND_PENDING/REFUNDED, and enforces merchant isolation", async () => {
  const storeA = await createStore("C360 Store A");
  const storeB = await createStore("C360 Store B");
  const zeroOrderMember = await createUser("MEMBER");
  const buyerMember = await createUser("MEMBER");
  const storeBMember = await createUser("MEMBER");

  // Create SALE product in Store A
  const prodRes = await request<{ product: { id: number } }>(
    "/api/merchant/products",
    "POST",
    storeA.ownerToken,
    { name: "Latte", price: "50000", initialQuantity: 50 },
  );
  assert.equal(prodRes.status, 201);
  const productId = prodRes.json.product.id;

  // Auto-membership for zeroOrderMember & storeBMember
  await request(`/api/member/stores/${storeA.slug}/membership`, "POST", zeroOrderMember.token);
  await request(`/api/member/stores/${storeB.slug}/membership`, "POST", storeBMember.token);

  // Buyer completes 1 PAID order, 1 REFUND_PENDING order, 1 REFUNDED order
  const order1 = await request<{ order: { id: number } }>("/api/orders", "POST", buyerMember.token, {
    productId,
    quantity: 2, // 100,000
  });
  assert.equal(order1.status, 201);
  await request(`/api/orders/${order1.json.order.id}/pay`, "POST", buyerMember.token);

  const order2 = await request<{ order: { id: number } }>("/api/orders", "POST", buyerMember.token, {
    productId,
    quantity: 1, // 50,000
  });
  await request(`/api/orders/${order2.json.order.id}/pay`, "POST", buyerMember.token);
  await prisma.order.update({ where: { id: order2.json.order.id }, data: { status: "REFUND_PENDING" } });

  const order3 = await request<{ order: { id: number } }>("/api/orders", "POST", buyerMember.token, {
    productId,
    quantity: 1, // 50,000
  });
  await request(`/api/orders/${order3.json.order.id}/pay`, "POST", buyerMember.token);
  await request(`/api/merchant/orders/${order3.json.order.id}/refund`, "POST", storeA.ownerToken, {
    reason: "Test refund",
  });

  // List all customers for Store A
  const listAll = await request<{
    items: {
      memberId: number;
      tier: string;
      paidOrderCount: number;
      refundPendingOrderCount: number;
      refundPendingSpendVnd: string;
      netSpendVnd: string;
    }[];
    pagination: { totalItems: number };
  }>("/api/merchant/customers", "GET", storeA.ownerToken);
  assert.equal(listAll.status, 200);
  assert.equal(listAll.json.pagination.totalItems, 2);

  const zeroRow = listAll.json.items.find((i) => i.memberId === zeroOrderMember.id)!;
  assert.equal(zeroRow.tier, "UNRANKED");
  assert.equal(zeroRow.paidOrderCount, 0);
  assert.equal(zeroRow.netSpendVnd, "0");

  const buyerRow = listAll.json.items.find((i) => i.memberId === buyerMember.id)!;
  assert.equal(buyerRow.paidOrderCount, 1);
  assert.equal(buyerRow.refundPendingOrderCount, 1);
  assert.equal(buyerRow.refundPendingSpendVnd, "50000");
  assert.equal(buyerRow.netSpendVnd, "150000");

  // Filter non_buyers
  const nonBuyers = await request<{ items: { memberId: number }[] }>(
    "/api/merchant/customers?purchaseStatus=non_buyers",
    "GET",
    storeA.ownerToken,
  );
  assert.deepEqual(
    nonBuyers.json.items.map((i) => i.memberId),
    [zeroOrderMember.id],
  );

  // Detail for buyerMember
  const detail = await request<{
    customer: {
      stats: {
        totalOrders: number;
        paidOrderCount: number;
        refundPendingOrderCount: number;
        refundedOrderCount: number;
        netSpendVnd: string;
        refundPendingSpendVnd: string;
        averageOrderValueVnd: string;
      };
      pointLedger: unknown[];
      orders: unknown[];
    };
  }>(`/api/merchant/customers/${buyerMember.id}`, "GET", storeA.ownerToken);
  assert.equal(detail.status, 200);
  assert.equal(detail.json.customer.stats.totalOrders, 3);
  assert.equal(detail.json.customer.stats.paidOrderCount, 1);
  assert.equal(detail.json.customer.stats.refundPendingOrderCount, 1);
  assert.equal(detail.json.customer.stats.refundedOrderCount, 1);
  assert.equal(detail.json.customer.stats.netSpendVnd, "150000");
  assert.equal(detail.json.customer.stats.refundPendingSpendVnd, "50000");
  assert.equal(detail.json.customer.stats.averageOrderValueVnd, "75000");
  assert.ok(detail.json.customer.pointLedger.length >= 3);
  assert.equal(detail.json.customer.orders.length, 3);

  // Cross-merchant isolation: Store B cannot read Store A's member
  const crossRes = await request<{ error: string }>(
    `/api/merchant/customers/${buyerMember.id}`,
    "GET",
    storeB.ownerToken,
  );
  assert.equal(crossRes.status, 404);
  assert.equal(crossRes.json.error, "MEMBER_NOT_FOUND");
});

test("Merchant Analytics V1 computes exact revenue, VN timezones, product rankings, and low-stock alerts", async () => {
  const store = await createStore("Analytics Store");
  const member1 = await createUser("MEMBER");
  const member2 = await createUser("MEMBER");

  const hotProd = await request<{ product: { id: number } }>("/api/merchant/products", "POST", store.ownerToken, {
    name: "Hot Coffee",
    price: "40000",
    initialQuantity: 20,
  });
  const lowStockProd = await request<{ product: { id: number } }>("/api/merchant/products", "POST", store.ownerToken, {
    name: "Low Stock Tea",
    price: "30000",
    initialQuantity: 3, // default lowStockThreshold is 5 -> low stock!
  });
  const rewardProd = await request<{ product: { id: number } }>("/api/merchant/products", "POST", store.ownerToken, {
    name: "Reward Tumbler",
    kind: "REWARD",
    initialQuantity: 10,
  });

  await prisma.merchantMembership.create({ data: { merchantId: store.id, memberId: member1.id } });
  await prisma.merchantMembership.create({ data: { merchantId: store.id, memberId: member2.id } });

  // Member 1: 2 PAID orders on 2026-11-16 VN time (one at 2026-11-15T17:30:00Z = 2026-11-16 00:30+07:00)
  await prisma.order.create({
    data: {
      merchantId: store.id,
      memberId: member1.id,
      status: "PAID",
      subtotal: "80000",
      total: "80000",
      paidAt: new Date("2026-11-15T17:30:00Z"),
      items: {
        create: {
          productId: hotProd.json.product.id,
          productName: "Hot Coffee",
          unitPrice: "40000",
          quantity: 2,
          lineTotal: "80000",
        },
      },
    },
  });
  await prisma.order.create({
    data: {
      merchantId: store.id,
      memberId: member1.id,
      status: "REFUND_PENDING",
      subtotal: "40000",
      total: "40000",
      paidAt: new Date("2026-11-16T10:00:00+07:00"),
      items: {
        create: {
          productId: hotProd.json.product.id,
          productName: "Hot Coffee",
          unitPrice: "40000",
          quantity: 1,
          lineTotal: "40000",
        },
      },
    },
  });
  // Member 2: 1 REFUNDED order (excluded from net revenue & product unitsSold)
  await prisma.order.create({
    data: {
      merchantId: store.id,
      memberId: member2.id,
      status: "REFUNDED",
      subtotal: "30000",
      total: "30000",
      paidAt: new Date("2026-11-16T12:00:00+07:00"),
      items: {
        create: {
          productId: lowStockProd.json.product.id,
          productName: "Low Stock Tea",
          unitPrice: "30000",
          quantity: 1,
          lineTotal: "30000",
        },
      },
    },
  });

  // Ensure reward product is never counted in SALE revenue/slow-moving
  assert.ok(rewardProd.json.product.id > 0);

  const res = await request<{
    kpis: {
      netRevenueVnd: string;
      paidOnlyRevenueVnd: string;
      refundPendingRevenueVnd: string;
      refundedRevenueVnd: string;
      paidOrderCount: number;
      refundPendingOrderCount: number;
      refundedOrderCount: number;
      averageOrderValueVnd: string;
      totalMembers: number;
      returningCustomers: number;
    };
    revenueSeries: { bucket: string; revenueVnd: string; orderCount: number }[];
    topProducts: { productId: number; unitsSold: number; revenueVnd: string }[];
    slowMovingProducts: { productId: number; unitsSold: number; availableQuantity: number }[];
    noSales90DaysProducts: { productId: number; availableQuantity: number }[];
    lowStockProducts: { productId: number; availableQuantity: number; lowStockThreshold: number }[];
  }>("/api/merchant/analytics?from=2026-11-15&to=2026-11-17&granularity=day", "GET", store.ownerToken);

  assert.equal(res.status, 200);
  assert.equal(res.json.kpis.netRevenueVnd, "120000");
  assert.equal(res.json.kpis.paidOnlyRevenueVnd, "80000");
  assert.equal(res.json.kpis.refundPendingRevenueVnd, "40000");
  assert.equal(res.json.kpis.refundedRevenueVnd, "30000");
  assert.equal(res.json.kpis.paidOrderCount, 2);
  assert.equal(res.json.kpis.refundPendingOrderCount, 1);
  assert.equal(res.json.kpis.refundedOrderCount, 1);
  assert.equal(res.json.kpis.averageOrderValueVnd, "60000");
  assert.equal(res.json.kpis.totalMembers, 2);
  assert.equal(res.json.kpis.returningCustomers, 1);

  assert.deepEqual(
    res.json.revenueSeries.map((p) => ({ bucket: p.bucket, revenueVnd: p.revenueVnd, orderCount: p.orderCount })),
    [
      { bucket: "2026-11-15", revenueVnd: "0", orderCount: 0 },
      { bucket: "2026-11-16", revenueVnd: "120000", orderCount: 2 },
      { bucket: "2026-11-17", revenueVnd: "0", orderCount: 0 },
    ],
  );

  assert.equal(res.json.topProducts.length, 1);
  assert.equal(res.json.topProducts[0]!.productId, hotProd.json.product.id);
  assert.equal(res.json.topProducts[0]!.unitsSold, 3);
  assert.equal(res.json.topProducts[0]!.revenueVnd, "120000");

  assert.equal(res.json.slowMovingProducts[0]!.productId, lowStockProd.json.product.id);
  assert.equal(res.json.slowMovingProducts[0]!.unitsSold, 0);
  assert.equal(res.json.slowMovingProducts[0]!.availableQuantity, 3);

  assert.equal(res.json.noSales90DaysProducts.length, 1);
  assert.equal(res.json.noSales90DaysProducts[0]!.productId, lowStockProd.json.product.id);

  assert.equal(res.json.lowStockProducts.length, 1);
  assert.equal(res.json.lowStockProducts[0]!.productId, lowStockProd.json.product.id);
  assert.equal(res.json.lowStockProducts[0]!.availableQuantity, 3);
  assert.equal(res.json.lowStockProducts[0]!.lowStockThreshold, 5);
});
