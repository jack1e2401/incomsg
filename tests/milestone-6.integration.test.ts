import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import type { Server } from "node:http";

process.env.JWT_SECRET ??= randomBytes(32).toString("hex");
process.env.PAYMENT_MODE = "vnpay";
process.env.VNPAY_TMN_CODE = "TESTCODE";
process.env.VNPAY_HASH_SECRET = "test-vnpay-hash-secret-long-enough";
process.env.VNPAY_RETURN_URL = "https://merchant.example/api/payments/vnpay/return";
process.env.VNPAY_IPN_URL = "https://merchant.example/api/payments/vnpay/ipn";

const [{ app }, { prisma }, { signAccessToken }, { signVnpay }] = await Promise.all([
  import("../src/app.js"), import("../src/lib/prisma.js"), import("../src/lib/access-token.js"),
  import("../src/modules/payments/vnpay-signature.js"),
]);
const suffix = randomUUID();
const emails = [`m6-owner-${suffix}@test.local`, `m6-member-${suffix}@test.local`, `m6-other-${suffix}@test.local`];
let server: Server | undefined;
let baseUrl: string;
let merchantId: number;
let productId: number;
let memberId: number;
let memberToken: string;
let otherToken: string;
let fixtureUserIds: number[] = [];

before(async () => {
  const [owner, member, other] = await Promise.all([
    prisma.user.create({ data: { email: emails[0], passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: emails[1], passwordHash: "fixture", role: "MEMBER" } }),
    prisma.user.create({ data: { email: emails[2], passwordHash: "fixture", role: "MEMBER" } }),
  ]);
  fixtureUserIds = [owner.id, member.id, other.id];
  memberId = member.id;
  const merchant = await prisma.merchant.create({ data: { ownerId: owner.id, name: "M6 Shop", slug: `m6-${suffix}` } });
  merchantId = merchant.id;
  productId = (await prisma.product.create({ data: { merchantId, name: "M6 Product", price: "120000" } })).id;
  memberToken = await signAccessToken(member.id);
  otherToken = await signAccessToken(other.id);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server!.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  if (!fixtureUserIds.length) return;
  await prisma.paymentAttempt.deleteMany({ where: { order: { memberId: { in: fixtureUserIds } } } });
  const memberships = await prisma.merchantMembership.findMany({ where: { memberId: { in: fixtureUserIds } }, select: { id: true } });
  const membershipIds = memberships.map((item) => item.id);
  const wallets = await prisma.loyaltyWallet.findMany({ where: { membershipId: { in: membershipIds } }, select: { id: true } });
  await prisma.rewardFulfillment.deleteMany({ where: { voucher: { membershipId: { in: membershipIds } } } });
  await prisma.pointTransaction.deleteMany({ where: { walletId: { in: wallets.map((item) => item.id) } } });
  await prisma.orderItem.deleteMany({ where: { order: { memberId: { in: fixtureUserIds } } } });
  await prisma.order.deleteMany({ where: { memberId: { in: fixtureUserIds } } });
  await prisma.memberVoucher.deleteMany({ where: { membershipId: { in: membershipIds } } });
  await prisma.loyaltyWallet.deleteMany({ where: { membershipId: { in: membershipIds } } });
  await prisma.merchantMembership.deleteMany({ where: { id: { in: membershipIds } } });
  const merchants = await prisma.merchant.findMany({ where: { ownerId: { in: fixtureUserIds } }, select: { id: true } });
  const merchantIds = merchants.map((item) => item.id);
  await prisma.product.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.loyaltyTier.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.loyaltyRule.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.merchant.deleteMany({ where: { id: { in: merchantIds } } });
  await prisma.user.deleteMany({ where: { id: { in: fixtureUserIds } } });
  await prisma.$disconnect();
});

async function request(path: string, method = "GET", token?: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    redirect: "manual",
  });
  const text = await response.text();
  return { response, json: text ? JSON.parse(text) as Record<string, any> : {} };
}

async function createOrder() {
  const created = await request("/api/orders", "POST", memberToken, { productId, quantity: 1 });
  assert.equal(created.response.status, 201);
  return created.json.order;
}

function signedIpn(txnRef: string, amount: string, extra: Record<string, string> = {}) {
  const values = {
    vnp_Amount: amount,
    vnp_BankCode: "NCB",
    vnp_OrderInfo: "Thanh toan don hang",
    vnp_PayDate: "20261109123000",
    vnp_ResponseCode: "00",
    vnp_TmnCode: "TESTCODE",
    vnp_TransactionNo: "123456789",
    vnp_TransactionStatus: "00",
    vnp_TxnRef: txnRef,
    ...extra,
  };
  const signature = signVnpay(values, process.env.VNPAY_HASH_SECRET!);
  const query = new URLSearchParams({ ...values, vnp_SecureHash: signature });
  return query;
}

test("creates a server-priced sandbox URL and keeps status scoped to the member", async () => {
  const order = await createOrder();
  const created = await request(`/api/orders/${order.id}/payments/vnpay`, "POST", memberToken);
  assert.equal(created.response.status, 201);
  const url = new URL(created.json.paymentUrl);
  assert.equal(url.hostname, "sandbox.vnpayment.vn");
  assert.equal(url.searchParams.get("vnp_Amount"), "12000000");
  assert.equal(url.searchParams.get("vnp_TmnCode"), "TESTCODE");
  assert.equal(url.searchParams.get("vnp_TxnRef"), created.json.txnRef);
  assert.equal(url.searchParams.get("vnp_SecureHash"), signVnpay(Object.fromEntries([...url.searchParams].filter(([key]) => key !== "vnp_SecureHash")), process.env.VNPAY_HASH_SECRET!));
  const repeated = await request(`/api/orders/${order.id}/payments/vnpay`, "POST", memberToken);
  assert.equal(repeated.json.txnRef, created.json.txnRef);
  assert.equal((await request(`/api/orders/${order.id}/payment-status`, "GET", otherToken)).response.status, 404);
  assert.equal((await request(`/api/orders/${order.id}/pay`, "POST", memberToken)).json.error, "USE_VNPAY_PAYMENT");
  const unsignedReturn = await request(`/api/payments/vnpay/return?vnp_TxnRef=${created.json.txnRef}`);
  assert.equal(unsignedReturn.response.headers.get("location"), "http://localhost:5173/");
  const signedReturnQuery = signedIpn(created.json.txnRef, "12000000");
  const beforeIpn = await request(`/api/payments/vnpay/return?${signedReturnQuery}`);
  assert.equal(beforeIpn.response.status, 302);
  assert.equal(beforeIpn.response.headers.get("location"), `http://localhost:5173/member/${merchantId}/orders/${order.id}`);
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status, "PENDING");
});

test("only a signed successful IPN confirms the order and duplicate IPN is idempotent", async () => {
  const order = await createOrder();
  const created = await request(`/api/orders/${order.id}/payments/vnpay`, "POST", memberToken);
  const ipn = signedIpn(created.json.txnRef, "12000000");
  const [first, simultaneous] = await Promise.all([
    request(`/api/payments/vnpay/ipn?${ipn}`),
    request(`/api/payments/vnpay/ipn?${ipn}`),
  ]);
  assert.deepEqual([first.json.RspCode, simultaneous.json.RspCode].sort(), ["00", "02"]);
  const paid = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  assert.equal(paid.status, "PAID");
  assert.equal(await prisma.pointTransaction.count({ where: { orderId: order.id } }), 1);
  const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { orderId: order.id } });
  assert.equal(attempt.status, "SUCCEEDED");
});

test("tampered or mismatched IPN never confirms; failed payment is terminal", async () => {
  const order = await createOrder();
  const created = await request(`/api/orders/${order.id}/payments/vnpay`, "POST", memberToken);
  const invalidSignature = signedIpn(created.json.txnRef, "12000000");
  invalidSignature.set("vnp_Amount", "12000001");
  assert.equal((await request(`/api/payments/vnpay/ipn?${invalidSignature}`)).json.RspCode, "97");
  assert.equal((await request(`/api/payments/vnpay/ipn?${signedIpn(created.json.txnRef, "12000001")}`)).json.RspCode, "04");
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status, "PENDING");

  const failed = signedIpn(created.json.txnRef, "12000000", { vnp_ResponseCode: "24", vnp_TransactionStatus: "02" });
  assert.equal((await request(`/api/payments/vnpay/ipn?${failed}`)).json.RspCode, "00");
  assert.equal((await request(`/api/payments/vnpay/ipn?${failed}`)).json.RspCode, "02");
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status, "PENDING");
  assert.equal((await prisma.paymentAttempt.findUniqueOrThrow({ where: { orderId: order.id } })).status, "FAILED");
  assert.equal(await prisma.pointTransaction.count({ where: { orderId: order.id } }), 0);
});
