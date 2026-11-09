import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import type { Server } from "node:http";

process.env.JWT_SECRET ??= randomBytes(32).toString("hex");
const [{ app }, { prisma }, { signAccessToken }] = await Promise.all([
  import("../src/app.js"), import("../src/lib/prisma.js"), import("../src/lib/access-token.js"),
]);
const suffix = randomUUID();
const emails = [`m5-a-${suffix}@test.local`, `m5-b-${suffix}@test.local`, `m5-member-${suffix}@test.local`, `m5-other-${suffix}@test.local`];
let server: Server | undefined;
let baseUrl: string;
let merchantAId: number;
let merchantBId: number;
let productAId: number;
let productBId: number;
let merchantAToken: string;
let merchantBToken: string;
let memberToken: string;
let otherToken: string;
let memberId: number;
let fixtureIds: number[] = [];

before(async () => {
  const [ownerA, ownerB, member, other] = await Promise.all([
    prisma.user.create({ data: { email: emails[0], passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: emails[1], passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: emails[2], passwordHash: "fixture", role: "MEMBER" } }),
    prisma.user.create({ data: { email: emails[3], passwordHash: "fixture", role: "MEMBER" } }),
  ]);
  memberId = member.id;
  fixtureIds = [ownerA.id, ownerB.id, member.id, other.id];
  const [a, b] = await Promise.all([
    prisma.merchant.create({ data: { ownerId: ownerA.id, name: "M5 A", slug: `m5-a-${suffix}` } }),
    prisma.merchant.create({ data: { ownerId: ownerB.id, name: "M5 B", slug: `m5-b-${suffix}` } }),
  ]);
  merchantAId = a.id;
  merchantBId = b.id;
  productAId = (await prisma.product.create({ data: { merchantId: a.id, name: "M5 Product", price: "200000" } })).id;
  productBId = (await prisma.product.create({ data: { merchantId: b.id, name: "M5 B Product", price: "100000" } })).id;
  merchantAToken = await signAccessToken(ownerA.id);
  merchantBToken = await signAccessToken(ownerB.id);
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
  if (fixtureIds.length === 0) return;
  const memberships = await prisma.merchantMembership.findMany({ where: { memberId: { in: fixtureIds } }, select: { id: true } });
  const membershipIds = memberships.map((item) => item.id);
  const wallets = await prisma.loyaltyWallet.findMany({ where: { membershipId: { in: membershipIds } }, select: { id: true } });
  const walletIds = wallets.map((item) => item.id);
  await prisma.rewardFulfillment.deleteMany({ where: { voucher: { membershipId: { in: membershipIds } } } });
  await prisma.pointTransaction.deleteMany({ where: { walletId: { in: walletIds } } });
  await prisma.orderItem.deleteMany({ where: { order: { memberId: { in: fixtureIds } } } });
  await prisma.order.deleteMany({ where: { memberId: { in: fixtureIds } } });
  await prisma.memberVoucher.deleteMany({ where: { membershipId: { in: membershipIds } } });
  await prisma.loyaltyWallet.deleteMany({ where: { membershipId: { in: membershipIds } } });
  await prisma.merchantMembership.deleteMany({ where: { id: { in: membershipIds } } });
  const merchants = await prisma.merchant.findMany({ where: { ownerId: { in: fixtureIds } }, select: { id: true } });
  const merchantIds = merchants.map((item) => item.id);
  await prisma.voucherDefinition.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.product.deleteMany({ where: { id: { in: [productAId, productBId] } } });
  await prisma.loyaltyTier.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.loyaltyRule.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.merchant.deleteMany({ where: { id: { in: merchantIds } } });
  await prisma.user.deleteMany({ where: { id: { in: fixtureIds } } });
  await prisma.$disconnect();
});

async function request(path: string, method = "GET", token?: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { response, json: await response.json() as Record<string, any> };
}

test("merchant definitions enforce type-specific fields and ownership", async () => {
  const discount = await request("/api/merchant/vouchers", "POST", merchantAToken, { type: "DISCOUNT", title: "Giảm 20k", pointsCost: 200, discountAmount: "20000" });
  assert.equal(discount.response.status, 201);
  assert.equal(discount.json.definition.discountAmount, "20000");
  const reward = await request("/api/merchant/vouchers", "POST", merchantAToken, { type: "REWARD", title: "Ly sứ", pointsCost: 500, rewardDescription: "Một chiếc ly" });
  assert.equal(reward.response.status, 201);
  const invalid = await request("/api/merchant/vouchers", "POST", merchantAToken, { type: "DISCOUNT", title: "Sai", pointsCost: 0, discountAmount: "-1" });
  assert.equal(invalid.response.status, 400);
  const foreign = await request(`/api/merchant/vouchers/${discount.json.definition.id}`, "PATCH", merchantBToken, { title: "Không phải của tôi" });
  assert.equal(foreign.response.status, 404);
  await request(`/api/merchant/vouchers/${discount.json.definition.id}`, "PATCH", merchantAToken, { isActive: false });
  const publicList = await request(`/api/merchants/${merchantAId}/vouchers`);
  assert.equal((publicList.json.definitions as any[]).some((item) => item.id === discount.json.definition.id), false);
});

test("redemption spends points once and keeps vouchers merchant scoped", async () => {
  const definition = await request("/api/merchant/vouchers", "POST", merchantAToken, { type: "DISCOUNT", title: "Giảm 20k", pointsCost: 200, discountAmount: "20000" });
  assert.equal(definition.response.status, 201);
  const tiers = await prisma.loyaltyTier.createMany({ data: [
    { merchantId: merchantAId, level: "BRONZE", minLifetimePoints: 0, multiplier: "1.00" },
    { merchantId: merchantAId, level: "SILVER", minLifetimePoints: 1000, multiplier: "1.20" },
    { merchantId: merchantAId, level: "GOLD", minLifetimePoints: 5000, multiplier: "1.50" },
    { merchantId: merchantAId, level: "PLATINUM", minLifetimePoints: 10000, multiplier: "2.00" },
  ] });
  assert.equal(tiers.count, 4);
  const membership = await prisma.merchantMembership.create({ data: { memberId, merchantId: merchantAId } });
  const wallet = await prisma.loyaltyWallet.create({ data: { membershipId: membership.id, availablePoints: 200, lifetimeEarnedPoints: 200 } });
  await prisma.pointTransaction.create({ data: { walletId: wallet.id, type: "EARN", delta: 200, balanceAfter: 200, reason: "fixture" } });
  const concurrent = await Promise.all([
    request(`/api/member/vouchers/${definition.json.definition.id}/redeem`, "POST", memberToken),
    request(`/api/member/vouchers/${definition.json.definition.id}/redeem`, "POST", memberToken),
  ]);
  assert.deepEqual(concurrent.map(({ response }) => response.status).sort(), [201, 409]);
  const winner = concurrent.find(({ response }) => response.status === 201)!;
  assert.equal(winner.json.wallet.availablePoints, 0);
  assert.equal(winner.json.voucher.status, "AVAILABLE");
  const changedDefinition = await request(`/api/merchant/vouchers/${definition.json.definition.id}`, "PATCH", merchantAToken, { title: "Tên mới", discountAmount: "90000", isActive: false });
  assert.equal(changedDefinition.response.status, 200);
  const ownVouchers = await request(`/api/member/merchants/${merchantAId}/vouchers`, "GET", memberToken);
  const foreignVouchers = await request(`/api/member/merchants/${merchantAId}/vouchers`, "GET", otherToken);
  assert.equal((ownVouchers.json.vouchers as any[]).length, 1);
  assert.equal(ownVouchers.json.vouchers[0].title, "Giảm 20k");
  assert.equal(ownVouchers.json.vouchers[0].discountAmount, "20000");
  assert.deepEqual(foreignVouchers.json.vouchers, []);
  const checkout = await request("/api/orders", "POST", memberToken, { productId: productAId, quantity: 1, voucherId: winner.json.voucher.id });
  assert.equal(checkout.response.status, 201);
  assert.equal(checkout.json.order.discountAmount, "20000");
  assert.equal(checkout.json.order.total, "180000");
  assert.notEqual(merchantAId, merchantBId);

  const rewardDefinition = await request("/api/merchant/vouchers", "POST", merchantAToken, { type: "REWARD", title: "Cốc quà", pointsCost: 100, rewardDescription: "Cốc xanh" });
  await prisma.loyaltyWallet.update({ where: { id: wallet.id }, data: { availablePoints: 100 } });
  const rewardRedemption = await request(`/api/member/vouchers/${rewardDefinition.json.definition.id}/redeem`, "POST", memberToken);
  assert.equal(rewardRedemption.response.status, 201);
  assert.equal(rewardRedemption.json.voucher.type, "REWARD");
  assert.equal(rewardRedemption.json.voucher.rewardDescription, "Cốc xanh");
  const rewardLedger = await prisma.pointTransaction.findUniqueOrThrow({ where: { memberVoucherId: rewardRedemption.json.voucher.id } });
  assert.equal(rewardLedger.type, "REDEEM_REWARD");
  assert.equal(rewardLedger.delta, -100);
});

test("discount snapshot is reserved once, used only on a committed pay, and rewards need merchant fulfillment", async () => {
  const discountDefinition = await request("/api/merchant/vouchers", "POST", merchantAToken, { type: "DISCOUNT", title: "Giảm 20k", pointsCost: 1, discountAmount: "20000" });
  const rewardDefinition = await request("/api/merchant/vouchers", "POST", merchantAToken, { type: "REWARD", title: "Quà", pointsCost: 1, rewardDescription: "Quà thử nghiệm" });
  assert.equal(discountDefinition.response.status, 201);
  assert.equal(rewardDefinition.response.status, 201);
  const membership = await prisma.merchantMembership.findUniqueOrThrow({ where: { memberId_merchantId: { memberId, merchantId: merchantAId } }, include: { wallet: true } });
  const wallet = await prisma.loyaltyWallet.update({ where: { id: membership.wallet!.id }, data: { availablePoints: 2 } });
  const discountVoucher = await prisma.memberVoucher.create({ data: { membershipId: membership.id, definitionId: discountDefinition.json.definition.id, snapshotType: "DISCOUNT", snapshotTitle: "Giảm 20k", snapshotPointsCost: 1, snapshotDiscountAmount: "20000", snapshotRewardDescription: null } });
  const rewardVoucher = await prisma.memberVoucher.create({ data: { membershipId: membership.id, definitionId: rewardDefinition.json.definition.id, snapshotType: "REWARD", snapshotTitle: "Quà", snapshotPointsCost: 1, snapshotDiscountAmount: null, snapshotRewardDescription: "Quà thử nghiệm" } });
  await request(`/api/merchant/vouchers/${discountDefinition.json.definition.id}`, "PATCH", merchantAToken, { title: "Mẫu mới", discountAmount: "250000", isActive: false });
  await prisma.loyaltyWallet.update({ where: { id: wallet.id }, data: { lifetimeEarnedPoints: 2147483647 } });

  const otherMember = await request("/api/orders", "POST", otherToken, { productId: productAId, quantity: 1, voucherId: discountVoucher.id });
  assert.equal(otherMember.response.status, 404);
  const crossMerchant = await request("/api/orders", "POST", memberToken, { productId: productBId, quantity: 1, voucherId: discountVoucher.id });
  assert.equal(crossMerchant.response.status, 404);
  const rewardAtCheckout = await request("/api/orders", "POST", memberToken, { productId: productAId, quantity: 1, voucherId: rewardVoucher.id });
  assert.equal(rewardAtCheckout.response.status, 404);
  const orderResponse = await request("/api/orders", "POST", memberToken, { productId: productAId, quantity: 1, voucherId: discountVoucher.id });
  assert.equal(orderResponse.response.status, 201);
  const order = orderResponse.json.order;
  assert.equal(order.subtotal, "200000");
  assert.equal(order.discountAmount, "20000");
  assert.equal(order.total, "180000");
  const reservation = await request("/api/orders", "POST", memberToken, { productId: productAId, quantity: 1, voucherId: discountVoucher.id });
  assert.equal(reservation.response.status, 409);
  const foreignReservedVoucher = await request("/api/orders", "POST", otherToken, { productId: productAId, quantity: 1, voucherId: discountVoucher.id });
  assert.equal(foreignReservedVoucher.response.status, 404);
  assert.equal((await prisma.memberVoucher.findUniqueOrThrow({ where: { id: discountVoucher.id } })).status, "AVAILABLE");
  const paid = await request(`/api/orders/${order.id}/pay`, "POST", memberToken);
  assert.equal(paid.response.status, 409);
  assert.equal(paid.json.error, "LOYALTY_LIMIT_EXCEEDED");
  const failedPayment = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  assert.equal(failedPayment.status, "PENDING");
  assert.equal((await prisma.memberVoucher.findUniqueOrThrow({ where: { id: discountVoucher.id } })).status, "AVAILABLE");
  await prisma.loyaltyWallet.update({ where: { id: wallet.id }, data: { lifetimeEarnedPoints: 0 } });
  const successfulPay = await request(`/api/orders/${order.id}/pay`, "POST", memberToken);
  assert.equal(successfulPay.response.status, 200);
  assert.equal(successfulPay.json.order.total, "180000");
  assert.equal((await prisma.pointTransaction.findUniqueOrThrow({ where: { orderId: order.id } })).delta, 18);
  const usedVoucher = await prisma.memberVoucher.findUniqueOrThrow({ where: { id: discountVoucher.id } });
  assert.equal(usedVoucher.status, "USED");
  assert.ok(usedVoucher.usedAt);
  const fulfillmentList = await request("/api/merchant/rewards", "GET", merchantAToken);
  assert.equal((fulfillmentList.json.rewards as any[]).some((voucher) => voucher.id === rewardVoucher.id), true);
  const foreignFulfillment = await request(`/api/merchant/rewards/${rewardVoucher.id}/fulfill`, "POST", merchantBToken, {});
  assert.equal(foreignFulfillment.response.status, 404);
  const fulfilled = await request(`/api/merchant/rewards/${rewardVoucher.id}/fulfill`, "POST", merchantAToken, { note: "Đã trao" });
  assert.equal(fulfilled.response.status, 200);
  assert.equal(fulfilled.json.reward.status, "FULFILLED");
  const repeated = await request(`/api/merchant/rewards/${rewardVoucher.id}/fulfill`, "POST", merchantAToken, {});
  assert.equal(repeated.response.status, 409);
});

test("first paid order stays Bronze when its discount reduces total to zero", async () => {
  const definition = await request("/api/merchant/vouchers", "POST", merchantAToken, {
    type: "DISCOUNT", title: "Giảm 250k", pointsCost: 1, discountAmount: "250000",
  });
  assert.equal(definition.response.status, 201);
  const otherMemberId = fixtureIds[3];
  const membership = await prisma.merchantMembership.create({ data: { memberId: otherMemberId, merchantId: merchantAId } });
  const voucher = await prisma.memberVoucher.create({ data: {
    membershipId: membership.id,
    definitionId: definition.json.definition.id,
    snapshotType: "DISCOUNT",
    snapshotTitle: "Giảm 250k",
    snapshotPointsCost: 1,
    snapshotDiscountAmount: "250000",
    snapshotRewardDescription: null,
  } });
  const created = await request("/api/orders", "POST", otherToken, { productId: productAId, quantity: 1, voucherId: voucher.id });
  assert.equal(created.response.status, 201);
  assert.equal(created.json.order.subtotal, "200000");
  assert.equal(created.json.order.discountAmount, "200000");
  assert.equal(created.json.order.total, "0");
  const paid = await request(`/api/orders/${created.json.order.id}/pay`, "POST", otherToken);
  assert.equal(paid.response.status, 200);
  assert.equal(paid.json.order.status, "PAID");
  assert.equal((await prisma.memberVoucher.findUniqueOrThrow({ where: { id: voucher.id } })).status, "USED");
  assert.equal((await prisma.pointTransaction.findUniqueOrThrow({ where: { orderId: created.json.order.id } })).delta, 0);
  const wallet = await request(`/api/member/merchants/${merchantAId}/wallet`, "GET", otherToken);
  assert.equal(wallet.json.wallet.availablePoints, 0);
  assert.equal(wallet.json.wallet.lifetimeEarnedPoints, 0);
  assert.equal(wallet.json.wallet.tier, "BRONZE");
});

