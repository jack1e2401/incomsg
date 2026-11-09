import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import type { Server } from "node:http";

process.env.JWT_SECRET ??= randomBytes(32).toString("hex");

const [{ app }, { prisma }, { signAccessToken }] = await Promise.all([
  import("../src/app.js"),
  import("../src/lib/prisma.js"),
  import("../src/lib/access-token.js"),
]);

const suffix = randomUUID();
const merchantAEmail = `m4-merchant-a-${suffix}@test.local`;
const merchantBEmail = `m4-merchant-b-${suffix}@test.local`;
const memberEmail = `m4-member-${suffix}@test.local`;
let server: Server | undefined;
let baseUrl: string;
let merchantAId: number;
let merchantBId: number;
let merchantAToken: string;
let merchantBToken: string;
let memberToken: string;
let fixturesCreated = false;

before(async () => {
  const [ownerA, ownerB, member] = await Promise.all([
    prisma.user.create({ data: { email: merchantAEmail, passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: merchantBEmail, passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: memberEmail, passwordHash: "fixture", role: "MEMBER" } }),
  ]);
  const [merchantA, merchantB] = await Promise.all([
    prisma.merchant.create({ data: { ownerId: ownerA.id, name: "M4 A", slug: `m4-a-${suffix}` } }),
    prisma.merchant.create({ data: { ownerId: ownerB.id, name: "M4 B", slug: `m4-b-${suffix}` } }),
  ]);
  fixturesCreated = true;
  merchantAId = merchantA.id;
  merchantBId = merchantB.id;
  merchantAToken = await signAccessToken(ownerA.id);
  merchantBToken = await signAccessToken(ownerB.id);
  memberToken = await signAccessToken(member.id);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server!.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  if (!fixturesCreated) return;
  await prisma.loyaltyTier.deleteMany({ where: { merchantId: { in: [merchantAId, merchantBId] } } });
  await prisma.loyaltyRule.deleteMany({ where: { merchantId: { in: [merchantAId, merchantBId] } } });
  await prisma.merchant.deleteMany({ where: { id: { in: [merchantAId, merchantBId] } } });
  await prisma.user.deleteMany({ where: { email: { in: [merchantAEmail, merchantBEmail, memberEmail] } } });
  await prisma.$disconnect();
});

async function request(path: string, method: string, token?: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { response, json: await response.json() as Record<string, any> };
}

test("merchant can save only a valid loyalty configuration for its own store", async () => {
  const tiers = [
    { level: "BRONZE", minLifetimePoints: 0, multiplier: "1.00" },
    { level: "SILVER", minLifetimePoints: 1000, multiplier: "1.20" },
    { level: "GOLD", minLifetimePoints: 5000, multiplier: "1.50" },
    { level: "PLATINUM", minLifetimePoints: 10000, multiplier: "2.00" },
  ];
  const saved = await request("/api/merchant/loyalty", "PUT", merchantAToken, { vndPerPoint: 10000, isActive: true, tiers });
  assert.equal(saved.response.status, 200);
  assert.equal(saved.json.config.merchantId, merchantAId);
  assert.equal(saved.json.config.tiers.length, 4);

  const foreign = await request("/api/merchant/loyalty", "PUT", merchantBToken, {
    vndPerPoint: 5000,
    isActive: true,
    tiers,
  });
  assert.equal(foreign.response.status, 200);
  assert.equal(foreign.json.config.merchantId, merchantBId);

  for (const invalid of [
    { vndPerPoint: 0, isActive: true, tiers },
    { vndPerPoint: 10000, isActive: true, tiers: tiers.slice(1) },
    { vndPerPoint: 10000, isActive: true, tiers: tiers.map((tier, i) => ({ ...tier, minLifetimePoints: [0, 1000, 900, 10000][i] })) },
    { vndPerPoint: 10000, isActive: true, tiers: tiers.map((tier, i) => i === 0 ? { ...tier, multiplier: "0.00" } : tier) },
  ]) {
    const result = await request("/api/merchant/loyalty", "PUT", merchantAToken, invalid);
    assert.equal(result.response.status, 400);
    assert.equal(result.json.error, "INVALID_INPUT");
  }

  const member = await request("/api/merchant/loyalty", "PUT", memberToken, { vndPerPoint: 10000, isActive: true, tiers });
  assert.equal(member.response.status, 403);
  const own = await request("/api/merchant/loyalty", "GET", merchantAToken);
  assert.equal(own.response.status, 200);
  assert.equal(own.json.config.merchantId, merchantAId);
});
