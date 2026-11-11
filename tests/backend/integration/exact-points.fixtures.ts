import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { Server } from "node:http";

process.env.JWT_SECRET ??= randomBytes(32).toString("hex");
process.env.PAYMENT_MODE = "mock";
process.env.VNPAY_TMN_CODE = "TESTCODE";
process.env.VNPAY_HASH_SECRET = "test-exact-points-hash-secret";
process.env.VNPAY_RETURN_URL = "https://merchant.example/api/payments/vnpay/return";

export const [{ app }, { prisma }, { signAccessToken }, { signVnpay }, { env }, { Prisma }] = await Promise.all([
  import("../../../apps/backend/src/app.js"),
  import("../../../apps/backend/src/lib/prisma.js"),
  import("../../../apps/backend/src/lib/access-token.js"),
  import("../../../apps/backend/src/modules/payments/vnpay-signature.js"),
  import("../../../apps/backend/src/config/env.js"),
  import("../../../apps/backend/src/generated/prisma/client.js"),
]);

export interface Wallet {
  availablePoints: number;
  lifetimeEarnedPoints: number;
  exactBalance: string;
  fractionalCarry: string;
  pointDebt: string;
  netLifetimeEarned: string;
  tier: string;
  transactions: {
    id: number; orderId: number | null; delta: string; balanceAfter: string;
    availablePointsAfter: number; fractionalCarryAfter: string; pointDebtAfter: string;
  }[];
}

interface Order {
  id: number; total: string; earnedPoints: number | null; earnedPointsExact: string | null;
}

export interface Shop { id: number; token: string; productId: number }
export interface Member { id: number; token: string }
const fixtureUserIds: number[] = [];
let server: Server | undefined;
let baseUrl: string;

export async function start() {
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server!.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
}

export async function cleanup() {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  try {
    const memberships = await prisma.merchantMembership.findMany({ where: { memberId: { in: fixtureUserIds } }, select: { id: true } });
    const membershipIds = memberships.map(({ id }) => id);
    const merchants = await prisma.merchant.findMany({ where: { ownerId: { in: fixtureUserIds } }, select: { id: true } });
    const merchantIds = merchants.map(({ id }) => id);
    await prisma.paymentAttempt.deleteMany({ where: { order: { memberId: { in: fixtureUserIds } } } });
    await prisma.rewardFulfillment.deleteMany({ where: { voucher: { membershipId: { in: membershipIds } } } });
    await prisma.pointTransaction.deleteMany({ where: { wallet: { membershipId: { in: membershipIds } } } });
    await prisma.orderItem.deleteMany({ where: { order: { memberId: { in: fixtureUserIds } } } });
    await prisma.order.deleteMany({ where: { memberId: { in: fixtureUserIds } } });
    await prisma.memberVoucher.deleteMany({ where: { membershipId: { in: membershipIds } } });
    await prisma.loyaltyWallet.deleteMany({ where: { membershipId: { in: membershipIds } } });
    await prisma.merchantMembership.deleteMany({ where: { id: { in: membershipIds } } });
    await prisma.voucherDefinition.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.product.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.loyaltyTier.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.loyaltyRule.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.merchant.deleteMany({ where: { id: { in: merchantIds } } });
    await prisma.user.deleteMany({ where: { id: { in: fixtureUserIds } } });
  } finally {
    await prisma.$disconnect();
  }
}

export async function request<T>(path: string, method = "GET", token?: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, json: await response.json() as T };
}

async function createUser(role: "MEMBER" | "MERCHANT") {
  const user = await prisma.user.create({ data: { email: `exact-${randomUUID()}@test.local`, passwordHash: "fixture", role } });
  fixtureUserIds.push(user.id);
  return { id: user.id, token: await signAccessToken(user.id) };
}

export const createMember = () => createUser("MEMBER");

export async function createShop(price = "6000", multiplier = "1.00"): Promise<Shop> {
  const owner = await createUser("MERCHANT");
  const shop = await prisma.merchant.create({ data: { ownerId: owner.id, name: "Exact points shop", slug: `exact-${randomUUID()}` } });
  const product = await prisma.product.create({ data: { merchantId: shop.id, name: "Exact points product", price } });
  const result = { id: shop.id, token: owner.token, productId: product.id };
  await savePolicy(result, { bronzeMultiplier: multiplier });
  return result;
}

export async function savePolicy(shop: Shop, changes: { rate?: number; active?: boolean; silverThreshold?: number; bronzeMultiplier?: string } = {}) {
  const result = await request("/api/merchant/loyalty", "PUT", shop.token, {
    vndPerPoint: changes.rate ?? 10000,
    isActive: changes.active ?? true,
    tiers: [
      { level: "BRONZE", minLifetimePoints: 0, multiplier: changes.bronzeMultiplier ?? "1.00" },
      { level: "SILVER", minLifetimePoints: changes.silverThreshold ?? 1000, multiplier: "1.50" },
      { level: "GOLD", minLifetimePoints: 5000, multiplier: "1.80" },
      { level: "PLATINUM", minLifetimePoints: 10000, multiplier: "2.00" },
    ],
  });
  assert.equal(result.status, 200);
}

export async function createOrder(shop: Shop, member: Member, voucherId?: number) {
  const result = await request<{ order: Order }>("/api/orders", "POST", member.token, {
    productId: shop.productId, quantity: 1, ...(voucherId === undefined ? {} : { voucherId }),
  });
  assert.equal(result.status, 201);
  return result.json.order;
}

export async function pay(shop: Shop, member: Member, voucherId?: number) {
  const order = await createOrder(shop, member, voucherId);
  const result = await request<{ order: Order }>(`/api/orders/${order.id}/pay`, "POST", member.token);
  assert.equal(result.status, 200);
  return result.json.order;
}

export async function wallet(shop: Shop, member: Member) {
  const result = await request<{ wallet: Wallet }>(`/api/member/merchants/${shop.id}/wallet`, "GET", member.token);
  assert.equal(result.status, 200);
  return result.json.wallet;
}

export async function assertLedger(shop: Shop, member: Member, exactBalance: string) {
  const stored = await prisma.loyaltyWallet.findFirstOrThrow({ where: { membership: { memberId: member.id, merchantId: shop.id } }, include: { transactions: { orderBy: { id: "asc" } } } });
  assert.equal(stored.exactBalance.toFixed(), exactBalance);
  let total = new Prisma.Decimal(0);
  for (const entry of stored.transactions) {
    total = total.plus(entry.delta);
    assert.equal(entry.balanceAfter.toFixed(), total.toFixed());
  }
  assert.equal(total.toFixed(), exactBalance);
  return stored;
}

export async function beginVnpay(shop: Shop, member: Member) {
  const order = await createOrder(shop, member);
  const attempt = await request<{ txnRef: string }>(`/api/orders/${order.id}/payments/vnpay`, "POST", member.token);
  assert.equal(attempt.status, 201);
  return { order, txnRef: attempt.json.txnRef };
}

export async function confirmVnpay(payment: { txnRef: string; order: Order }, extra: Record<string, string> = {}) {
  const values = {
    vnp_Amount: new Prisma.Decimal(payment.order.total).times(100).toFixed(0),
    vnp_BankCode: "NCB", vnp_OrderInfo: "Exact points payment", vnp_PayDate: "20261111123000",
    vnp_ResponseCode: "00", vnp_TmnCode: "TESTCODE", vnp_TransactionNo: "123456789",
    vnp_TransactionStatus: "00", vnp_TxnRef: payment.txnRef,
    ...extra,
  };
  const query = new URLSearchParams({ ...values, vnp_SecureHash: signVnpay(values, process.env.VNPAY_HASH_SECRET!) });
  const result = await request<{ RspCode: string }>(`/api/payments/vnpay/ipn?${query}`);
  assert.equal(result.status, 200);
  return result.json.RspCode;
}
