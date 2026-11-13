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
const emails = ["admin", "merchant-a", "merchant-b", "member-a", "member-b"].map(
  (role) => `abuse-report-${role}-${suffix}@test.local`,
);
let server: Server | undefined;
let baseUrl: string;
let merchantAId: number;
let merchantBId: number;
let merchantAOwnerId: number;
let memberAId: number;
let memberBId: number;
let orderAId: number;
let adminToken: string;
let merchantAToken: string;
let merchantBToken: string;
let memberToken: string;

type ApiBody = {
  report?: { id: number; merchantId: number; reporterId: number; memberId: number; orderId: number | null; reason: string };
  items?: Array<{ id: number; merchantId: number; reporterId: number; memberId: number; orderId: number | null; reason: string }>;
  nextCursor?: string | null;
  error?: string;
};

before(async () => {
  const [admin, merchantAOwner, merchantBOwner, memberA, memberB] = await Promise.all([
    prisma.user.create({ data: { email: emails[0]!, passwordHash: "fixture", role: "ADMIN" } }),
    prisma.user.create({ data: { email: emails[1]!, passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: emails[2]!, passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: emails[3]!, passwordHash: "fixture", role: "MEMBER" } }),
    prisma.user.create({ data: { email: emails[4]!, passwordHash: "fixture", role: "MEMBER" } }),
  ]);
  merchantAOwnerId = merchantAOwner.id;
  memberAId = memberA.id;
  memberBId = memberB.id;
  const [merchantA, merchantB] = await Promise.all([
    prisma.merchant.create({ data: { ownerId: merchantAOwner.id, name: "Report Merchant A", slug: `report-a-${suffix}` } }),
    prisma.merchant.create({ data: { ownerId: merchantBOwner.id, name: "Report Merchant B", slug: `report-b-${suffix}` } }),
  ]);
  merchantAId = merchantA.id;
  merchantBId = merchantB.id;
  await prisma.merchantMembership.createMany({
    data: [{ memberId: memberAId, merchantId: merchantAId }, { memberId: memberBId, merchantId: merchantBId }],
  });
  const orderA = await prisma.order.create({
    data: { merchantId: merchantAId, memberId: memberAId, subtotal: "10000", discountAmount: "0", total: "10000" },
  });
  orderAId = orderA.id;
  [adminToken, merchantAToken, merchantBToken, memberToken] = await Promise.all([
    signAccessToken(admin.id), signAccessToken(merchantAOwner.id), signAccessToken(merchantBOwner.id), signAccessToken(memberAId),
  ]);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server!.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  const table = await prisma.$queryRaw<Array<{ present: number }>>`
    SELECT COUNT(*) AS present FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'MerchantAbuseReport'
  `;
  if (table[0]?.present) {
    await prisma.$executeRaw`DELETE FROM MerchantAbuseReport WHERE merchantId IN (${merchantAId}, ${merchantBId})`;
  }
  const merchants = [merchantAId, merchantBId].filter(Boolean);
  if (merchants.length) {
    await prisma.merchantFeeTransaction.deleteMany({ where: { order: { merchantId: { in: merchants } } } });
    await prisma.order.deleteMany({ where: { merchantId: { in: merchants } } });
    await prisma.merchantMembership.deleteMany({ where: { merchantId: { in: merchants } } });
    await prisma.merchant.deleteMany({ where: { id: { in: merchants } } });
  }
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  await prisma.$disconnect();
});

async function request(path: string, token: string | undefined, method = "GET", body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { response, json: await response.json() as ApiBody };
}

test("Merchant can submit a scoped report and Admin can review it without enforcement side effects", async () => {
  const created = await request("/api/merchant/abuse-reports", merchantAToken, "POST", {
    memberId: memberAId, orderId: orderAId, reason: "Repeated suspicious refund attempts",
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.json.report?.merchantId, merchantAId);
  assert.equal(created.json.report?.reporterId, merchantAOwnerId);
  assert.equal(created.json.report?.memberId, memberAId);
  assert.equal(created.json.report?.orderId, orderAId);
  assert.equal(created.json.report?.reason, "Repeated suspicious refund attempts");

  const list = await request("/api/admin/abuse-reports?merchantId=" + merchantAId, adminToken);
  assert.equal(list.response.status, 200);
  assert.ok(list.json.items?.some((item) => item.id === created.json.report?.id));
  assert.equal(typeof list.json.nextCursor === "string" || list.json.nextCursor === null, true);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: memberAId } })).accountStatus, "ACTIVE");
});

test("Merchant reports reject members, unauthenticated callers, and foreign targets", async () => {
  assert.equal((await request("/api/merchant/abuse-reports", undefined, "POST", { memberId: memberAId, reason: "test" })).response.status, 401);
  assert.equal((await request("/api/merchant/abuse-reports", memberToken, "POST", { memberId: memberAId, reason: "test" })).response.status, 403);
  assert.equal((await request("/api/merchant/abuse-reports", merchantAToken, "POST", { memberId: memberBId, reason: "test" })).response.status, 404);
  assert.equal((await request("/api/merchant/abuse-reports", merchantAToken, "POST", { memberId: memberAId, orderId: orderAId + 99999, reason: "test" })).response.status, 404);
});

test("Admin reports are read-only and hidden from non-admin roles", async () => {
  assert.equal((await request("/api/admin/abuse-reports", merchantAToken)).response.status, 403);
  assert.equal((await request("/api/admin/abuse-reports", memberToken)).response.status, 403);
  assert.equal((await request("/api/admin/abuse-reports", undefined)).response.status, 401);
  assert.equal((await request("/api/admin/abuse-reports", adminToken, "POST", { id: 1 })).response.status, 404);
});

test("Abuse report input rejects invalid IDs, reason, and unknown fields", async () => {
  const cases: unknown[] = [
    { memberId: 0, reason: "x" },
    { memberId: memberAId, reason: "  " },
    { memberId: memberAId, reason: "valid", unexpected: true },
  ];
  for (const body of cases) {
    assert.equal((await request("/api/merchant/abuse-reports", merchantAToken, "POST", body)).response.status, 400);
  }
});
