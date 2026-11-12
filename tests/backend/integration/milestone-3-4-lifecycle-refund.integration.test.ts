import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import type { Server } from "node:http";

process.env.JWT_SECRET ??= randomBytes(32).toString("hex");
process.env.PAYMENT_MODE = "vnpay";
process.env.VNPAY_TMN_CODE ??= "TESTTMN1";
process.env.VNPAY_HASH_SECRET ??= "TESTSECRET1234567890123456789012";
process.env.VNPAY_PAYMENT_URL ??= "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
process.env.VNPAY_RETURN_URL = "https://127.0.0.1:3000/api/payments/vnpay/return";

const [{ app }, { prisma }, { signAccessToken }, { signVnpay }, { env }] = await Promise.all([
  import("../../../apps/backend/src/app.js"),
  import("../../../apps/backend/src/lib/prisma.js"),
  import("../../../apps/backend/src/lib/access-token.js"),
  import("../../../apps/backend/src/modules/payments/vnpay-signature.js"),
  import("../../../apps/backend/src/config/env.js"),
]);

const suffix = randomUUID();
const merchantAEmail = `m34-merchant-a-${suffix}@test.local`;
const merchantBEmail = `m34-merchant-b-${suffix}@test.local`;
const memberAEmail = `m34-member-a-${suffix}@test.local`;
const memberBEmail = `m34-member-b-${suffix}@test.local`;
const fixtureEmails = [merchantAEmail, merchantBEmail, memberAEmail, memberBEmail];

let server: Server | undefined;
let baseUrl: string;
let merchantAId: number;
let merchantBId: number;
let merchantAOwnerId: number;
let merchantBOwnerId: number;
let memberAId: number;
let memberBId: number;
let merchantAToken: string;
let merchantBToken: string;
let memberAToken: string;
let memberBToken: string;
let productAId: number;

function signedIpn(txnRef: string, amount: string, overrides: Record<string, string> = {}) {
  const params: Record<string, string> = {
    vnp_Amount: amount,
    vnp_Command: "pay",
    vnp_CreateDate: "20261109160000",
    vnp_CurrCode: "VND",
    vnp_IpAddr: "127.0.0.1",
    vnp_Locale: "vn",
    vnp_OrderInfo: "Thanh toan",
    vnp_OrderType: "other",
    vnp_ResponseCode: "00",
    vnp_TmnCode: process.env.VNPAY_TMN_CODE!,
    vnp_TransactionNo: "123456",
    vnp_TransactionStatus: "00",
    vnp_TxnRef: txnRef,
    vnp_Version: "2.1.0",
    ...overrides,
  };
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params).sort(([a], [b]) => a.localeCompare(b, "en"))) {
    search.set(key, value);
  }
  search.set("vnp_SecureHash", signVnpay(params, process.env.VNPAY_HASH_SECRET!));
  return search;
}

before(async () => {
  const [ownerA, ownerB, memberA, memberB] = await Promise.all([
    prisma.user.create({ data: { email: merchantAEmail, passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: merchantBEmail, passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: memberAEmail, passwordHash: "fixture", role: "MEMBER" } }),
    prisma.user.create({ data: { email: memberBEmail, passwordHash: "fixture", role: "MEMBER" } }),
  ]);
  merchantAOwnerId = ownerA.id;
  merchantBOwnerId = ownerB.id;
  memberAId = memberA.id;
  memberBId = memberB.id;

  const [merchantA, merchantB] = await Promise.all([
    prisma.merchant.create({ data: { ownerId: ownerA.id, name: "Merchant A", slug: `m34-a-${suffix}` } }),
    prisma.merchant.create({ data: { ownerId: ownerB.id, name: "Merchant B", slug: `m34-b-${suffix}` } }),
  ]);
  merchantAId = merchantA.id;
  merchantBId = merchantB.id;

  await prisma.loyaltyRule.createMany({
    data: [
      { merchantId: merchantA.id, vndPerPoint: 10000, isActive: true },
      { merchantId: merchantB.id, vndPerPoint: 10000, isActive: true },
    ],
  });

  await prisma.loyaltyTier.createMany({
    data: [
      { merchantId: merchantA.id, level: "BRONZE", minLifetimePoints: 0, multiplier: "1.00" },
      { merchantId: merchantA.id, level: "SILVER", minLifetimePoints: 1000, multiplier: "1.20" },
      { merchantId: merchantA.id, level: "GOLD", minLifetimePoints: 5000, multiplier: "1.50" },
      { merchantId: merchantA.id, level: "PLATINUM", minLifetimePoints: 10000, multiplier: "2.00" },
    ],
  });

  const product = await prisma.product.create({
    data: {
      merchantId: merchantA.id,
      name: "Special Coffee",
      price: "100000",
      kind: "SALE",
      status: "ACTIVE",
    },
  });
  productAId = product.id;

  merchantAToken = await signAccessToken(ownerA.id);
  merchantBToken = await signAccessToken(ownerB.id);
  memberAToken = await signAccessToken(memberA.id);
  memberBToken = await signAccessToken(memberB.id);

  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server!.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  const users = await prisma.user.findMany({ where: { email: { in: fixtureEmails } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  const merchants = await prisma.merchant.findMany({ where: { ownerId: { in: userIds } }, select: { id: true } });
  const merchantIds = merchants.map((m) => m.id);

  await prisma.orderRefund.deleteMany({ where: { requestedById: { in: userIds } } });
  await prisma.orderVoucherReservation.deleteMany({});
  await prisma.pointTransaction.deleteMany({ where: { wallet: { membership: { merchantId: { in: merchantIds } } } } });
  await prisma.loyaltyWallet.deleteMany({ where: { membership: { merchantId: { in: merchantIds } } } });
  await prisma.memberVoucher.deleteMany({ where: { membership: { merchantId: { in: merchantIds } } } });
  await prisma.orderItem.deleteMany({ where: { order: { merchantId: { in: merchantIds } } } });
  await prisma.paymentAttempt.deleteMany({ where: { order: { merchantId: { in: merchantIds } } } });
  await prisma.order.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.merchantMembership.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.voucherDefinition.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.product.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.loyaltyTier.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.loyaltyRule.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.merchant.deleteMany({ where: { id: { in: merchantIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

async function request(path: string, method = "GET", token?: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  try {
    return { response, json: JSON.parse(text) };
  } catch {
    return { response, text };
  }
}

test("1. cancel paid rejection: cannot cancel a paid order", async () => {
  const created = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
  });
  assert.equal(created.response.status, 201);
  const orderId = created.json.order.id;

  // Pay order in mock mode
  env.paymentMode = "mock";
  const paid = await request(`/api/orders/${orderId}/pay`, "POST", memberAToken);
  assert.equal(paid.response.status, 200);

  // Try to cancel paid order
  const cancelled = await request(`/api/orders/${orderId}/cancel`, "POST", memberAToken);
  assert.equal(cancelled.response.status, 409);
  assert.equal(cancelled.json.error, "ORDER_NOT_CANCELLABLE");
  assert.equal(cancelled.json.orderStatus, "PAID");
});

test("2. pending cancel voucher release: safe cancel releases discount voucher for reuse", async () => {
  // Create discount voucher definition and issue to member
  const def = await request("/api/merchant/vouchers", "POST", merchantAToken, {
    type: "DISCOUNT",
    title: "10k off",
    pointsCost: 10,
    discountAmount: "10000",
  });
  assert.equal(def.response.status, 201);

  // Member gets membership & wallet
  const membership = await prisma.merchantMembership.upsert({
    where: { memberId_merchantId: { memberId: memberAId, merchantId: merchantAId } },
    create: { memberId: memberAId, merchantId: merchantAId },
    update: {},
  });
  const voucher = await prisma.memberVoucher.create({
    data: {
      membershipId: membership.id,
      definitionId: def.json.definition.id,
      snapshotType: "DISCOUNT",
      snapshotTitle: "10k off",
      snapshotPointsCost: 10,
      snapshotDiscountAmount: "10000",
      status: "AVAILABLE",
    },
  });

  // Create pending order reserving voucher
  const orderRes = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
    voucherId: voucher.id,
  });
  assert.equal(orderRes.response.status, 201);
  const orderId = orderRes.json.order.id;

  // Verify voucher is reserved
  const vouchersBefore = await request(`/api/member/merchants/${merchantAId}/vouchers`, "GET", memberAToken);
  const vBefore = vouchersBefore.json.vouchers.find((v: any) => v.id === voucher.id);
  assert.equal(vBefore.reserved, true);

  // Cancel pending order
  const cancelRes = await request(`/api/orders/${orderId}/cancel`, "POST", memberAToken);
  assert.equal(cancelRes.response.status, 200);
  assert.equal(cancelRes.json.order.status, "CANCELLED");
  assert.equal(cancelRes.json.voucherReleased, true);

  // Verify voucher is released (reserved: false) and still AVAILABLE
  const vouchersAfter = await request(`/api/member/merchants/${merchantAId}/vouchers`, "GET", memberAToken);
  const vAfter = vouchersAfter.json.vouchers.find((v: any) => v.id === voucher.id);
  assert.equal(vAfter.status, "AVAILABLE");
  assert.equal(vAfter.reserved, false);

  // A new order can now reserve this voucher!
  const newOrder = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
    voucherId: voucher.id,
  });
  assert.equal(newOrder.response.status, 201);
  assert.equal(newOrder.json.order.discountAmount, "10000");

  // Historical cancelled order still preserves its voucherId
  const dbCancelled = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  assert.equal(dbCancelled.voucherId, voucher.id);
  assert.equal(dbCancelled.status, "CANCELLED");
});

test("3. two orders cannot reserve one voucher", async () => {
  const def = await request("/api/merchant/vouchers", "POST", merchantAToken, {
    type: "DISCOUNT",
    title: "15k off",
    pointsCost: 10,
    discountAmount: "15000",
  });
  const membership = await prisma.merchantMembership.upsert({
    where: { memberId_merchantId: { memberId: memberAId, merchantId: merchantAId } },
    create: { memberId: memberAId, merchantId: merchantAId },
    update: {},
  });
  const voucher = await prisma.memberVoucher.create({
    data: {
      membershipId: membership.id,
      definitionId: def.json.definition.id,
      snapshotType: "DISCOUNT",
      snapshotTitle: "15k off",
      snapshotPointsCost: 10,
      snapshotDiscountAmount: "15000",
      status: "AVAILABLE",
    },
  });

  const order1 = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
    voucherId: voucher.id,
  });
  assert.equal(order1.response.status, 201);

  // Second order attempting to reserve the same voucher must fail with 409
  const order2 = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
    voucherId: voucher.id,
  });
  assert.equal(order2.response.status, 409);
  assert.equal(order2.json.error, "VOUCHER_ALREADY_RESERVED");
});

test("4. payment failure no EARN and releases reservations", async () => {
  env.paymentMode = "vnpay";
  const def = await request("/api/merchant/vouchers", "POST", merchantAToken, {
    type: "DISCOUNT",
    title: "5k off",
    pointsCost: 10,
    discountAmount: "5000",
  });
  const membership = await prisma.merchantMembership.upsert({
    where: { memberId_merchantId: { memberId: memberAId, merchantId: merchantAId } },
    create: { memberId: memberAId, merchantId: merchantAId },
    update: {},
  });
  const voucher = await prisma.memberVoucher.create({
    data: {
      membershipId: membership.id,
      definitionId: def.json.definition.id,
      snapshotType: "DISCOUNT",
      snapshotTitle: "5k off",
      snapshotPointsCost: 10,
      snapshotDiscountAmount: "5000",
      status: "AVAILABLE",
    },
  });

  const order = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
    voucherId: voucher.id,
  });
  assert.equal(order.response.status, 201);
  const orderId = order.json.order.id;

  const payment = await request(`/api/orders/${orderId}/payments/vnpay`, "POST", memberAToken);
  assert.equal(payment.response.status, 201);

  // Send terminal FAILED IPN
  const failedIpn = signedIpn(payment.json.txnRef, "9500000", {
    vnp_ResponseCode: "24",
    vnp_TransactionStatus: "02",
  });
  const ipnRes = await request(`/api/payments/vnpay/ipn?${failedIpn}`);
  assert.equal(ipnRes.json.RspCode, "00");

  // Verify attempt is FAILED, voucher reservation is released, no EARN ledger entry
  const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { orderId } });
  assert.equal(attempt.status, "FAILED");

  const vouchers = await request(`/api/member/merchants/${merchantAId}/vouchers`, "GET", memberAToken);
  const v = vouchers.json.vouchers.find((item: any) => item.id === voucher.id);
  assert.equal(v.status, "AVAILABLE");
  assert.equal(v.reserved, false);

  const earnCount = await prisma.pointTransaction.count({ where: { orderId, type: "EARN" } });
  assert.equal(earnCount, 0);

  // Order with failed attempt can now be cancelled safely
  const cancelRes = await request(`/api/orders/${orderId}/cancel`, "POST", memberAToken);
  assert.equal(cancelRes.response.status, 200);
  assert.equal(cancelRes.json.order.status, "CANCELLED");
});

test("5. VNPay CREATED cancel rejection: cannot cancel when attempt is CREATED", async () => {
  env.paymentMode = "vnpay";
  const order = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
  });
  const orderId = order.json.order.id;

  const payment = await request(`/api/orders/${orderId}/payments/vnpay`, "POST", memberAToken);
  assert.equal(payment.response.status, 201);

  // Try to cancel while payment is in CREATED state
  const cancelled = await request(`/api/orders/${orderId}/cancel`, "POST", memberAToken);
  assert.equal(cancelled.response.status, 409);
  assert.equal(cancelled.json.error, "ORDER_NOT_CANCELLABLE");
  assert.equal(cancelled.json.paymentStatus, "CREATED");

  // Simulate stale CREATED attempt (> 15 minutes old)
  await prisma.paymentAttempt.update({
    where: { orderId },
    data: { createdAt: new Date(Date.now() - 20 * 60 * 1000) },
  });

  // Stale CREATED attempt must still reject cancellation and NOT auto-fail
  const cancelStale = await request(`/api/orders/${orderId}/cancel`, "POST", memberAToken);
  assert.equal(cancelStale.response.status, 409);
  assert.equal(cancelStale.json.error, "ORDER_NOT_CANCELLABLE");

  const dbAttempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { orderId } });
  assert.equal(dbAttempt.status, "CREATED");
});

test("6. duplicate/late IPN: duplicate callbacks do not double-credit", async () => {
  process.env.PAYMENT_MODE = "vnpay";
  const order = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
  });
  const orderId = order.json.order.id;

  const payment = await request(`/api/orders/${orderId}/payments/vnpay`, "POST", memberAToken);
  const successIpn = signedIpn(payment.json.txnRef, "10000000");

  const ipn1 = await request(`/api/payments/vnpay/ipn?${successIpn}`);
  assert.equal(ipn1.json.RspCode, "00");

  const dbOrder = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  assert.equal(dbOrder.status, "PAID");

  const earnTxs1 = await prisma.pointTransaction.findMany({ where: { orderId, type: "EARN" } });
  assert.equal(earnTxs1.length, 1);

  // Send duplicate IPN
  const ipn2 = await request(`/api/payments/vnpay/ipn?${successIpn}`);
  assert.equal(ipn2.json.RspCode, "02"); // Already confirmed

  const earnTxs2 = await prisma.pointTransaction.findMany({ where: { orderId, type: "EARN" } });
  assert.equal(earnTxs2.length, 1); // No double credit!
});

test("7. mock refund exact fractional reversal, debt, tier demotion, and voucher restore", async () => {
  env.paymentMode = "mock";

  // Create discount voucher
  const def = await request("/api/merchant/vouchers", "POST", merchantAToken, {
    type: "DISCOUNT",
    title: "20k off",
    pointsCost: 10,
    discountAmount: "20000",
  });
  const membership = await prisma.merchantMembership.upsert({
    where: { memberId_merchantId: { memberId: memberAId, merchantId: merchantAId } },
    create: { memberId: memberAId, merchantId: merchantAId },
    update: {},
  });
  const voucher = await prisma.memberVoucher.create({
    data: {
      membershipId: membership.id,
      definitionId: def.json.definition.id,
      snapshotType: "DISCOUNT",
      snapshotTitle: "20k off",
      snapshotPointsCost: 10,
      snapshotDiscountAmount: "20000",
      status: "AVAILABLE",
    },
  });

  // Create product with price 35,000 so total = 15,000 VND -> earns exactly 1.5 points (vndPerPoint=10000, 1.00x)
  const product15 = await prisma.product.create({
    data: { merchantId: merchantAId, name: "Juice", price: "35000", kind: "SALE", status: "ACTIVE" },
  });

  const orderRes = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: product15.id, quantity: 1 }],
    voucherId: voucher.id,
  });
  const orderId = orderRes.json.order.id;
  assert.equal(orderRes.json.order.total, "15000");

  // Pay order
  const paid = await request(`/api/orders/${orderId}/pay`, "POST", memberAToken);
  assert.equal(paid.response.status, 200);
  assert.equal(paid.json.order.earnedPointsExact, "1.5");

  // Member wallet currently has 1.5 points. Simulate member spending 1 point on a voucher, leaving 0.5 balance:
  await prisma.loyaltyWallet.update({
    where: { membershipId: membership.id },
    data: { exactBalance: "0.5" },
  });

  // Merchant previews refund
  const preview = await request(`/api/merchant/orders/${orderId}/refund-preview`, "GET", merchantAToken);
  assert.equal(preview.response.status, 200);
  assert.equal(preview.json.earningReversalExact, "1.5");
  assert.equal(preview.json.discountVoucherRestorable, true);
  assert.equal(preview.json.providerConfirmationRequired, false);

  // Merchant executes refund
  const refundRes = await request(`/api/merchant/orders/${orderId}/refund`, "POST", merchantAToken, {
    reason: "Defective item returned",
  });
  assert.equal(refundRes.response.status, 200);
  assert.equal(refundRes.json.refund.status, "COMPLETED");
  assert.equal(refundRes.json.order.status, "REFUNDED");

  // Wallet balance became 0.5 - 1.5 = -1.0. Verify debt projection:
  assert.equal(refundRes.json.walletImpact.exactBalance, "-1");
  assert.equal(refundRes.json.walletImpact.pointDebt, "1");
  assert.equal(refundRes.json.walletImpact.availablePoints, 0);
  assert.equal(refundRes.json.walletImpact.fractionalCarry, "0");

  // Verify unique EARN_REVERSAL transaction was written
  const reversalTx = await prisma.pointTransaction.findFirstOrThrow({
    where: { orderId, type: "EARN_REVERSAL" },
  });
  assert.equal(reversalTx.delta.toString(), "-1.5");
  assert.equal(reversalTx.source, "MERCHANT_REFUND");
  assert.equal(reversalTx.actorId, merchantAOwnerId);
  assert.equal(reversalTx.eventRef, `order-earn-reversal-${orderId}`);

  // Verify USED discount voucher was restored to AVAILABLE
  const restoredVoucher = await prisma.memberVoucher.findUniqueOrThrow({ where: { id: voucher.id } });
  assert.equal(restoredVoucher.status, "AVAILABLE");
  assert.equal(restoredVoucher.usedAt, null);

  // Restored voucher can be used by a new order!
  const reusedOrder = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
    voucherId: voucher.id,
  });
  assert.equal(reusedOrder.response.status, 201);
});

test("8. concurrent duplicate refund: reverses once and returns idempotent result", async () => {
  env.paymentMode = "mock";
  const orderRes = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
  });
  const orderId = orderRes.json.order.id;
  await request(`/api/orders/${orderId}/pay`, "POST", memberAToken);

  // Run two concurrent refund requests
  const [res1, res2] = await Promise.all([
    request(`/api/merchant/orders/${orderId}/refund`, "POST", merchantAToken, { reason: "Concurrent 1" }),
    request(`/api/merchant/orders/${orderId}/refund`, "POST", merchantAToken, { reason: "Concurrent 2" }),
  ]);
  assert.equal(res1.response.status, 200);
  assert.equal(res2.response.status, 200);

  // Only one EARN_REVERSAL transaction exists
  const reversals = await prisma.pointTransaction.findMany({
    where: { orderId, type: "EARN_REVERSAL" },
  });
  assert.equal(reversals.length, 1);

  // Subsequent refund call returns existing refund record
  const res3 = await request(`/api/merchant/orders/${orderId}/refund`, "POST", merchantAToken, { reason: "Third try" });
  assert.equal(res3.response.status, 200);
  assert.equal(res3.json.refund.status, "COMPLETED");
});

test("9. wrong merchant 403: Merchant B cannot preview or refund Merchant A's order", async () => {
  const orderRes = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
  });
  const orderId = orderRes.json.order.id;

  const preview = await request(`/api/merchant/orders/${orderId}/refund-preview`, "GET", merchantBToken);
  assert.equal(preview.response.status, 403);
  assert.equal(preview.json.error, "FORBIDDEN");

  const refund = await request(`/api/merchant/orders/${orderId}/refund`, "POST", merchantBToken, { reason: "Steal" });
  assert.equal(refund.response.status, 403);
  assert.equal(refund.json.error, "FORBIDDEN");
});

test("10. VNPay refund pending: order becomes REFUND_PENDING and no EARN_REVERSAL is posted", async () => {
  env.paymentMode = "vnpay";
  const orderRes = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
  });
  const orderId = orderRes.json.order.id;
  const payment = await request(`/api/orders/${orderId}/payments/vnpay`, "POST", memberAToken);
  const ipn = signedIpn(payment.json.txnRef, "10000000");
  await request(`/api/payments/vnpay/ipn?${ipn}`);

  // Order is PAID via VNPay
  const paidOrder = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  assert.equal(paidOrder.status, "PAID");

  // Merchant initiates refund for VNPay order
  const refundRes = await request(`/api/merchant/orders/${orderId}/refund`, "POST", merchantAToken, {
    reason: "VNPay cancellation",
  });
  assert.equal(refundRes.response.status, 200);
  assert.equal(refundRes.json.refund.status, "PENDING_PROVIDER");
  assert.equal(refundRes.json.order.status, "REFUND_PENDING");
  assert.equal(refundRes.json.walletImpact, null);

  // Verify NO EARN_REVERSAL transaction is created
  const reversals = await prisma.pointTransaction.findMany({
    where: { orderId, type: "EARN_REVERSAL" },
  });
  assert.equal(reversals.length, 0);
});

test("11. preview auth: enforces authentication and role boundaries", async () => {
  // Member preview requires MEMBER role
  const anonMem = await request(`/api/member/merchants/${merchantAId}/loyalty/preview`, "POST", undefined, {
    netOrderAmountVnd: "50000",
  });
  assert.equal(anonMem.response.status, 401);

  const merchAsMem = await request(`/api/member/merchants/${merchantAId}/loyalty/preview`, "POST", merchantAToken, {
    netOrderAmountVnd: "50000",
  });
  assert.equal(merchAsMem.response.status, 403);

  const validMem = await request(`/api/member/merchants/${merchantAId}/loyalty/preview`, "POST", memberAToken, {
    netOrderAmountVnd: "50000",
  });
  assert.equal(validMem.response.status, 200);
  assert.equal(validMem.json.estimatedPointsExact, "5");
  assert.equal(validMem.json.multiplier, "1.00");

  // Merchant preview requires MERCHANT role
  const anonMerch = await request("/api/merchant/loyalty/preview", "POST", undefined, {
    netOrderAmountVnd: "50000",
  });
  assert.equal(anonMerch.response.status, 401);

  const memAsMerch = await request("/api/merchant/loyalty/preview", "POST", memberAToken, {
    netOrderAmountVnd: "50000",
  });
  assert.equal(memAsMerch.response.status, 403);

  const validMerch = await request("/api/merchant/loyalty/preview", "POST", merchantAToken, {
    netOrderAmountVnd: "50000",
    tierLevel: "SILVER",
  });
  assert.equal(validMerch.response.status, 200);
  assert.equal(validMerch.json.estimatedPointsExact, "6"); // 50000/10000 * 1.20 = 6
  assert.equal(validMerch.json.integerProjection, 6);
  assert.equal(validMerch.json.fractionalProjection, "0");
});

test("12. ledger reconciliation: merchant loyalty transactions list and reconciliation flag", async () => {
  // Query merchant loyalty transactions
  const txList = await request("/api/merchant/loyalty/transactions", "GET", merchantAToken);
  assert.equal(txList.response.status, 200);
  assert.ok(Array.isArray(txList.json.items));
  assert.ok(txList.json.items.length > 0);
  const first = txList.json.items[0];
  assert.ok("id" in first);
  assert.ok("delta" in first);
  assert.ok("balanceAfter" in first);
  assert.ok("memberId" in first);
  assert.ok("email" in first);

  // Filter by type=EARN
  const earnOnly = await request("/api/merchant/loyalty/transactions?type=EARN", "GET", merchantAToken);
  assert.equal(earnOnly.response.status, 200);
  assert.ok(earnOnly.json.items.every((item: any) => item.type === "EARN"));

  // Check reconciliation state on stale CREATED order
  const orderRes = await request("/api/orders", "POST", memberAToken, {
    items: [{ productId: productAId, quantity: 1 }],
  });
  const orderId = orderRes.json.order.id;
  env.paymentMode = "vnpay";
  await request(`/api/orders/${orderId}/payments/vnpay`, "POST", memberAToken);

  // Set attempt to stale (> 15 min old)
  await prisma.paymentAttempt.update({
    where: { orderId },
    data: { createdAt: new Date(Date.now() - 30 * 60 * 1000) },
  });

  const memberOrder = await request(`/api/member/orders/${orderId}`, "GET", memberAToken);
  assert.equal(memberOrder.response.status, 200);
  assert.equal(memberOrder.json.order.status, "PENDING");
  assert.equal(memberOrder.json.order.actions.requiresReconciliation, true);
  assert.equal(memberOrder.json.order.actions.canCancel, false);
});
