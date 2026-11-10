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
const secondMemberEmail = `m4-member-b-${suffix}@test.local`;
let server: Server | undefined;
let baseUrl: string;
let merchantAId: number;
let merchantBId: number;
let merchantAToken: string;
let merchantBToken: string;
let memberToken: string;
let secondMemberToken: string;
let fixturesCreated = false;

before(async () => {
  const [ownerA, ownerB, member, secondMember] = await Promise.all([
    prisma.user.create({ data: { email: merchantAEmail, passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: merchantBEmail, passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: memberEmail, passwordHash: "fixture", role: "MEMBER" } }),
    prisma.user.create({ data: { email: secondMemberEmail, passwordHash: "fixture", role: "MEMBER" } }),
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
  secondMemberToken = await signAccessToken(secondMember.id);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server!.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  if (!fixturesCreated) return;
  const users = await prisma.user.findMany({ where: { email: { in: [merchantAEmail, merchantBEmail, memberEmail, secondMemberEmail] } }, select: { id: true } });
  const memberIds = users.filter((user) => user.id !== undefined).map((user) => user.id);
  const memberships = await prisma.merchantMembership.findMany({ where: { memberId: { in: memberIds } }, select: { id: true } });
  const membershipIds = memberships.map((membership) => membership.id);
  const wallets = await prisma.loyaltyWallet.findMany({ where: { membershipId: { in: membershipIds } }, select: { id: true } });
  await prisma.pointTransaction.deleteMany({ where: { walletId: { in: wallets.map((wallet) => wallet.id) } } });
  await prisma.loyaltyWallet.deleteMany({ where: { membershipId: { in: membershipIds } } });
  await prisma.merchantMembership.deleteMany({ where: { id: { in: membershipIds } } });
  const orders = await prisma.order.findMany({ where: { memberId: { in: memberIds } }, select: { id: true } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: orders.map((order) => order.id) } } });
  await prisma.order.deleteMany({ where: { id: { in: orders.map((order) => order.id) } } });
  await prisma.product.deleteMany({ where: { merchantId: { in: [merchantAId, merchantBId] } } });
  await prisma.loyaltyTier.deleteMany({ where: { merchantId: { in: [merchantAId, merchantBId] } } });
  await prisma.loyaltyRule.deleteMany({ where: { merchantId: { in: [merchantAId, merchantBId] } } });
  await prisma.merchant.deleteMany({ where: { id: { in: [merchantAId, merchantBId] } } });
  await prisma.user.deleteMany({ where: { email: { in: [merchantAEmail, merchantBEmail, memberEmail, secondMemberEmail] } } });
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

test("member becomes Bronze and earns points only after a paid order at that merchant", async () => {
  const beforeA = await request(`/api/member/merchants/${merchantAId}/wallet`, "GET", memberToken);
  assert.equal(beforeA.response.status, 200);
  assert.equal(beforeA.json.wallet.availablePoints, 0);
  assert.equal(beforeA.json.wallet.tier, "UNRANKED");
  assert.equal(beforeA.json.wallet.policy.merchantId, merchantAId);
  assert.equal(beforeA.json.wallet.policy.vndPerPoint, 10000);

  const beforeB = await request(`/api/member/merchants/${merchantBId}/wallet`, "GET", memberToken);
  assert.equal(beforeB.json.wallet.tier, "UNRANKED");
  assert.equal(beforeB.json.wallet.policy.merchantId, merchantBId);
  assert.equal(beforeB.json.wallet.policy.vndPerPoint, 5000);
  const product = await request("/api/merchant/products", "POST", merchantAToken, { name: "M4 Coffee", price: "200000" });
  assert.equal(product.response.status, 201);
  const created = await request("/api/orders", "POST", memberToken, { productId: product.json.product.id, quantity: 1 });
  assert.equal(created.response.status, 201);
  const paid = await request(`/api/orders/${created.json.order.id}/pay`, "POST", memberToken);
  assert.equal(paid.response.status, 200);
  assert.equal(paid.json.order.status, "PAID");

  const [walletA, walletB] = await Promise.all([
    request(`/api/member/merchants/${merchantAId}/wallet`, "GET", memberToken),
    request(`/api/member/merchants/${merchantBId}/wallet`, "GET", memberToken),
  ]);
  assert.equal(walletA.json.wallet.availablePoints, 20);
  assert.equal(walletA.json.wallet.lifetimeEarnedPoints, 20);
  assert.equal(walletA.json.wallet.tier, "BRONZE");
  assert.equal(walletA.json.wallet.transactions.length, 1);
  assert.equal(walletA.json.wallet.transactions[0].orderId, created.json.order.id);
  assert.equal(walletB.json.wallet.availablePoints, 0);
  assert.equal(walletB.json.wallet.tier, "UNRANKED");

  const again = await request(`/api/orders/${created.json.order.id}/pay`, "POST", memberToken);
  assert.equal(again.response.status, 409);
  const afterAgain = await request(`/api/member/merchants/${merchantAId}/wallet`, "GET", memberToken);
  assert.equal(afterAgain.json.wallet.transactions.length, 1);
});

test("only one concurrent payment of the same order earns points once", async () => {
  const walletBefore = await request(`/api/member/merchants/${merchantAId}/wallet`, "GET", memberToken);
  const product = await request("/api/merchant/products", "POST", merchantAToken, { name: "Concurrent Same", price: "200000" });
  const order = await request("/api/orders", "POST", memberToken, { productId: product.json.product.id, quantity: 1 });
  const responses = await Promise.all([
    request(`/api/orders/${order.json.order.id}/pay`, "POST", memberToken),
    request(`/api/orders/${order.json.order.id}/pay`, "POST", memberToken),
  ]);
  assert.deepEqual(responses.map((result) => result.response.status).sort(), [200, 409]);
  const wallet = await request(`/api/member/merchants/${merchantAId}/wallet`, "GET", memberToken);
  assert.equal(wallet.json.wallet.availablePoints, walletBefore.json.wallet.availablePoints + 20);
  assert.equal(wallet.json.wallet.transactions.filter((transaction: { orderId: number }) => transaction.orderId === order.json.order.id).length, 1);
});

test("paid orders keep the tier reached by that order, even after another promotion", async () => {
  const large = await request("/api/merchant/products", "POST", merchantBToken, { name: "Tier jump", price: "25000000" });
  const small = await request("/api/merchant/products", "POST", merchantBToken, { name: "Same tier", price: "10000" });
  assert.equal(large.response.status, 201);
  assert.equal(small.response.status, 201);

  async function pay(productId: number) {
    const order = await request("/api/orders", "POST", secondMemberToken, { productId, quantity: 1 });
    assert.equal(order.response.status, 201);
    const paid = await request(`/api/orders/${order.json.order.id}/pay`, "POST", secondMemberToken);
    assert.equal(paid.response.status, 200);
    return paid.json.order;
  }

  const gold = await pay(large.json.product.id);
  assert.equal(gold.earnedPoints, 5000);
  assert.equal(gold.promotedToTier, "GOLD");
  assert.equal((await pay(small.json.product.id)).promotedToTier, null);
  assert.equal((await pay(large.json.product.id)).promotedToTier, "PLATINUM");
  const receipt = await request(`/api/member/orders/${gold.id}`, "GET", secondMemberToken);
  assert.equal(receipt.response.status, 200);
  assert.equal(receipt.json.order.earnedPoints, 5000);
  assert.equal(receipt.json.order.promotedToTier, "GOLD");
});

test("concurrent paid orders serialize the wallet balance and preserve member isolation", async () => {
  const walletBefore = await request(`/api/member/merchants/${merchantAId}/wallet`, "GET", memberToken);
  const product = await request("/api/merchant/products", "POST", merchantAToken, { name: "Concurrent Different", price: "200000" });
  const [first, second] = await Promise.all([
    request("/api/orders", "POST", memberToken, { productId: product.json.product.id, quantity: 1 }),
    request("/api/orders", "POST", memberToken, { productId: product.json.product.id, quantity: 1 }),
  ]);
  const payments = await Promise.all([
    request(`/api/orders/${first.json.order.id}/pay`, "POST", memberToken),
    request(`/api/orders/${second.json.order.id}/pay`, "POST", memberToken),
  ]);
  assert.deepEqual(payments.map((result) => result.response.status), [200, 200]);
  const wallet = await request(`/api/member/merchants/${merchantAId}/wallet`, "GET", memberToken);
  assert.equal(wallet.json.wallet.availablePoints, walletBefore.json.wallet.availablePoints + 40);
  assert.equal(wallet.json.wallet.lifetimeEarnedPoints, walletBefore.json.wallet.lifetimeEarnedPoints + 40);
  const orderIds = new Set([first.json.order.id, second.json.order.id]);
  const balances = wallet.json.wallet.transactions.filter((transaction: { orderId: number }) => orderIds.has(transaction.orderId)).map((transaction: { balanceAfter: number }) => transaction.balanceAfter).sort((a: number, b: number) => a - b);
  assert.deepEqual(balances, [walletBefore.json.wallet.availablePoints + 20, walletBefore.json.wallet.availablePoints + 40]);

  const foreignPay = await request(`/api/orders/${first.json.order.id}/pay`, "POST", secondMemberToken);
  assert.equal(foreignPay.response.status, 404);
  const foreignWallet = await request(`/api/member/merchants/${merchantAId}/wallet`, "GET", secondMemberToken);
  assert.equal(foreignWallet.json.wallet.availablePoints, 0);
  assert.equal(foreignWallet.json.wallet.tier, "UNRANKED");
  assert.deepEqual(foreignWallet.json.wallet.transactions, []);
});

test("a sub-threshold first paid order creates Bronze without inventing points", async () => {
  const product = await request("/api/merchant/products", "POST", merchantAToken, { name: "Under Threshold", price: "9999" });
  const order = await request("/api/orders", "POST", secondMemberToken, { productId: product.json.product.id, quantity: 1 });
  const paid = await request(`/api/orders/${order.json.order.id}/pay`, "POST", secondMemberToken);
  assert.equal(paid.response.status, 200);
  const wallet = await request(`/api/member/merchants/${merchantAId}/wallet`, "GET", secondMemberToken);
  assert.equal(wallet.json.wallet.tier, "BRONZE");
  assert.equal(wallet.json.wallet.availablePoints, 0);
  assert.equal(wallet.json.wallet.transactions.at(-1).delta, 0);
});

test("rejects a paid order that would overflow the stored points balance", async () => {
  const product = await request("/api/merchant/products", "POST", merchantAToken, { name: "Overflow", price: "200000" });
  const order = await request("/api/orders", "POST", memberToken, { productId: product.json.product.id, quantity: 1 });
  const membership = await prisma.merchantMembership.findUniqueOrThrow({ where: { memberId_merchantId: { memberId: (await prisma.user.findUniqueOrThrow({ where: { email: memberEmail } })).id, merchantId: merchantAId } } });
  const wallet = await prisma.loyaltyWallet.findUniqueOrThrow({ where: { membershipId: membership.id } });
  await prisma.loyaltyWallet.update({ where: { id: wallet.id }, data: { availablePoints: 2147483647, lifetimeEarnedPoints: 2147483647 } });
  const paid = await request(`/api/orders/${order.json.order.id}/pay`, "POST", memberToken);
  assert.equal(paid.response.status, 409);
  assert.equal(paid.json.error, "LOYALTY_LIMIT_EXCEEDED");
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.json.order.id } })).status, "PENDING");
});

test("rejects an order whose earned points exceed the stored Int range", async () => {
  const product = await request("/api/merchant/products", "POST", merchantAToken, {
    name: "Too Many Points",
    price: "999999999999999",
  });
  const order = await request("/api/orders", "POST", memberToken, { productId: product.json.product.id, quantity: 1 });
  const paid = await request(`/api/orders/${order.json.order.id}/pay`, "POST", memberToken);
  assert.equal(paid.response.status, 409);
  assert.equal(paid.json.error, "LOYALTY_LIMIT_EXCEEDED");
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.json.order.id } })).status, "PENDING");
});
