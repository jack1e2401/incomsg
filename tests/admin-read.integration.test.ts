import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import type { Server } from "node:http";

process.env.JWT_SECRET ??= randomBytes(32).toString("hex");
const [{ app }, { prisma }, { signAccessToken }] = await Promise.all([
  import("../src/app.js"), import("../src/lib/prisma.js"), import("../src/lib/access-token.js"),
]);
const suffix = randomUUID();
const emails = ["admin", "merchant", "member", "applicant"].map((role) => `admin-read-${role}-${suffix}@test.local`);
let server: Server | undefined;
let baseUrl: string;
let adminToken: string;
let merchantToken: string;
let memberToken: string;
let merchantId: number;
let inactiveMerchantId: number;

before(async () => {
  const [admin, owner, member, applicant] = await Promise.all([
    prisma.user.create({ data: { email: emails[0], passwordHash: "fixture", role: "ADMIN" } }),
    prisma.user.create({ data: { email: emails[1], passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: emails[2], passwordHash: "fixture", role: "MEMBER" } }),
    prisma.user.create({ data: { email: emails[3], passwordHash: "fixture", role: "MERCHANT", isActive: false } }),
  ]);
  const [active, inactive] = await Promise.all([
    prisma.merchant.create({ data: { ownerId: owner.id, name: "Admin read active", slug: `admin-read-${suffix}` } }),
    prisma.merchant.create({ data: { ownerId: applicant.id, name: "Admin read inactive", slug: `admin-read-inactive-${suffix}`, isActive: false } }),
  ]);
  merchantId = active.id;
  inactiveMerchantId = inactive.id;
  await prisma.merchantApplication.create({ data: { applicantId: applicant.id, storeName: "Pending admin read" } });
  const product = await prisma.product.create({ data: { merchantId, name: "Admin stats product", price: "250000" } });
  await prisma.order.create({
    data: {
      merchantId, memberId: member.id, status: "PAID", subtotal: 250000, discountAmount: 50000,
      total: 200000, paidAt: new Date(),
      items: { create: { productId: product.id, productName: product.name, unitPrice: 250000, quantity: 1, lineTotal: 250000 } },
    },
  });
  await prisma.order.create({
    data: {
      merchantId, memberId: member.id, status: "PENDING", subtotal: 700000, discountAmount: 0,
      total: 700000,
      items: { create: { productId: product.id, productName: product.name, unitPrice: 700000, quantity: 1, lineTotal: 700000 } },
    },
  });
  [adminToken, merchantToken, memberToken] = await Promise.all([
    signAccessToken(admin.id), signAccessToken(owner.id), signAccessToken(member.id),
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
    const orders = await prisma.order.findMany({ where: { memberId: { in: userIds } }, select: { id: true } });
    const orderIds = orders.map((order) => order.id);
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.paymentAttempt.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.pointTransaction.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.product.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.merchantApplication.deleteMany({ where: { applicantId: { in: userIds } } });
    await prisma.voucherDefinition.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.loyaltyTier.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.loyaltyRule.deleteMany({ where: { merchantId: { in: merchantIds } } });
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

test("admin merchant directory returns only merchant directory fields", async () => {
  const { response, json } = await request("/api/admin/merchants", adminToken);
  assert.equal(response.status, 200);
  const active = json.merchants.find((merchant: { id: number }) => merchant.id === merchantId);
  const inactive = json.merchants.find((merchant: { id: number }) => merchant.id === inactiveMerchantId);
  assert.deepEqual(Object.keys(active).sort(), ["id", "isActive", "name", "slug"]);
  assert.deepEqual(Object.keys(inactive).sort(), ["id", "isActive", "name", "slug"]);
  assert.equal(inactive.isActive, false);
});

test("admin dashboard includes its fixture contributions and only paid orders", async () => {
  const { response, json } = await request("/api/admin/dashboard", adminToken);
  assert.equal(response.status, 200);
  const [activeMerchant, pendingApplication, paidOrder, pendingOrder] = await Promise.all([
    prisma.merchant.findUnique({ where: { id: merchantId }, select: { isActive: true } }),
    prisma.merchantApplication.findFirst({ where: { applicant: { email: emails[3] }, status: "PENDING" } }),
    prisma.order.findFirst({ where: { member: { email: emails[2] }, merchantId, status: "PAID" }, select: { total: true } }),
    prisma.order.findFirst({ where: { member: { email: emails[2] }, merchantId, status: "PENDING" }, select: { total: true } }),
  ]);
  assert.equal(activeMerchant?.isActive, true);
  assert.ok(pendingApplication);
  assert.ok(paidOrder);
  assert.ok(pendingOrder);
  assert.ok(json.stats.merchants >= 1);
  assert.ok(json.stats.pendingApplications >= 1);
  assert.ok(json.stats.paidOrders >= 1);
  assert.ok(BigInt(json.stats.totalVolume) >= BigInt(paidOrder.total.toFixed(0)));
  // A PENDING fixture is present, so paid-only aggregates must stay below the all-order totals.
  // These broad bounds tolerate other integration files inserting or deleting their own fixtures.
  const [allOrderCount, allOrderVolume] = await Promise.all([
    prisma.order.count(),
    prisma.order.aggregate({ _sum: { total: true } }),
  ]);
  assert.ok(json.stats.paidOrders < allOrderCount);
  assert.ok(BigInt(json.stats.totalVolume) < BigInt(allOrderVolume._sum.total?.toFixed(0) ?? "0"));
});

test("admin dashboard and directory reject anonymous and non-admin callers", async () => {
  for (const path of ["/api/admin/dashboard", "/api/admin/merchants"]) {
    assert.equal((await request(path)).response.status, 401);
    assert.equal((await request(path, merchantToken)).response.status, 403);
    assert.equal((await request(path, memberToken)).response.status, 403);
  }
});
