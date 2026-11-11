import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import type { Server } from "node:http";

process.env.JWT_SECRET ??= randomBytes(32).toString("hex");
process.env.PAYMENT_MODE = "vnpay";
process.env.VNPAY_TMN_CODE = "TESTCODE";
process.env.VNPAY_HASH_SECRET = "test-vnpay-hash-secret-long-enough";
process.env.VNPAY_RETURN_URL = "https://merchant.example/api/payments/vnpay/return";

const [{ app }, { prisma }, { signAccessToken }, { signVnpay }, { env }] = await Promise.all([
  import("../../../apps/backend/src/app.js"), import("../../../apps/backend/src/lib/prisma.js"), import("../../../apps/backend/src/lib/access-token.js"),
  import("../../../apps/backend/src/modules/payments/vnpay-signature.js"), import("../../../apps/backend/src/config/env.js"),
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
  const merchants = await prisma.merchant.findMany({ where: { ownerId: { in: fixtureUserIds } }, select: { id: true } });
  const merchantIds = merchants.map((item) => item.id);
  await prisma.voucherDefinition.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.loyaltyWallet.deleteMany({ where: { membershipId: { in: membershipIds } } });
  await prisma.merchantMembership.deleteMany({ where: { id: { in: membershipIds } } });
  await prisma.product.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.loyaltyTier.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.loyaltyRule.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.merchant.deleteMany({ where: { id: { in: merchantIds } } });
  await prisma.user.deleteMany({ where: { id: { in: fixtureUserIds } } });
  await prisma.$disconnect();
});

async function request(path: string, method = "GET", token?: string, body?: unknown, options: { headers?: Record<string, string> } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}), ...options.headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    redirect: "manual",
  });
  const text = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  const json = contentType.includes("application/json") && text
    ? JSON.parse(text) as Record<string, any>
    : {};
  return { response, json, text };
}

async function createOrder() {
  return createOrderFor(memberToken);
}

async function createOrderFor(token: string) {
  const created = await request("/api/orders", "POST", token, { productId, quantity: 1 });
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
  assert.equal(url.searchParams.has("vnp_IpnUrl"), false);
  assert.equal(url.searchParams.get("vnp_SecureHash"), signVnpay(Object.fromEntries([...url.searchParams].filter(([key]) => key !== "vnp_SecureHash")), process.env.VNPAY_HASH_SECRET!));
  env.paymentMode = "mock";
  const mockRace = await request(`/api/orders/${order.id}/pay`, "POST", memberToken);
  assert.equal(mockRace.response.status, 409);
  assert.equal(mockRace.json.error, "VNPAY_ATTEMPT_EXISTS");
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status, "PENDING");
  env.paymentMode = "vnpay";
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
  const failedReservation = await prisma.paymentAttempt.findUniqueOrThrow({ where: { orderId: order.id } });
  const reservationBeforeFailure = await prisma.loyaltyWallet.findFirstOrThrow({ where: { membership: { memberId, merchantId } } });
  const invalidSignature = signedIpn(created.json.txnRef, "12000000");
  invalidSignature.set("vnp_Amount", "12000001");
  assert.equal((await request(`/api/payments/vnpay/ipn?${invalidSignature}`)).json.RspCode, "97");
  assert.equal((await request(`/api/payments/vnpay/ipn?${signedIpn(created.json.txnRef, "12000001")}`)).json.RspCode, "04");
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status, "PENDING");

  const failed = signedIpn(created.json.txnRef, "12000000", { vnp_ResponseCode: "24", vnp_TransactionStatus: "02" });
  assert.equal((await request(`/api/payments/vnpay/ipn?${failed}`)).json.RspCode, "00");
  assert.equal((await request(`/api/payments/vnpay/ipn?${failed}`)).json.RspCode, "02");
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status, "PENDING");
  const failedAttempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { orderId: order.id } });
  assert.equal(failedAttempt.status, "FAILED");
  const failedMembership = await prisma.merchantMembership.findUniqueOrThrow({ where: { memberId_merchantId: { memberId, merchantId } }, include: { wallet: true } });
  assert.equal(failedMembership.wallet?.reservedPoints.toString(), reservationBeforeFailure.reservedPoints.minus(failedReservation.reservedPoints).toString());
  assert.equal(await prisma.pointTransaction.count({ where: { orderId: order.id } }), 0);
});

test("rejects a signed foreign merchant code and unknown transaction reference", async () => {
  const order = await createOrder();
  const created = await request(`/api/orders/${order.id}/payments/vnpay`, "POST", memberToken);
  const wrongMerchant = signedIpn(created.json.txnRef, "12000000", { vnp_TmnCode: "OTHER123" });
  const unknownReference = signedIpn("unknown-txn-ref", "12000000");
  assert.equal((await request(`/api/payments/vnpay/ipn?${wrongMerchant}`)).json.RspCode, "04");
  assert.equal((await request(`/api/payments/vnpay/ipn?${unknownReference}`)).json.RspCode, "01");
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status, "PENDING");
  assert.equal((await prisma.paymentAttempt.findUniqueOrThrow({ where: { orderId: order.id } })).status, "CREATED");
});

test("incomplete transaction status stays open for a later successful IPN", async () => {
  const order = await createOrder();
  const created = await request(`/api/orders/${order.id}/payments/vnpay`, "POST", memberToken);
  const incomplete = signedIpn(created.json.txnRef, "12000000", { vnp_ResponseCode: "00", vnp_TransactionStatus: "01" });
  assert.equal((await request(`/api/payments/vnpay/ipn?${incomplete}`)).json.RspCode, "99");
  assert.equal((await prisma.paymentAttempt.findUniqueOrThrow({ where: { orderId: order.id } })).status, "CREATED");
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status, "PENDING");
  const unknownPending = signedIpn(created.json.txnRef, "12000000", { vnp_ResponseCode: "00", vnp_TransactionStatus: "09" });
  assert.equal((await request(`/api/payments/vnpay/ipn?${unknownPending}`)).json.RspCode, "99");
  assert.equal((await prisma.paymentAttempt.findUniqueOrThrow({ where: { orderId: order.id } })).status, "CREATED");
  const success = signedIpn(created.json.txnRef, "12000000");
  assert.equal((await request(`/api/payments/vnpay/ipn?${success}`)).json.RspCode, "00");
  assert.equal((await prisma.paymentAttempt.findUniqueOrThrow({ where: { orderId: order.id } })).status, "SUCCEEDED");
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status, "PAID");
  assert.equal(await prisma.pointTransaction.count({ where: { orderId: order.id } }), 1);
});

test("requires both VNPAY result codes to be successful", async () => {
  const responseFailedOrder = await createOrder();
  const responseFailedPayment = await request(`/api/orders/${responseFailedOrder.id}/payments/vnpay`, "POST", memberToken);
  const responseFailed = signedIpn(responseFailedPayment.json.txnRef, "12000000", { vnp_ResponseCode: "24", vnp_TransactionStatus: "00" });
  assert.equal((await request(`/api/payments/vnpay/ipn?${responseFailed}`)).json.RspCode, "00");
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: responseFailedOrder.id } })).status, "PENDING");
  assert.equal((await prisma.paymentAttempt.findUniqueOrThrow({ where: { orderId: responseFailedOrder.id } })).status, "FAILED");

  const statusFailedOrder = await createOrder();
  const statusFailedPayment = await request(`/api/orders/${statusFailedOrder.id}/payments/vnpay`, "POST", memberToken);
  const statusFailed = signedIpn(statusFailedPayment.json.txnRef, "12000000", { vnp_ResponseCode: "00", vnp_TransactionStatus: "02" });
  assert.equal((await request(`/api/payments/vnpay/ipn?${statusFailed}`)).json.RspCode, "00");
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: statusFailedOrder.id } })).status, "PENDING");
  assert.equal((await prisma.paymentAttempt.findUniqueOrThrow({ where: { orderId: statusFailedOrder.id } })).status, "FAILED");
  assert.equal(await prisma.pointTransaction.count({ where: { orderId: { in: [responseFailedOrder.id, statusFailedOrder.id] } } }), 0);
});

test("successful IPN consumes the discount and awards points on the net total", async () => {
  const membership = await prisma.merchantMembership.upsert({
    where: { memberId_merchantId: { memberId, merchantId } },
    create: { memberId, merchantId }, update: {},
  });
  const wallet = await prisma.loyaltyWallet.findUnique({ where: { membershipId: membership.id } });
  if (!wallet) await prisma.loyaltyWallet.create({ data: { membershipId: membership.id, exactBalance: 200, netLifetimeEarned: 200 } });
  const definition = await prisma.voucherDefinition.create({ data: {
    merchantId, type: "DISCOUNT", title: "Giảm 20.000", pointsCost: 200, discountAmount: "20000",
  } });
  const voucher = await prisma.memberVoucher.create({ data: {
    membershipId: membership.id, definitionId: definition.id, snapshotType: "DISCOUNT",
    snapshotTitle: "Giảm 20.000", snapshotPointsCost: 200, snapshotDiscountAmount: "20000",
  } });
  const orderResponse = await request("/api/orders", "POST", memberToken, { productId, quantity: 1, voucherId: voucher.id });
  assert.equal(orderResponse.response.status, 201);
  const order = orderResponse.json.order;
  assert.equal(order.total, "100000");
  const payment = await request(`/api/orders/${order.id}/payments/vnpay`, "POST", memberToken);
  const ipn = signedIpn(payment.json.txnRef, "10000000");
  assert.equal((await request(`/api/payments/vnpay/ipn?${ipn}`)).json.RspCode, "00");
  assert.equal((await prisma.memberVoucher.findUniqueOrThrow({ where: { id: voucher.id } })).status, "USED");
  assert.equal((await prisma.pointTransaction.findFirstOrThrow({ where: { orderId: order.id, type: "EARN" } })).delta.toString(), "10");
});

test("zero-total orders finalize internally without a payment attempt", async () => {
  const otherMemberId = (await prisma.user.findUniqueOrThrow({ where: { email: emails[2] } })).id;
  const membership = await prisma.merchantMembership.create({ data: { memberId: otherMemberId, merchantId } });
  await prisma.loyaltyWallet.create({ data: { membershipId: membership.id } });
  const definition = await prisma.voucherDefinition.create({ data: {
    merchantId, type: "DISCOUNT", title: "Giảm 250.000", pointsCost: 1, discountAmount: "250000",
  } });
  const voucher = await prisma.memberVoucher.create({ data: {
    membershipId: membership.id, definitionId: definition.id, snapshotType: "DISCOUNT",
    snapshotTitle: "Giảm 250.000", snapshotPointsCost: 1, snapshotDiscountAmount: "250000",
  } });
  const orderResponse = await request("/api/orders", "POST", otherToken, { productId, quantity: 1, voucherId: voucher.id });
  assert.equal(orderResponse.response.status, 201);
  const orderId = orderResponse.json.order.id as number;
  assert.equal(orderResponse.json.order.total, "0");
  const payment = await request(`/api/orders/${orderId}/payments/vnpay`, "POST", otherToken);
  assert.equal(payment.response.status, 200);
  assert.equal(payment.json.orderStatus, "PAID");
  assert.equal(await prisma.paymentAttempt.count({ where: { orderId } }), 0);
  assert.equal((await prisma.memberVoucher.findUniqueOrThrow({ where: { id: voucher.id } })).status, "USED");
  assert.equal((await prisma.pointTransaction.findFirstOrThrow({ where: { orderId, type: "EARN" } })).delta.toString(), "0");
  const finalWallet = await prisma.loyaltyWallet.findUniqueOrThrow({ where: { membershipId: membership.id } });
  const finalMembership = await prisma.merchantMembership.findUniqueOrThrow({ where: { id: membership.id }, include: { tier: true } });
  assert.equal(finalWallet.exactBalance.toString(), "0");
  assert.equal(finalMembership.tier?.level, "BRONZE");
});

test("blocks a payment redirect when the configured loyalty award exceeds the database limit", async () => {
  await prisma.loyaltyRule.upsert({
    where: { merchantId },
    create: { merchantId, vndPerPoint: 1, isActive: true },
    update: { vndPerPoint: 1, isActive: true },
  });
  const expensiveProductId = (await prisma.product.create({ data: { merchantId, name: "High point total", price: "3000000000" } })).id;
  const orderResponse = await request("/api/orders", "POST", memberToken, { productId: expensiveProductId, quantity: 1 });
  assert.equal(orderResponse.response.status, 201);
  const result = await request(`/api/orders/${orderResponse.json.order.id}/payments/vnpay`, "POST", memberToken);
  assert.equal(result.response.status, 409);
  assert.equal(result.json.error, "LOYALTY_LIMIT_EXCEEDED");
  assert.equal(await prisma.paymentAttempt.count({ where: { orderId: orderResponse.json.order.id } }), 0);
});

test("concurrent payment starts reserve shared wallet capacity and snapshot points across config changes", async () => {
  await prisma.loyaltyRule.upsert({
    where: { merchantId },
    create: { merchantId, vndPerPoint: 10000, isActive: true },
    update: { vndPerPoint: 10000, isActive: true },
  });
  const membership = await prisma.merchantMembership.upsert({
    where: { memberId_merchantId: { memberId, merchantId } },
    create: { memberId, merchantId }, update: {},
  });
  await prisma.loyaltyWallet.upsert({
    where: { membershipId: membership.id },
    create: { membershipId: membership.id, exactBalance: 2_147_483_617, netLifetimeEarned: 2_147_483_617 },
    update: { exactBalance: 2_147_483_617, netLifetimeEarned: 2_147_483_617, reservedPoints: 0 },
  });
  const orders = await Promise.all([createOrder(), createOrder()]);
  const responses = await Promise.all(orders.map((order) => request(`/api/orders/${order.id}/payments/vnpay`, "POST", memberToken)));
  assert.deepEqual(responses.map((item) => item.response.status).sort(), [201, 409]);
  const acceptedIndex = responses.findIndex((item) => item.response.status === 201);
  const rejectedIndex = 1 - acceptedIndex;
  const accepted = responses[acceptedIndex]!;
  assert.equal(responses[rejectedIndex]!.json.error, "LOYALTY_LIMIT_EXCEEDED");
  const acceptedOrderId = orders[acceptedIndex]!.id;
  const acceptedAttempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { orderId: acceptedOrderId } });
  assert.equal(acceptedAttempt.snapshotTierLevel, "PLATINUM");
  assert.equal(acceptedAttempt.snapshotMultiplier?.toString(), "2");
  assert.equal(await prisma.paymentAttempt.count({ where: { orderId: { in: orders.map((order) => order.id) } } }), 1);
  assert.equal((await prisma.loyaltyWallet.findUniqueOrThrow({ where: { membershipId: membership.id } })).reservedPoints.toString(), "24");

  await prisma.loyaltyRule.update({ where: { merchantId }, data: { vndPerPoint: 1, isActive: false } });
  const ipn = signedIpn(accepted.json.txnRef, "12000000");
  assert.equal((await request(`/api/payments/vnpay/ipn?${ipn}`)).json.RspCode, "00");
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: acceptedOrderId } })).status, "PAID");
  assert.equal((await prisma.pointTransaction.findFirstOrThrow({ where: { orderId: acceptedOrderId, type: "EARN" } })).delta.toString(), "24");
  assert.equal((await prisma.loyaltyWallet.findUniqueOrThrow({ where: { membershipId: membership.id } })).reservedPoints.toString(), "0");
});

test("new payment attempts retain their initiation tier after another order promotes the member", async () => {
  const user = await prisma.user.create({ data: { email: `m6-tier-${suffix}@test.local`, passwordHash: "fixture", role: "MEMBER" } });
  fixtureUserIds.push(user.id);
  const token = await signAccessToken(user.id);
  const membership = await prisma.merchantMembership.create({ data: { memberId: user.id, merchantId } });
  await prisma.loyaltyWallet.create({ data: { membershipId: membership.id, exactBalance: 990, netLifetimeEarned: 990 } });
  const tiers = [
    { level: "BRONZE" as const, minLifetimePoints: 0, multiplier: "1.00" },
    { level: "SILVER" as const, minLifetimePoints: 1000, multiplier: "1.20" },
    { level: "GOLD" as const, minLifetimePoints: 5000, multiplier: "1.50" },
    { level: "PLATINUM" as const, minLifetimePoints: 10000, multiplier: "2.00" },
  ];
  for (const tier of tiers) {
    await prisma.loyaltyTier.upsert({
      where: { merchantId_level: { merchantId, level: tier.level } },
      create: { merchantId, ...tier },
      update: { minLifetimePoints: tier.minLifetimePoints, multiplier: tier.multiplier },
    });
  }
  const bronze = await prisma.loyaltyTier.findUniqueOrThrow({ where: { merchantId_level: { merchantId, level: "BRONZE" } } });
  await prisma.merchantMembership.update({ where: { id: membership.id }, data: { tierId: bronze.id } });
  await prisma.loyaltyRule.upsert({ where: { merchantId }, create: { merchantId, vndPerPoint: 10000, isActive: true }, update: { vndPerPoint: 10000, isActive: true } });

  const firstOrder = await createOrderFor(token);
  const secondOrder = await createOrderFor(token);
  const firstPayment = await request(`/api/orders/${firstOrder.id}/payments/vnpay`, "POST", token);
  const secondPayment = await request(`/api/orders/${secondOrder.id}/payments/vnpay`, "POST", token);
  assert.equal((await prisma.paymentAttempt.findUniqueOrThrow({ where: { orderId: firstOrder.id } })).reservedPoints.toString(), "24");
  const secondAttempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { orderId: secondOrder.id } });
  assert.equal(secondAttempt.reservedPoints.toString(), "24");
  assert.equal(secondAttempt.snapshotTierLevel, "BRONZE");
  assert.equal(secondAttempt.snapshotMultiplier?.toString(), "1");
  assert.equal(secondAttempt.snapshotSilverMultiplier.toFixed(2), "1.20");
  const silver = await prisma.loyaltyTier.findUniqueOrThrow({ where: { merchantId_level: { merchantId, level: "SILVER" } } });
  await prisma.loyaltyTier.update({ where: { id: silver.id }, data: { multiplier: "1.80" } });
  assert.equal((await request(`/api/payments/vnpay/ipn?${signedIpn(firstPayment.json.txnRef, "12000000")}`)).json.RspCode, "00");
  assert.equal((await prisma.merchantMembership.findUniqueOrThrow({ where: { id: membership.id }, include: { tier: true } })).tier?.level, "SILVER");
  assert.equal((await request(`/api/payments/vnpay/ipn?${signedIpn(secondPayment.json.txnRef, "12000000")}`)).json.RspCode, "00");
  assert.equal((await prisma.pointTransaction.findFirstOrThrow({ where: { orderId: firstOrder.id, type: "EARN" } })).delta.toString(), "12");
  assert.equal((await prisma.pointTransaction.findFirstOrThrow({ where: { orderId: secondOrder.id, type: "EARN" } })).delta.toString(), "12");
});

test("multiplier changes apply to new attempts and not existing ones", async () => {
  const user = await prisma.user.create({ data: { email: `m6-multiplier-${suffix}@test.local`, passwordHash: "fixture", role: "MEMBER" } });
  fixtureUserIds.push(user.id);
  const token = await signAccessToken(user.id);
  await prisma.loyaltyRule.upsert({ where: { merchantId }, create: { merchantId, vndPerPoint: 10000, isActive: true }, update: { vndPerPoint: 10000, isActive: true } });
  const tiers = [
    { level: "BRONZE" as const, minLifetimePoints: 0, multiplier: "1.00" },
    { level: "SILVER" as const, minLifetimePoints: 1000, multiplier: "1.20" },
    { level: "GOLD" as const, minLifetimePoints: 5000, multiplier: "1.50" },
    { level: "PLATINUM" as const, minLifetimePoints: 10000, multiplier: "2.00" },
  ];
  for (const tier of tiers) {
    await prisma.loyaltyTier.upsert({ where: { merchantId_level: { merchantId, level: tier.level } }, create: { merchantId, ...tier }, update: { minLifetimePoints: tier.minLifetimePoints, multiplier: tier.multiplier } });
  }
  const order = await createOrderFor(token);
  const payment = await request(`/api/orders/${order.id}/payments/vnpay`, "POST", token);
  const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { orderId: order.id } });
  assert.equal(attempt.snapshotMaxMultiplier.toFixed(2), "2.00");
  assert.equal(attempt.snapshotTierConfigFallback, false);
  assert.equal(attempt.reservedPoints.toString(), "24");

  const bronze = await prisma.loyaltyTier.findUniqueOrThrow({ where: { merchantId_level: { merchantId, level: "BRONZE" } } });
  try {
    await prisma.loyaltyTier.update({ where: { id: bronze.id }, data: { multiplier: "999.99" } });
    assert.equal((await request(`/api/payments/vnpay/ipn?${signedIpn(payment.json.txnRef, "12000000")}`)).json.RspCode, "00");
    const earned = await prisma.pointTransaction.findFirstOrThrow({ where: { orderId: order.id, type: "EARN" } });
    assert.equal(earned.delta.toString(), "12");
    assert.ok(earned.delta.lessThanOrEqualTo(attempt.reservedPoints));
    const futureOrder = await createOrderFor(token);
    const futurePayment = await request(`/api/orders/${futureOrder.id}/payments/vnpay`, "POST", token);
    const futureAttempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { orderId: futureOrder.id } });
    assert.equal(futureAttempt.snapshotBronzeMultiplier.toFixed(2), "999.99");
    assert.equal((await request(`/api/payments/vnpay/ipn?${signedIpn(futurePayment.json.txnRef, "12000000")}`)).json.RspCode, "00");
    const futureEarned = await prisma.pointTransaction.findFirstOrThrow({ where: { orderId: futureOrder.id, type: "EARN" } });
    assert.equal(futureEarned.delta.toString(), "11999.88");
    assert.ok(futureEarned.delta.lessThanOrEqualTo(futureAttempt.reservedPoints));
  } finally {
    await prisma.loyaltyTier.update({ where: { id: bronze.id }, data: { multiplier: "1.00" } });
  }
});

test("legacy fallback settlement awards the exact positive reservation despite rate changes", async () => {
  const user = await prisma.user.create({ data: { email: `m6-legacy-fallback-${suffix}@test.local`, passwordHash: "fixture", role: "MEMBER" } });
  fixtureUserIds.push(user.id);
  const token = await signAccessToken(user.id);
  const threePointProductId = (await prisma.product.create({ data: { merchantId, name: "Legacy fallback 3 base points", price: "30000" } })).id;
  await prisma.loyaltyRule.upsert({
    where: { merchantId },
    create: { merchantId, vndPerPoint: 10000, isActive: true },
    update: { vndPerPoint: 10000, isActive: true },
  });
  const orderResponse = await request("/api/orders", "POST", token, { productId: threePointProductId, quantity: 1 });
  assert.equal(orderResponse.response.status, 201);
  assert.equal(orderResponse.json.order.total, "30000");
  const orderId = orderResponse.json.order.id as number;
  const payment = await request(`/api/orders/${orderId}/payments/vnpay`, "POST", token);
  assert.equal(payment.response.status, 201);
  const membership = await prisma.merchantMembership.findUniqueOrThrow({ where: { memberId_merchantId: { memberId: user.id, merchantId } }, include: { wallet: true } });
  assert.ok(membership.wallet);
  const newAttempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { orderId } });
  assert.equal(newAttempt.reservedPoints.toString(), "6");
  await prisma.$transaction([
    prisma.paymentAttempt.update({ where: { id: newAttempt.id }, data: {
      reservedPoints: 4,
      snapshotTierLevel: null,
      snapshotMultiplier: null,
      snapshotMaxMultiplier: 0,
      snapshotBronzeMultiplier: 0,
      snapshotSilverMultiplier: 0,
      snapshotGoldMultiplier: 0,
      snapshotPlatinumMultiplier: 0,
      snapshotTierConfigFallback: true,
      snapshotExactReservationAward: true,
    } }),
    prisma.loyaltyWallet.update({ where: { id: membership.wallet.id }, data: { reservedPoints: 4 } }),
  ]);
  try {
    await prisma.loyaltyRule.update({ where: { merchantId }, data: { vndPerPoint: 1, isActive: true } });
    const ipn = signedIpn(payment.json.txnRef, "3000000");
    assert.equal((await request(`/api/payments/vnpay/ipn?${ipn}`)).json.RspCode, "00");
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status, "PAID");
    assert.equal((await prisma.pointTransaction.findFirstOrThrow({ where: { orderId, type: "EARN" } })).delta.toString(), "4");
    assert.equal((await prisma.loyaltyWallet.findUniqueOrThrow({ where: { id: membership.wallet.id } })).reservedPoints.toString(), "0");
  } finally {
    await prisma.loyaltyRule.update({ where: { merchantId }, data: { vndPerPoint: 10000, isActive: true } });
  }
});

test("inactive zero-reserve legacy fallback completes without awarding reserved capacity", async () => {
  const user = await prisma.user.create({ data: { email: `m6-legacy-zero-${suffix}@test.local`, passwordHash: "fixture", role: "MEMBER" } });
  fixtureUserIds.push(user.id);
  const token = await signAccessToken(user.id);
  const product = await prisma.product.create({ data: { merchantId, name: "Inactive legacy points", price: "30000" } });
  const orderResponse = await request("/api/orders", "POST", token, { productId: product.id, quantity: 1 });
  assert.equal(orderResponse.response.status, 201);
  const orderId = orderResponse.json.order.id as number;
  const payment = await request(`/api/orders/${orderId}/payments/vnpay`, "POST", token);
  const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { orderId } });
  const membership = await prisma.merchantMembership.findUniqueOrThrow({ where: { memberId_merchantId: { memberId: user.id, merchantId } }, include: { wallet: true } });
  assert.ok(membership.wallet);
  await prisma.$transaction([
    prisma.paymentAttempt.update({ where: { id: attempt.id }, data: {
      reservedPoints: 6,
      snapshotTierLevel: null,
      snapshotMultiplier: null,
      snapshotRuleActive: false,
      snapshotMaxMultiplier: 2,
      snapshotBronzeMultiplier: 2,
      snapshotSilverMultiplier: 2,
      snapshotGoldMultiplier: 2,
      snapshotPlatinumMultiplier: 2,
      snapshotTierConfigFallback: true,
      snapshotExactReservationAward: false,
    } }),
    prisma.loyaltyWallet.update({ where: { id: membership.wallet.id }, data: { reservedPoints: 6 } }),
  ]);
  const ipn = signedIpn(payment.json.txnRef, "3000000");
  assert.equal((await request(`/api/payments/vnpay/ipn?${ipn}`)).json.RspCode, "00");
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status, "PAID");
  assert.equal((await prisma.pointTransaction.findFirstOrThrow({ where: { orderId, type: "EARN" } })).delta.toString(), "0");
  assert.equal((await prisma.loyaltyWallet.findUniqueOrThrow({ where: { id: membership.wallet.id } })).reservedPoints.toString(), "0");
});

test("SQL backfill preserves positive reservations and safely reserves zero-reserve legacy attempts", async () => {
  const firstMigration = readFileSync(new URL("../../../apps/backend/prisma/migrations/20261109200000_vnpay_reservation_backfill/migration.sql", import.meta.url), "utf8");
  const secondMigration = readFileSync(new URL("../../../apps/backend/prisma/migrations/20261109210000_snapshot_max_multiplier/migration.sql", import.meta.url), "utf8");
  const thirdMigration = readFileSync(new URL("../../../apps/backend/prisma/migrations/20261109220000_snapshot_tier_multipliers/migration.sql", import.meta.url), "utf8");
  const fourthMigration = readFileSync(new URL("../../../apps/backend/prisma/migrations/20261109230000_legacy_tier_snapshot_fallback/migration.sql", import.meta.url), "utf8");
  const fifthMigration = readFileSync(new URL("../../../apps/backend/prisma/migrations/20261109240000_exact_legacy_reservation_award/migration.sql", import.meta.url), "utf8");
  const firstBody = firstMigration.split("-- BEGIN LEGACY RESERVATION BACKFILL")[1]?.split("-- END LEGACY RESERVATION BACKFILL")[0];
  const secondBody = secondMigration.split("-- BEGIN MULTIPLIER RESERVATION BACKFILL")[1]?.split("-- END MULTIPLIER RESERVATION BACKFILL")[0];
  const fourthBody = fourthMigration.split("-- BEGIN LEGACY TIER CONFIG FALLBACK")[1]?.split("-- END LEGACY TIER CONFIG FALLBACK")[0];
  assert.ok(firstBody && secondBody && fourthBody);
  assert.doesNotMatch(firstMigration, /UPDATE\s+`LoyaltyWallet`|SET pa\.`reservedPoints`/i);
  assert.match(secondMigration, /SET pa\.`snapshotMaxMultiplier`[\s\S]*pa\.`reservedPoints`/);
  assert.match(secondMigration, /CASE WHEN pa\.`reservedPoints` > 0 THEN pa\.`reservedPoints`/);
  assert.match(thirdMigration, /ALTER TABLE `PaymentAttempt`[\s\S]*ADD COLUMN `snapshotBronzeMultiplier`/);
  assert.doesNotMatch(thirdMigration, /UPDATE\s+`(?:PaymentAttempt|LoyaltyWallet)`/i);
  assert.match(fifthMigration, /ADD COLUMN `snapshotExactReservationAward` BOOLEAN NOT NULL DEFAULT false/);
  assert.match(fifthMigration, /SET `snapshotExactReservationAward` = true[\s\S]*`snapshotMaxMultiplier` = 0/);
  const tableNames: [string, string][] = [
    ["`PaymentAttempt`", "`TestPaymentAttempt`"], ["`Order`", "`TestOrder`"],
    ["`MerchantMembership`", "`TestMerchantMembership`"], ["`LoyaltyWallet`", "`TestLoyaltyWallet`"],
    ["`LoyaltyRule`", "`TestLoyaltyRule`"], ["`LoyaltyTier`", "`TestLoyaltyTier`"],
  ];
  await prisma.$transaction(async (tx) => {
    const tempTables = [
      "CREATE TEMPORARY TABLE TestOrder (id INTEGER PRIMARY KEY, merchantId INTEGER NOT NULL, memberId INTEGER NOT NULL, total DECIMAL(15,0) NOT NULL)",
      // Tier columns/defaults emulate 2200's schema-only ALTER TABLE.
      "CREATE TEMPORARY TABLE TestPaymentAttempt (id INTEGER PRIMARY KEY, orderId INTEGER NOT NULL, status VARCHAR(20) NOT NULL, reservedPoints INTEGER NOT NULL DEFAULT 0, snapshotVndPerPoint INTEGER NOT NULL DEFAULT 10000, snapshotRuleActive BOOLEAN NOT NULL DEFAULT true, snapshotMaxMultiplier DECIMAL(5,2) NOT NULL DEFAULT 2.00, snapshotBronzeMultiplier DECIMAL(5,2) NOT NULL DEFAULT 1.00, snapshotSilverMultiplier DECIMAL(5,2) NOT NULL DEFAULT 1.20, snapshotGoldMultiplier DECIMAL(5,2) NOT NULL DEFAULT 1.50, snapshotPlatinumMultiplier DECIMAL(5,2) NOT NULL DEFAULT 2.00, snapshotTierConfigFallback BOOLEAN NOT NULL DEFAULT false, snapshotExactReservationAward BOOLEAN NOT NULL DEFAULT false)",
      "CREATE TEMPORARY TABLE TestMerchantMembership (id INTEGER PRIMARY KEY AUTO_INCREMENT, merchantId INTEGER NOT NULL, memberId INTEGER NOT NULL, createdAt DATETIME(3) NOT NULL, updatedAt DATETIME(3) NOT NULL, UNIQUE KEY merchant_member (merchantId, memberId))",
      "CREATE TEMPORARY TABLE TestLoyaltyWallet (id INTEGER PRIMARY KEY AUTO_INCREMENT, membershipId INTEGER NOT NULL UNIQUE, availablePoints INTEGER NOT NULL DEFAULT 0, lifetimeEarnedPoints INTEGER NOT NULL DEFAULT 0, reservedPoints INTEGER NOT NULL DEFAULT 0, createdAt DATETIME(3) NOT NULL, updatedAt DATETIME(3) NOT NULL)",
      "CREATE TEMPORARY TABLE TestLoyaltyRule (merchantId INTEGER PRIMARY KEY, vndPerPoint INTEGER NOT NULL, isActive BOOLEAN NOT NULL)",
      "CREATE TEMPORARY TABLE TestLoyaltyTier (merchantId INTEGER NOT NULL, level VARCHAR(20) NOT NULL, multiplier DECIMAL(5,2) NOT NULL)",
    ];
    for (const sql of tempTables) await tx.$executeRawUnsafe(sql);
    await tx.$executeRawUnsafe("INSERT INTO TestOrder VALUES (501, 701, 801, 120000), (502, 701, 802, 30000)");
    await tx.$executeRawUnsafe("INSERT INTO TestPaymentAttempt (id, orderId, status, reservedPoints) VALUES (601, 501, 'CREATED', 0), (602, 502, 'CREATED', 4)");
    await tx.$executeRawUnsafe("INSERT INTO TestMerchantMembership (id, merchantId, memberId, createdAt, updatedAt) VALUES (2, 701, 802, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))");
    await tx.$executeRawUnsafe("INSERT INTO TestLoyaltyWallet (id, membershipId, availablePoints, lifetimeEarnedPoints, reservedPoints, createdAt, updatedAt) VALUES (2, 2, 4, 4, 4, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))");
    await tx.$executeRawUnsafe("INSERT INTO TestLoyaltyRule VALUES (701, 10000, false)");
    await tx.$executeRawUnsafe("INSERT INTO TestLoyaltyTier VALUES (701, 'BRONZE', 1.00), (701, 'SILVER', 1.20), (701, 'GOLD', 1.50), (701, 'PLATINUM', 2.00)");
    // The test uses TEMPORARY tables. MySQL cannot read a temporary table again
    // as the source of an INSERT into that same table, so drop only those
    // anti-join predicates; INSERT IGNORE and unique keys retain idempotence.
    const runBody = async (body: string, statementFilter = (_statement: string) => true) => {
      const sql = tableNames.reduce((text, [from, to]) => text.replaceAll(from, to), body);
      for (const statement of sql.split(";").map((query) => query.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean).filter(statementFilter)) {
        const safeSql = statement
          .replace("LEFT JOIN `TestMerchantMembership` mm ON mm.`merchantId` = o.`merchantId` AND mm.`memberId` = o.`memberId`", "")
          .replace(" AND mm.`id` IS NULL", "")
          .replace("LEFT JOIN `TestLoyaltyWallet` w ON w.`membershipId` = mm.`id`", "")
          .replace(" AND w.`id` IS NULL", "");
        await tx.$executeRawUnsafe(safeSql);
      }
    };
    await runBody(firstBody);
    await tx.$executeRawUnsafe("UPDATE TestLoyaltyTier SET multiplier = 999.99 WHERE level = 'BRONZE'");
    await runBody(secondBody);
    // Re-run only INSERT IGNORE statements to verify existing membership/wallet
    // records remain unchanged without rerunning the capacity calculation.
    await runBody(firstBody, (statement) => statement.startsWith("INSERT IGNORE INTO"));
    const [preservedBeforeFallback] = await tx.$queryRawUnsafe<{ reservedPoints: number }[]>("SELECT reservedPoints FROM TestPaymentAttempt WHERE id = 602");
    assert.equal(preservedBeforeFallback?.reservedPoints, 4);
    const fallbackSql = tableNames.reduce((text, [from, to]) => text.replaceAll(from, to), fourthBody);
    for (const statement of fallbackSql.split(";").map((query) => query.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) {
      await tx.$executeRawUnsafe(statement);
    }
    const exactFallbackUpdate = fifthMigration.split(";").map((statement) => statement.replace(/^\s*--.*$/gm, "").trim()).find((statement) => statement.startsWith("UPDATE `PaymentAttempt`"));
    assert.ok(exactFallbackUpdate);
    await tx.$executeRawUnsafe(tableNames.reduce((text, [from, to]) => text.replaceAll(from, to), exactFallbackUpdate));
    const [backfilledAttempt, preservedAttempt] = await tx.$queryRawUnsafe<{ id: number; reservedPoints: number; snapshotVndPerPoint: number; snapshotRuleActive: boolean; snapshotMaxMultiplier: string; snapshotBronzeMultiplier: string; snapshotSilverMultiplier: string; snapshotGoldMultiplier: string; snapshotPlatinumMultiplier: string; snapshotTierConfigFallback: boolean; snapshotExactReservationAward: boolean }[]>("SELECT id, reservedPoints, snapshotVndPerPoint, snapshotRuleActive, snapshotMaxMultiplier, snapshotBronzeMultiplier, snapshotSilverMultiplier, snapshotGoldMultiplier, snapshotPlatinumMultiplier, snapshotTierConfigFallback, snapshotExactReservationAward FROM TestPaymentAttempt ORDER BY id");
    assert.equal(backfilledAttempt?.snapshotVndPerPoint, 10000);
    assert.equal(Boolean(backfilledAttempt?.snapshotRuleActive), false);
    assert.equal(Number(backfilledAttempt?.snapshotMaxMultiplier), 999.99);
    assert.equal(Number(backfilledAttempt?.snapshotBronzeMultiplier), 999.99);
    assert.equal(Number(backfilledAttempt?.snapshotSilverMultiplier), 999.99);
    assert.equal(Number(backfilledAttempt?.snapshotGoldMultiplier), 999.99);
    assert.equal(Number(backfilledAttempt?.snapshotPlatinumMultiplier), 999.99);
    assert.equal(Boolean(backfilledAttempt?.snapshotTierConfigFallback), true);
    assert.equal(Boolean(backfilledAttempt?.snapshotExactReservationAward), false);
    assert.equal(backfilledAttempt?.reservedPoints, 11999);
    assert.equal(Number(preservedAttempt?.snapshotMaxMultiplier), 0);
    assert.equal(Number(preservedAttempt?.snapshotBronzeMultiplier), 0);
    assert.equal(Number(preservedAttempt?.snapshotSilverMultiplier), 0);
    assert.equal(Boolean(preservedAttempt?.snapshotTierConfigFallback), true);
    assert.equal(Boolean(preservedAttempt?.snapshotExactReservationAward), true);
    assert.equal(preservedAttempt?.reservedPoints, 4);
    const [newMembership] = await tx.$queryRawUnsafe<{ id: number }[]>("SELECT id FROM TestMerchantMembership WHERE merchantId = 701 AND memberId = 801");
    assert.ok(newMembership);
    const [newWallet] = await tx.$queryRawUnsafe<{ reservedPoints: number }[]>("SELECT reservedPoints FROM TestLoyaltyWallet WHERE membershipId = ?", newMembership.id);
    assert.equal(newWallet?.reservedPoints, 11999);
    const [existingWallet] = await tx.$queryRawUnsafe<{ reservedPoints: number }[]>("SELECT reservedPoints FROM TestLoyaltyWallet WHERE membershipId = 2");
    assert.equal(existingWallet?.reservedPoints, 4);
    const [counts] = await tx.$queryRawUnsafe<{ memberships: number; wallets: number }[]>("SELECT (SELECT COUNT(*) FROM TestMerchantMembership) AS memberships, (SELECT COUNT(*) FROM TestLoyaltyWallet) AS wallets");
    assert.equal(Number(counts?.memberships), 2);
    assert.equal(Number(counts?.wallets), 2);
  });
});

test("mock finalization and VNPay attempt creation cannot both win concurrently", async () => {
  const [{ paymentsRepository }, { ordersRepository }] = await Promise.all([
    import("../../../apps/backend/src/modules/payments/payments.repository.js"),
    import("../../../apps/backend/src/modules/orders/orders.repository.js"),
  ]);
  const user = await prisma.user.create({ data: { email: `m6-race-${suffix}@test.local`, passwordHash: "fixture", role: "MEMBER" } });
  fixtureUserIds.push(user.id);
  const token = await signAccessToken(user.id);
  const order = await createOrderFor(token);
  const [attemptResult, mockResult] = await Promise.all([
    paymentsRepository.createAttempt(user.id, order.id),
    ordersRepository.markPaid(user.id, order.id),
  ]);
  const attempt = await prisma.paymentAttempt.findUnique({ where: { orderId: order.id } });
  const finalOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  if (attempt) {
    assert.equal(attempt.status, "CREATED");
    assert.equal(finalOrder.status, "PENDING");
    assert.equal(mockResult, "vnpay_attempt_exists");
  } else {
    assert.equal(attemptResult, "already_paid");
    assert.equal(finalOrder.status, "PAID");
    assert.equal(mockResult !== "vnpay_attempt_exists", true);
  }
});
