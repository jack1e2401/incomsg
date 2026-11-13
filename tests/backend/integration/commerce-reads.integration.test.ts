import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import type { Server } from "node:http";

process.env.JWT_SECRET ??= randomBytes(32).toString("hex");
const [{ app }, { prisma }, { signAccessToken }] = await Promise.all([
  import("../../../apps/backend/src/app.js"),
  import("../../../apps/backend/src/lib/prisma.js"),
  import("../../../apps/backend/src/lib/access-token.js"),
]);
const suffix = randomUUID();
const emails = ["merchant-a", "merchant-b", "merchant-inactive", "member-a", "member-b"].map((role) => `reads-${role}-${suffix}@test.local`);
let server: Server | undefined;
let baseUrl: string;
let merchantAId: number;
let merchantBId: number;
let inactiveMerchantId: number;
let orderAId: number;
let orderBId: number;
let pendingOrderId: number;
let memberAToken: string;
let memberBToken: string;
let merchantAToken: string;
let merchantBToken: string;

before(async () => {
  const [ownerA, ownerB, inactiveOwner, memberA, memberB] = await Promise.all([
    prisma.user.create({ data: { email: emails[0], passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: emails[1], passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: emails[2], passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: emails[3], passwordHash: "fixture", role: "MEMBER" } }),
    prisma.user.create({ data: { email: emails[4], passwordHash: "fixture", role: "MEMBER" } }),
  ]);
  const [merchantA, merchantB, inactiveMerchant] = await Promise.all([
    prisma.merchant.create({ data: { ownerId: ownerA.id, name: "Reads A", slug: `reads-a-${suffix}` } }),
    prisma.merchant.create({ data: { ownerId: ownerB.id, name: "Reads B", slug: `reads-b-${suffix}` } }),
    prisma.merchant.create({ data: { ownerId: inactiveOwner.id, name: "Reads inactive", slug: `reads-inactive-${suffix}`, isActive: false } }),
  ]);
  merchantAId = merchantA.id;
  merchantBId = merchantB.id;
  inactiveMerchantId = inactiveMerchant.id;
  const [productA, productB] = await Promise.all([
    prisma.product.create({ data: { merchantId: merchantAId, name: "Reads product A", price: "20000" } }),
    prisma.product.create({ data: { merchantId: merchantBId, name: "Reads product B", price: "30000" } }),
  ]);
  const [orderA, orderB, pendingOrder] = await Promise.all([
    prisma.order.create({
      data: {
        merchantId: merchantAId, memberId: memberA.id, status: "PAID", subtotal: 20000,
        discountAmount: 0, total: 20000, paidAt: new Date(), earnedPointsExact: 2,
        items: { create: { productId: productA.id, productName: productA.name, unitPrice: 20000, quantity: 1, lineTotal: 20000 } },
      },
    }),
    prisma.order.create({
      data: {
        merchantId: merchantBId, memberId: memberA.id, status: "PAID", subtotal: 30000,
        discountAmount: 0, total: 30000, paidAt: new Date(),
        items: { create: { productId: productB.id, productName: productB.name, unitPrice: 30000, quantity: 1, lineTotal: 30000 } },
      },
    }),
    prisma.order.create({
      data: {
        merchantId: merchantAId, memberId: memberA.id, status: "PENDING", subtotal: 20000,
        discountAmount: 0, total: 20000, paidAt: null,
        items: { create: { productId: productA.id, productName: productA.name, unitPrice: 20000, quantity: 1, lineTotal: 20000 } },
      },
    }),
  ]);
  orderAId = orderA.id;
  orderBId = orderB.id;
  pendingOrderId = pendingOrder.id;
  const membership = await prisma.merchantMembership.create({ data: { memberId: memberA.id, merchantId: merchantAId } });
  const wallet = await prisma.loyaltyWallet.create({ data: { membershipId: membership.id, exactBalance: 2, netLifetimeEarned: 2 } });
  await prisma.pointTransaction.create({ data: { walletId: wallet.id, type: "EARN", delta: 2, balanceAfter: 2, reason: "test read", orderId: orderAId } });
  [merchantAToken, merchantBToken, memberAToken, memberBToken] = await Promise.all([
    signAccessToken(ownerA.id), signAccessToken(ownerB.id), signAccessToken(memberA.id), signAccessToken(memberB.id),
  ]);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server!.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  try {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
    const userIds = users.map((user) => user.id);
    if (userIds.length === 0) return;
    const merchants = await prisma.merchant.findMany({ where: { ownerId: { in: userIds } }, select: { id: true } });
    const merchantIds = merchants.map((merchant) => merchant.id);
    const memberships = await prisma.merchantMembership.findMany({ where: { memberId: { in: userIds } }, select: { id: true } });
    const membershipIds = memberships.map((membership) => membership.id);
    const wallets = await prisma.loyaltyWallet.findMany({ where: { membershipId: { in: membershipIds } }, select: { id: true } });
    const walletIds = wallets.map((wallet) => wallet.id);
    const vouchers = await prisma.memberVoucher.findMany({ where: { membershipId: { in: membershipIds } }, select: { id: true } });
    const voucherIds = vouchers.map((voucher) => voucher.id);
    const orders = await prisma.order.findMany({ where: { memberId: { in: userIds } }, select: { id: true } });
    const orderIds = orders.map((order) => order.id);
    await prisma.rewardFulfillment.deleteMany({ where: { voucherId: { in: voucherIds } } });
    await prisma.order.updateMany({ where: { id: { in: orderIds }, voucherId: { in: voucherIds } }, data: { voucherId: null } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.paymentAttempt.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.pointTransaction.deleteMany({ where: { OR: [{ walletId: { in: walletIds } }, { memberVoucherId: { in: voucherIds } }] } });
    await prisma.merchantFeeTransaction.deleteMany({ where: { order: { id: { in: orderIds } } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.memberVoucher.deleteMany({ where: { id: { in: voucherIds } } });
    await prisma.loyaltyWallet.deleteMany({ where: { id: { in: walletIds } } });
    await prisma.merchantMembership.deleteMany({ where: { id: { in: membershipIds } } });
    await prisma.merchantApplication.deleteMany({ where: { applicantId: { in: userIds } } });
    await prisma.voucherDefinition.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.loyaltyTier.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.loyaltyRule.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.product.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.merchant.deleteMany({ where: { id: { in: merchantIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  } finally {
    await prisma.$disconnect();
  }
});

async function request(path: string, token?: string) {
  const response = await fetch(`${baseUrl}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  return { response, json: await response.json() as Record<string, any> };
}

test("public merchant directory lists active stores only", async () => {
  const { response, json } = await request("/api/merchants");
  assert.equal(response.status, 200);
  const merchantIds = json.merchants.map((merchant: { id: number }) => merchant.id);
  assert.ok(merchantIds.includes(merchantAId));
  assert.ok(merchantIds.includes(merchantBId));
  assert.ok(!merchantIds.includes(inactiveMerchantId));
  assert.deepEqual(Object.keys(json.merchants[0]).sort(), ["id", "name", "slug"]);
});

test("member order list is scoped to member and merchant; foreign detail is hidden", async () => {
  const own = await request(`/api/member/orders?merchantId=${merchantAId}`, memberAToken);
  assert.equal(own.response.status, 200);
  assert.deepEqual(
    own.json.orders.map((order: { id: number }) => order.id).sort((a: number, b: number) => a - b),
    [orderAId, pendingOrderId].sort((a, b) => a - b),
  );
  const paidOrder = own.json.orders.find((order: { id: number }) => order.id === orderAId);
  const pendingOrder = own.json.orders.find((order: { id: number }) => order.id === pendingOrderId);
  assert.equal(paidOrder.earnedPoints, 2);
  assert.equal(paidOrder.earnedPointsExact, "2");
  assert.equal(pendingOrder.earnedPoints, null);
  assert.equal(pendingOrder.earnedPointsExact, null);
  assert.equal(paidOrder.memberEmail, undefined);
  const foreign = await request(`/api/member/orders/${orderAId}`, memberBToken);
  assert.equal(foreign.response.status, 404);
  assert.equal(foreign.json.error, "ORDER_NOT_FOUND");
});

test("member order history remains readable after merchant deactivation", async () => {
  await prisma.merchant.update({ where: { id: merchantAId }, data: { isActive: false } });
  try {
    const history = await request(`/api/member/orders?merchantId=${merchantAId}`, memberAToken);
    assert.equal(history.response.status, 200);
    assert.ok(history.json.orders.some((order: { id: number }) => order.id === orderAId));
  } finally {
    await prisma.merchant.update({ where: { id: merchantAId }, data: { isActive: true } });
  }
});

test("member order list validates authentication, role and merchant query IDs", async () => {
  assert.equal((await request(`/api/member/orders?merchantId=${merchantAId}`)).response.status, 401);
  assert.equal((await request(`/api/member/orders?merchantId=${merchantAId}`, merchantAToken)).response.status, 403);
  assert.equal((await request("/api/member/orders?merchantId=bad", memberAToken)).response.status, 400);
  assert.equal((await request(`/api/member/orders?merchantId=${merchantAId}&merchantId=${merchantBId}`, memberAToken)).response.status, 400);
});

test("merchant order list returns buyer email and earned points only for its own store orders", async () => {
  const own = await request("/api/merchant/orders", merchantAToken);
  assert.equal(own.response.status, 200);
  assert.deepEqual(
    own.json.orders.map((order: { id: number }) => order.id).sort((a: number, b: number) => a - b),
    [orderAId, pendingOrderId].sort((a, b) => a - b),
  );
  assert.equal(own.json.orders.find((order: { id: number }) => order.id === orderAId).earnedPoints, 2);
  assert.equal(own.json.orders.find((order: { id: number }) => order.id === pendingOrderId).earnedPoints, null);
  assert.ok(own.json.orders.every((order: { memberEmail?: string }) => order.memberEmail === emails[3]));
  const otherStore = await request("/api/merchant/orders", merchantBToken);
  assert.deepEqual(otherStore.json.orders.map((order: { id: number }) => order.id), [orderBId]);
  assert.ok(!otherStore.json.orders.some((order: { id: number }) => order.id === orderAId));
});
