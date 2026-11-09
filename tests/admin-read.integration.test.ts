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
let ownerId: number;
let memberId: number;

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
  ownerId = owner.id;
  memberId = member.id;
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

test("admin dashboard reports exact deltas and excludes pending orders", async () => {
  const before = await request("/api/admin/dashboard", adminToken);
  assert.equal(before.response.status, 200);

  const merchant = await prisma.merchant.create({
    data: { ownerId, name: "Dashboard delta fixture", slug: `dashboard-delta-${suffix}` },
  });
  const product = await prisma.product.create({ data: { merchantId: merchant.id, name: "Delta product", price: "250000" } });
  const paidTotal = 200000;
  await prisma.order.create({
    data: {
      merchantId: merchant.id, memberId, status: "PAID", subtotal: 250000, discountAmount: 50000,
      total: paidTotal, paidAt: new Date(),
      items: { create: { productId: product.id, productName: product.name, unitPrice: 250000, quantity: 1, lineTotal: 250000 } },
    },
  });
  await prisma.order.create({
    data: {
      merchantId: merchant.id, memberId, status: "PENDING", subtotal: 700000, discountAmount: 0,
      total: 700000,
      items: { create: { productId: product.id, productName: product.name, unitPrice: 700000, quantity: 1, lineTotal: 700000 } },
    },
  });

  const after = await request("/api/admin/dashboard", adminToken);
  assert.equal(after.response.status, 200);
  assert.deepEqual(after.json.stats, {
    merchants: before.json.stats.merchants + 1,
    pendingApplications: before.json.stats.pendingApplications,
    paidOrders: before.json.stats.paidOrders + 1,
    totalVolume: (BigInt(before.json.stats.totalVolume) + BigInt(paidTotal)).toString(),
  });
});

test("admin dashboard and directory reject anonymous and non-admin callers", async () => {
  for (const path of ["/api/admin/dashboard", "/api/admin/merchants"]) {
    assert.equal((await request(path)).response.status, 401);
    assert.equal((await request(path, merchantToken)).response.status, 403);
    assert.equal((await request(path, memberToken)).response.status, 403);
  }
});
