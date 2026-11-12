import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import type { Server } from "node:http";

process.env.JWT_SECRET ??= randomBytes(32).toString("hex");
const [{ app }, { prisma }, { signAccessToken }] = await Promise.all([
  import("../../../apps/backend/src/app.js"), import("../../../apps/backend/src/lib/prisma.js"), import("../../../apps/backend/src/lib/access-token.js"),
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
  await seedSaleProductStock(a.id, productAId, ownerA.id);
  await seedSaleProductStock(b.id, productBId, ownerB.id);
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
  const merchants = await prisma.merchant.findMany({ where: { ownerId: { in: fixtureIds } }, select: { id: true } });
  const merchantIds = merchants.map((item) => item.id);
  await prisma.inventoryMovement.deleteMany({ where: { merchantId: { in: merchantIds } } });
  const memberships = await prisma.merchantMembership.findMany({ where: { memberId: { in: fixtureIds } }, select: { id: true } });
  const membershipIds = memberships.map((item) => item.id);
  const wallets = await prisma.loyaltyWallet.findMany({ where: { membershipId: { in: membershipIds } }, select: { id: true } });
  const walletIds = wallets.map((item) => item.id);
  await prisma.rewardFulfillment.deleteMany({ where: { voucher: { membershipId: { in: membershipIds } } } });
  await prisma.rewardCancellation.deleteMany({ where: { voucher: { membershipId: { in: membershipIds } } } });
  await prisma.pointTransaction.deleteMany({ where: { walletId: { in: walletIds } } });
  await prisma.orderItem.deleteMany({ where: { order: { memberId: { in: fixtureIds } } } });
  await prisma.order.deleteMany({ where: { memberId: { in: fixtureIds } } });
  await prisma.memberVoucher.deleteMany({ where: { membershipId: { in: membershipIds } } });
  await prisma.loyaltyWallet.deleteMany({ where: { membershipId: { in: membershipIds } } });
  await prisma.merchantMembership.deleteMany({ where: { id: { in: membershipIds } } });
  await prisma.inventoryBalance.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.voucherDefinition.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.product.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.loyaltyTier.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.loyaltyRule.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.loyaltyPolicyVersion.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.merchant.deleteMany({ where: { id: { in: merchantIds } } });
  await prisma.user.deleteMany({ where: { id: { in: fixtureIds } } });
  await prisma.$disconnect();
});

async function request(path: string, method = "GET", token?: string, body?: unknown, options: { headers?: Record<string, string> } = {}) {
  const input = body && typeof body === "object" ? body as Record<string, unknown> : undefined;
  const payload = method === "POST" && path === "/api/merchant/vouchers" && input?.type === "DISCOUNT" && input.initialQuantity === undefined
    ? { ...input, initialQuantity: 100 }
    : body;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(payload !== undefined ? { "content-type": "application/json" } : {}), ...options.headers },
    ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
  });
  return { response, json: await response.json() as Record<string, any> };
}

async function seedSaleProductStock(merchantId: number, productId: number, actorId: number, quantity = 100) {
  await prisma.$transaction(async (tx) => {
    const balance = await tx.inventoryBalance.create({
      data: { merchantId, ownerType: "SALE_PRODUCT", productId, onHandQuantity: quantity },
    });
    await tx.inventoryMovement.create({
      data: {
        balanceId: balance.id,
        merchantId,
        ownerType: "SALE_PRODUCT",
        movementType: "INITIAL_STOCK",
        quantityDelta: quantity,
        onHandBefore: 0,
        onHandAfter: quantity,
        reservedBefore: 0,
        reservedAfter: 0,
        productId,
        actorId,
        reason: "M5 integration fixture opening stock",
        eventRef: `m5-initial-stock-${productId}-${randomUUID()}`,
      },
    });
  });
}

async function createRewardProduct(name: string, token: string): Promise<number> {
  const result = await request("/api/merchant/products", "POST", token, { kind: "REWARD", name, initialQuantity: 100 });
  assert.equal(result.response.status, 201);
  return result.json.product.id as number;
}

test("merchant definitions enforce type-specific fields and ownership", async () => {
  const discount = await request("/api/merchant/vouchers", "POST", merchantAToken, { type: "DISCOUNT", title: "Giảm 20k", pointsCost: 200, discountAmount: "20000" });
  assert.equal(discount.response.status, 201);
  assert.equal(discount.json.definition.discountAmount, "20000");
  const invalid = await request("/api/merchant/vouchers", "POST", merchantAToken, { type: "DISCOUNT", title: "Sai", pointsCost: 0, discountAmount: "-1" });
  assert.equal(invalid.response.status, 400);
  const foreign = await request(`/api/merchant/vouchers/${discount.json.definition.id}`, "PATCH", merchantBToken, { title: "Không phải của tôi" });
  assert.equal(foreign.response.status, 404);
  await request(`/api/merchant/vouchers/${discount.json.definition.id}`, "PATCH", merchantAToken, { isActive: false });
  const publicList = await request(`/api/merchants/${merchantAId}/vouchers`);
  assert.equal((publicList.json.definitions as any[]).some((item) => item.id === discount.json.definition.id), false);
});

test("new reward definitions require an active reward product from the same merchant", async () => {
  const fields = { type: "REWARD", title: "Đổi ly", pointsCost: 500, discountAmount: null };
  const unlinked = await request("/api/merchant/vouchers", "POST", merchantAToken, {
    ...fields, rewardDescription: "Một chiếc ly",
  });
  assert.equal(unlinked.response.status, 400);
  assert.equal(unlinked.json.error, "INVALID_INPUT");

  const ownProductId = await createRewardProduct("Ly sứ", merchantAToken);
  const reward = await request("/api/merchant/vouchers", "POST", merchantAToken, {
    ...fields, rewardProductId: ownProductId,
  });
  assert.equal(reward.response.status, 201);
  assert.equal(reward.json.definition.rewardProductId, ownProductId);
  assert.equal(reward.json.definition.rewardDescription, "Ly sứ");
  assert.equal(reward.json.definition.discountAmount, null);

  const foreignProductId = await createRewardProduct("Ly quà của cửa hàng khác", merchantBToken);
  const hidden = await request(`/api/merchant/products/${ownProductId}`, "PATCH", merchantAToken, { status: "HIDDEN" });
  assert.equal(hidden.response.status, 200);
  for (const [label, rewardProductId] of [
    ["sale product", productAId],
    ["foreign reward product", foreignProductId],
    ["hidden reward product", ownProductId],
  ] as const) {
    const rejected = await request("/api/merchant/vouchers", "POST", merchantAToken, { ...fields, rewardProductId });
    assert.equal(rejected.response.status, 404, label);
    assert.equal(rejected.json.error, "REWARD_PRODUCT_NOT_FOUND", label);
  }
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
  const wallet = await prisma.loyaltyWallet.create({ data: { membershipId: membership.id, exactBalance: 200, netLifetimeEarned: 200 } });
  await prisma.pointTransaction.create({ data: { walletId: wallet.id, type: "EARN", delta: 200, balanceAfter: 200, reason: "fixture" } });
  const concurrent = await Promise.all([
    request(`/api/member/vouchers/${definition.json.definition.id}/redeem`, "POST", memberToken, undefined, { headers: { "Idempotency-Key": randomUUID() } }),
    request(`/api/member/vouchers/${definition.json.definition.id}/redeem`, "POST", memberToken, undefined, { headers: { "Idempotency-Key": randomUUID() } }),
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

  const rewardProductId = await createRewardProduct("Cốc xanh", merchantAToken);
  const rewardDefinition = await request("/api/merchant/vouchers", "POST", merchantAToken, {
    type: "REWARD", title: "Cốc quà", pointsCost: 100, discountAmount: null, rewardProductId,
  });
  assert.equal(rewardDefinition.response.status, 201);
  await prisma.loyaltyWallet.update({ where: { id: wallet.id }, data: { exactBalance: 100 } });
  const rewardRedemption = await request(`/api/member/vouchers/${rewardDefinition.json.definition.id}/redeem`, "POST", memberToken, undefined, { headers: { "Idempotency-Key": randomUUID() } });
  assert.equal(rewardRedemption.response.status, 201);
  assert.equal(rewardRedemption.json.voucher.type, "REWARD");
  assert.equal(rewardRedemption.json.voucher.rewardDescription, "Cốc xanh");
  const rewardLedger = await prisma.pointTransaction.findFirstOrThrow({ where: { memberVoucherId: rewardRedemption.json.voucher.id, type: "REDEEM_REWARD" } });
  assert.equal(rewardLedger.type, "REDEEM_REWARD");
  assert.equal(rewardLedger.delta.toString(), "-100");
});

test("discount snapshot is reserved once and used only on a committed pay", async () => {
  const discountDefinition = await request("/api/merchant/vouchers", "POST", merchantAToken, { type: "DISCOUNT", title: "Giảm 20k", pointsCost: 1, discountAmount: "20000" });
  assert.equal(discountDefinition.response.status, 201);
  const membership = await prisma.merchantMembership.findUniqueOrThrow({ where: { memberId_merchantId: { memberId, merchantId: merchantAId } }, include: { wallet: true } });
  const wallet = await prisma.loyaltyWallet.update({ where: { id: membership.wallet!.id }, data: { exactBalance: 2 } });
  const discountVoucher = await prisma.memberVoucher.create({ data: { membershipId: membership.id, definitionId: discountDefinition.json.definition.id, snapshotType: "DISCOUNT", snapshotTitle: "Giảm 20k", snapshotPointsCost: 1, snapshotDiscountAmount: "20000", snapshotRewardDescription: null } });
  await request(`/api/merchant/vouchers/${discountDefinition.json.definition.id}`, "PATCH", merchantAToken, { title: "Mẫu mới", discountAmount: "250000", isActive: false });
  await prisma.loyaltyWallet.update({ where: { id: wallet.id }, data: { netLifetimeEarned: 2147483647 } });

  const otherMember = await request("/api/orders", "POST", otherToken, { productId: productAId, quantity: 1, voucherId: discountVoucher.id });
  assert.equal(otherMember.response.status, 404);
  const crossMerchant = await request("/api/orders", "POST", memberToken, { productId: productBId, quantity: 1, voucherId: discountVoucher.id });
  assert.equal(crossMerchant.response.status, 404);
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
  const reservedList = await request(`/api/member/merchants/${merchantAId}/vouchers`, "GET", memberToken);
  const reservedVoucher = (reservedList.json.vouchers as any[]).find((voucher) => voucher.id === discountVoucher.id);
  assert.equal(reservedVoucher.status, "AVAILABLE");
  assert.equal(reservedVoucher.reserved, true);
  assert.deepEqual((await request(`/api/member/merchants/${merchantAId}/vouchers`, "GET", otherToken)).json.vouchers, []);
  assert.deepEqual((await request(`/api/member/merchants/${merchantBId}/vouchers`, "GET", memberToken)).json.vouchers, []);
  assert.equal((await prisma.memberVoucher.findUniqueOrThrow({ where: { id: discountVoucher.id } })).status, "AVAILABLE");
  const paid = await request(`/api/orders/${order.id}/pay`, "POST", memberToken);
  assert.equal(paid.response.status, 409);
  assert.equal(paid.json.error, "LOYALTY_LIMIT_EXCEEDED");
  const failedPayment = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  assert.equal(failedPayment.status, "PENDING");
  assert.equal((await prisma.memberVoucher.findUniqueOrThrow({ where: { id: discountVoucher.id } })).status, "AVAILABLE");
  const heldAfterFailedPay = await request(`/api/member/merchants/${merchantAId}/vouchers`, "GET", memberToken);
  assert.equal((heldAfterFailedPay.json.vouchers as any[]).find((voucher) => voucher.id === discountVoucher.id).reserved, true);
  await prisma.loyaltyWallet.update({ where: { id: wallet.id }, data: { netLifetimeEarned: 0 } });
  const successfulPay = await request(`/api/orders/${order.id}/pay`, "POST", memberToken);
  assert.equal(successfulPay.response.status, 200);
  assert.equal(successfulPay.json.order.total, "180000");
  assert.equal((await prisma.pointTransaction.findFirstOrThrow({ where: { orderId: order.id, type: "EARN" } })).delta.toString(), "18");
  const usedVoucher = await prisma.memberVoucher.findUniqueOrThrow({ where: { id: discountVoucher.id } });
  assert.equal(usedVoucher.status, "USED");
  assert.ok(usedVoucher.usedAt);
  const usedList = await request(`/api/member/merchants/${merchantAId}/vouchers`, "GET", memberToken);
  const usedDto = (usedList.json.vouchers as any[]).find((voucher) => voucher.id === discountVoucher.id);
  assert.equal(usedDto.status, "USED");
  assert.equal(usedDto.reserved, false);
});

test("hiding a reward product blocks new redemptions and preserves issued rewards for fulfillment", async () => {
  const rewardProductId = await createRewardProduct("Bình nước", merchantBToken);
  const created = await request("/api/merchant/vouchers", "POST", merchantBToken, {
    type: "REWARD", title: "Đổi bình nước", pointsCost: 100, discountAmount: null, rewardProductId,
  });
  assert.equal(created.response.status, 201);
  const definitionId = created.json.definition.id as number;
  const publicPath = `/api/merchants/${merchantBId}/vouchers`;
  const redeemPath = `/api/member/vouchers/${definitionId}/redeem`;
  const publicList = await request(publicPath);
  assert.equal(publicList.response.status, 200);
  assert.ok((publicList.json.definitions as any[]).some((definition) => definition.id === definitionId));

  const membership = await prisma.merchantMembership.create({ data: { memberId, merchantId: merchantBId } });
  const wallet = await prisma.loyaltyWallet.create({ data: { membershipId: membership.id, exactBalance: 200, netLifetimeEarned: 200 } });
  const redeemed = await request(redeemPath, "POST", memberToken, undefined, { headers: { "Idempotency-Key": randomUUID() } });
  assert.equal(redeemed.response.status, 201);
  assert.equal(redeemed.json.voucher.rewardDescription, "Bình nước");
  assert.equal(redeemed.json.wallet.availablePoints, 100);
  const voucherId = redeemed.json.voucher.id as number;
  const rewardAtCheckout = await request("/api/orders", "POST", memberToken, { productId: productBId, quantity: 1, voucherId });
  assert.equal(rewardAtCheckout.response.status, 404);

  const hidden = await request(`/api/merchant/products/${rewardProductId}`, "PATCH", merchantBToken, { status: "HIDDEN" });
  assert.equal(hidden.response.status, 200);
  const hiddenList = await request(publicPath);
  assert.equal(hiddenList.response.status, 200);
  assert.equal((hiddenList.json.definitions as any[]).some((definition) => definition.id === definitionId), false);
  const rejected = await request(redeemPath, "POST", memberToken, undefined, { headers: { "Idempotency-Key": randomUUID() } });
  assert.equal(rejected.response.status, 404);
  assert.equal(rejected.json.error, "VOUCHER_DEFINITION_NOT_FOUND");
  assert.equal((await prisma.loyaltyWallet.findUniqueOrThrow({ where: { id: wallet.id } })).exactBalance.toString(), "100");

  const fulfillmentList = await request("/api/merchant/rewards", "GET", merchantBToken);
  assert.equal(fulfillmentList.response.status, 200);
  assert.equal((fulfillmentList.json.rewards as any[]).find((voucher) => voucher.id === voucherId)?.status, "PENDING_FULFILLMENT");
  const fulfillPath = `/api/merchant/rewards/${voucherId}/fulfill`;
  const foreignFulfillment = await request(fulfillPath, "POST", merchantAToken, {});
  assert.equal(foreignFulfillment.response.status, 404);
  const fulfilled = await request(fulfillPath, "POST", merchantBToken, { note: "Đã trao" });
  assert.equal(fulfilled.response.status, 200);
  assert.equal(fulfilled.json.reward.status, "FULFILLED");
  const repeated = await request(fulfillPath, "POST", merchantBToken, {});
  assert.equal(repeated.response.status, 409);
  const [history, foreignHistory] = await Promise.all([
    request("/api/merchant/rewards", "GET", merchantBToken),
    request("/api/merchant/rewards", "GET", merchantAToken),
  ]);
  assert.equal(history.response.status, 200);
  assert.equal((history.json.rewards as any[]).find((voucher) => voucher.id === voucherId)?.status, "FULFILLED");
  assert.equal(foreignHistory.response.status, 200);
  assert.equal((foreignHistory.json.rewards as any[]).some((voucher) => voucher.id === voucherId), false);
});

test("existing unlinked reward definitions remain redeemable", async () => {
  const definition = await prisma.voucherDefinition.create({ data: {
    merchantId: merchantBId, type: "REWARD", title: "Quà trước đây", pointsCost: 50, rewardDescription: "Ly sưu tầm",
  } });
  const membership = await prisma.merchantMembership.create({ data: { memberId: fixtureIds[3], merchantId: merchantBId } });
  await prisma.loyaltyWallet.create({ data: { membershipId: membership.id, exactBalance: 50, netLifetimeEarned: 50 } });

  const publicList = await request(`/api/merchants/${merchantBId}/vouchers`);
  assert.equal(publicList.response.status, 200);
  const listed = (publicList.json.definitions as any[]).find((item) => item.id === definition.id);
  assert.equal(listed?.rewardProductId, null);
  assert.equal(listed?.rewardDescription, "Ly sưu tầm");
  const redeemed = await request(`/api/member/vouchers/${definition.id}/redeem`, "POST", otherToken, undefined, { headers: { "Idempotency-Key": randomUUID() } });
  assert.equal(redeemed.response.status, 201);
  assert.equal(redeemed.json.voucher.rewardDescription, "Ly sưu tầm");
  assert.equal(redeemed.json.wallet.availablePoints, 0);
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
  assert.equal((await prisma.pointTransaction.findFirstOrThrow({ where: { orderId: created.json.order.id, type: "EARN" } })).delta.toString(), "0");
  const wallet = await request(`/api/member/merchants/${merchantAId}/wallet`, "GET", otherToken);
  assert.equal(wallet.json.wallet.availablePoints, 0);
  assert.equal(wallet.json.wallet.lifetimeEarnedPoints, 0);
  assert.equal(wallet.json.wallet.tier, "BRONZE");
});

test("m5 reward fulfillment cancellation: success refunds exact integer points and records audit", async () => {
  const rewardProductId = await createRewardProduct("Quà tặng M5", merchantAToken);
  const rewardDef = await request("/api/merchant/vouchers", "POST", merchantAToken, {
    type: "REWARD", title: "Đổi quà tặng M5", pointsCost: 150, discountAmount: null, rewardProductId,
  });
  assert.equal(rewardDef.response.status, 201);
  const definitionId = rewardDef.json.definition.id as number;

  const membership = await prisma.merchantMembership.findUniqueOrThrow({
    where: { memberId_merchantId: { memberId, merchantId: merchantAId } },
    include: { wallet: true },
  });
  await prisma.loyaltyWallet.update({
    where: { id: membership.wallet!.id },
    data: { exactBalance: 300, netLifetimeEarned: 300 },
  });

  const redeemed = await request(`/api/member/vouchers/${definitionId}/redeem`, "POST", memberToken, undefined, {
    headers: { "Idempotency-Key": randomUUID() },
  });
  assert.equal(redeemed.response.status, 201);
  assert.equal(redeemed.json.voucher.status, "PENDING_FULFILLMENT");
  assert.equal(redeemed.json.wallet.availablePoints, 150);
  const voucherId = redeemed.json.voucher.id as number;

  // Merchant cancels the unfulfilled reward
  const cancelRes = await request(`/api/merchant/rewards/${voucherId}/cancel`, "POST", merchantAToken, {
    reason: "Item damaged during preparation",
  });
  assert.equal(cancelRes.response.status, 200);

  // Check response DTO
  const { reward, wallet } = cancelRes.json;
  assert.equal(reward.status, "CANCELLED");
  assert.equal(reward.memberVoucherId, voucherId);
  assert.equal(reward.memberId, memberId);
  assert.equal(reward.memberEmail, emails[2]);
  assert.equal(reward.title, "Đổi quà tặng M5");
  assert.equal(reward.pointsCost, 150);
  assert.ok(reward.cancelledAt);
  assert.equal(reward.cancelledById, fixtureIds[0]);
  assert.equal(reward.cancellationReason, "Item damaged during preparation");
  assert.equal(reward.fulfilledAt, null);
  assert.equal(reward.fulfilledById, null);

  // Check wallet refund
  assert.equal(wallet.exactBalance, "300");
  assert.equal(wallet.availablePoints, 300);
  assert.equal(wallet.pointDebt, "0");
  assert.equal(wallet.netLifetimeEarned, "300");

  // Check DB state
  const dbVoucher = await prisma.memberVoucher.findUniqueOrThrow({
    where: { id: voucherId },
    include: { cancellation: true },
  });
  assert.equal(dbVoucher.status, "CANCELLED");
  assert.ok(dbVoucher.cancellation);
  assert.equal(dbVoucher.cancellation.cancelledById, fixtureIds[0]);
  assert.equal(dbVoucher.cancellation.reason, "Item damaged during preparation");

  const ledger = await prisma.pointTransaction.findFirstOrThrow({
    where: { memberVoucherId: voucherId, type: "REDEMPTION_REVERSAL" },
  });
  assert.equal(ledger.delta.toString(), "150");
  assert.equal(ledger.balanceAfter.toString(), "300");
  assert.equal(ledger.source, "MERCHANT_REWARD_CANCELLATION");
  assert.equal(ledger.actorId, fixtureIds[0]);
  assert.equal(ledger.eventRef, `reward-cancellation-${voucherId}`);

  // Check GET /api/merchant/rewards queue exposes cancelled status and audit
  const queue = await request("/api/merchant/rewards", "GET", merchantAToken);
  assert.equal(queue.response.status, 200);
  const queueItem = (queue.json.rewards as any[]).find((r) => r.memberVoucherId === voucherId);
  assert.ok(queueItem);
  assert.equal(queueItem.status, "CANCELLED");
  assert.equal(queueItem.cancelledById, fixtureIds[0]);
  assert.equal(queueItem.cancellationReason, "Item damaged during preparation");
  assert.ok(queueItem.cancelledAt);
});

test("m5 reward cancellation: debt recovery pays down pointDebt before available points without changing tier or lifetime", async () => {
  const membership = await prisma.merchantMembership.findUniqueOrThrow({
    where: { memberId_merchantId: { memberId, merchantId: merchantAId } },
    include: { wallet: true },
  });
  // Simulate member having debt (negative exact balance) from a prior refund/reversal
  await prisma.loyaltyWallet.update({
    where: { id: membership.wallet!.id },
    data: { exactBalance: "-40.5", netLifetimeEarned: "500" },
  });

  const rewardDef = await request("/api/merchant/vouchers", "POST", merchantAToken, {
    type: "REWARD", title: "Quà nợ", pointsCost: 100, discountAmount: null, rewardProductId: productAId,
  });
  // Use productAId or a reward product
  const rewardProductId = await createRewardProduct("Quà nợ sp", merchantAToken);
  const def = await request("/api/merchant/vouchers", "POST", merchantAToken, {
    type: "REWARD", title: "Quà nợ sp", pointsCost: 100, discountAmount: null, rewardProductId,
  });
  assert.equal(def.response.status, 201);

  // Directly create an unfulfilled member voucher to test cancellation against existing debt
  const voucher = await prisma.memberVoucher.create({
    data: {
      membershipId: membership.id,
      definitionId: def.json.definition.id,
      snapshotType: "REWARD",
      snapshotTitle: "Quà nợ sp",
      snapshotPointsCost: 100,
      snapshotDiscountAmount: null,
      snapshotRewardDescription: "Quà nợ sp",
      status: "PENDING_FULFILLMENT",
    },
  });

  // Cancel the 100 point reward: -40.5 + 100 = 59.5
  const cancelRes = await request(`/api/merchant/rewards/${voucher.id}/cancel`, "POST", merchantAToken, {
    reason: "Debt recovery test",
  });
  assert.equal(cancelRes.response.status, 200);

  const wallet = cancelRes.json.wallet;
  // Debt of 40.5 should be completely paid down to 0
  assert.equal(wallet.pointDebt, "0");
  assert.equal(wallet.availablePoints, 59);
  assert.equal(wallet.fractionalCarry, "0.5");
  assert.equal(wallet.exactBalance, "59.5");
  assert.equal(wallet.netLifetimeEarned, "500");

  // Test partial debt recovery where debt exceeds refund: -150.25 + 50 = -100.25
  await prisma.loyaltyWallet.update({
    where: { id: membership.wallet!.id },
    data: { exactBalance: "-150.25", netLifetimeEarned: "500" },
  });
  const voucher2 = await prisma.memberVoucher.create({
    data: {
      membershipId: membership.id,
      definitionId: def.json.definition.id,
      snapshotType: "REWARD",
      snapshotTitle: "Quà nợ 50",
      snapshotPointsCost: 50,
      snapshotDiscountAmount: null,
      snapshotRewardDescription: "Quà nợ 50",
      status: "PENDING_FULFILLMENT",
    },
  });

  const cancelRes2 = await request(`/api/merchant/rewards/${voucher2.id}/cancel`, "POST", merchantAToken, {
    reason: "Partial debt recovery",
  });
  assert.equal(cancelRes2.response.status, 200);
  const wallet2 = cancelRes2.json.wallet;
  assert.equal(wallet2.exactBalance, "-100.25");
  assert.equal(wallet2.pointDebt, "100.25");
  assert.equal(wallet2.availablePoints, 0);
  assert.equal(wallet2.fractionalCarry, "0");
  assert.equal(wallet2.netLifetimeEarned, "500");
});

test("m5 reward cancellation: duplicate cancellation does not credit twice and rejects with 409", async () => {
  const rewardProductId = await createRewardProduct("Quà trùng lặp", merchantAToken);
  const def = await request("/api/merchant/vouchers", "POST", merchantAToken, {
    type: "REWARD", title: "Quà trùng lặp", pointsCost: 100, discountAmount: null, rewardProductId,
  });
  assert.equal(def.response.status, 201);

  const membership = await prisma.merchantMembership.findUniqueOrThrow({
    where: { memberId_merchantId: { memberId, merchantId: merchantAId } },
    include: { wallet: true },
  });
  await prisma.loyaltyWallet.update({
    where: { id: membership.wallet!.id },
    data: { exactBalance: 200, netLifetimeEarned: 200 },
  });

  const redeemed = await request(`/api/member/vouchers/${def.json.definition.id}/redeem`, "POST", memberToken, undefined, {
    headers: { "Idempotency-Key": randomUUID() },
  });
  assert.equal(redeemed.response.status, 201);
  const voucherId = redeemed.json.voucher.id as number;

  // First cancellation: succeeds
  const res1 = await request(`/api/merchant/rewards/${voucherId}/cancel`, "POST", merchantAToken, { reason: "Lần 1" });
  assert.equal(res1.response.status, 200);
  assert.equal(res1.json.reward.status, "CANCELLED");

  // Second sequential cancellation: clearly rejects with 409
  const res2 = await request(`/api/merchant/rewards/${voucherId}/cancel`, "POST", merchantAToken, { reason: "Lần 2" });
  assert.equal(res2.response.status, 409);
  assert.equal(res2.json.error, "REWARD_ALREADY_CANCELLED");

  // Verify only 1 REDEMPTION_REVERSAL was written
  const txCount = await prisma.pointTransaction.count({
    where: { memberVoucherId: voucherId, type: "REDEMPTION_REVERSAL" },
  });
  assert.equal(txCount, 1);

  // Concurrent duplicate cancellation test
  const def2 = await request("/api/merchant/vouchers", "POST", merchantAToken, {
    type: "REWARD", title: "Quà race", pointsCost: 80, discountAmount: null, rewardProductId,
  });
  const redeemed2 = await request(`/api/member/vouchers/${def2.json.definition.id}/redeem`, "POST", memberToken, undefined, {
    headers: { "Idempotency-Key": randomUUID() },
  });
  assert.equal(redeemed2.response.status, 201);
  const voucherId2 = redeemed2.json.voucher.id as number;

  const [race1, race2] = await Promise.all([
    request(`/api/merchant/rewards/${voucherId2}/cancel`, "POST", merchantAToken, { reason: "Race 1" }),
    request(`/api/merchant/rewards/${voucherId2}/cancel`, "POST", merchantAToken, { reason: "Race 2" }),
  ]);
  const statuses = [race1.response.status, race2.response.status].sort();
  assert.deepEqual(statuses, [200, 409]);

  const raceTxCount = await prisma.pointTransaction.count({
    where: { memberVoucherId: voucherId2, type: "REDEMPTION_REVERSAL" },
  });
  assert.equal(raceTxCount, 1);
});

test("m5 reward cancellation: wrong merchant and discount vouchers reject clearly", async () => {
  const rewardProductId = await createRewardProduct("Quà riêng A", merchantAToken);
  const defA = await request("/api/merchant/vouchers", "POST", merchantAToken, {
    type: "REWARD", title: "Quà riêng A", pointsCost: 50, discountAmount: null, rewardProductId,
  });
  assert.equal(defA.response.status, 201);

  const membership = await prisma.merchantMembership.findUniqueOrThrow({
    where: { memberId_merchantId: { memberId, merchantId: merchantAId } },
    include: { wallet: true },
  });
  await prisma.loyaltyWallet.update({
    where: { id: membership.wallet!.id },
    data: { exactBalance: 100, netLifetimeEarned: 100 },
  });

  const redeemed = await request(`/api/member/vouchers/${defA.json.definition.id}/redeem`, "POST", memberToken, undefined, {
    headers: { "Idempotency-Key": randomUUID() },
  });
  assert.equal(redeemed.response.status, 201);
  const voucherId = redeemed.json.voucher.id as number;

  // Merchant B tries to cancel Merchant A's reward -> 404
  const foreignCancel = await request(`/api/merchant/rewards/${voucherId}/cancel`, "POST", merchantBToken, {
    reason: "Steal",
  });
  assert.equal(foreignCancel.response.status, 404);
  assert.equal(foreignCancel.json.error, "REWARD_NOT_FOUND");

  // Member voucher is unchanged
  const voucher = await prisma.memberVoucher.findUniqueOrThrow({ where: { id: voucherId } });
  assert.equal(voucher.status, "PENDING_FULFILLMENT");

  // Merchant A tries to cancel a DISCOUNT voucher via rewards route -> 404
  const discountDef = await request("/api/merchant/vouchers", "POST", merchantAToken, {
    type: "DISCOUNT", title: "Giảm 10k", pointsCost: 10, discountAmount: "10000",
  });
  const discountRedeemed = await request(`/api/member/vouchers/${discountDef.json.definition.id}/redeem`, "POST", memberToken, undefined, {
    headers: { "Idempotency-Key": randomUUID() },
  });
  assert.equal(discountRedeemed.response.status, 201);
  const discountVoucherId = discountRedeemed.json.voucher.id as number;

  const discountCancel = await request(`/api/merchant/rewards/${discountVoucherId}/cancel`, "POST", merchantAToken, {
    reason: "Cancel discount as reward",
  });
  assert.equal(discountCancel.response.status, 404);
  assert.equal(discountCancel.json.error, "REWARD_NOT_FOUND");
});

test("m5 reward cancellation: fulfill-then-cancel and cancel-then-fulfill rejections", async () => {
  const rewardProductId = await createRewardProduct("Quà fulfill race", merchantAToken);
  const def = await request("/api/merchant/vouchers", "POST", merchantAToken, {
    type: "REWARD", title: "Quà fulfill race", pointsCost: 50, discountAmount: null, rewardProductId,
  });
  assert.equal(def.response.status, 201);

  const membership = await prisma.merchantMembership.findUniqueOrThrow({
    where: { memberId_merchantId: { memberId, merchantId: merchantAId } },
    include: { wallet: true },
  });
  await prisma.loyaltyWallet.update({
    where: { id: membership.wallet!.id },
    data: { exactBalance: 200, netLifetimeEarned: 200 },
  });

  // Reward 1: fulfill then cancel
  const redeemed1 = await request(`/api/member/vouchers/${def.json.definition.id}/redeem`, "POST", memberToken, undefined, {
    headers: { "Idempotency-Key": randomUUID() },
  });
  const v1Id = redeemed1.json.voucher.id as number;

  const fulfilled = await request(`/api/merchant/rewards/${v1Id}/fulfill`, "POST", merchantAToken, { note: "Đã trao quà" });
  assert.equal(fulfilled.response.status, 200);
  assert.equal(fulfilled.json.reward.status, "FULFILLED");
  assert.equal(fulfilled.json.reward.memberVoucherId, v1Id);
  assert.ok(fulfilled.json.reward.fulfilledAt);
  assert.equal(fulfilled.json.reward.fulfilledById, fixtureIds[0]);

  // Attempt to cancel fulfilled reward -> 409
  const cancelFulfilled = await request(`/api/merchant/rewards/${v1Id}/cancel`, "POST", merchantAToken, { reason: "Cancel after fulfill" });
  assert.equal(cancelFulfilled.response.status, 409);
  assert.equal(cancelFulfilled.json.error, "REWARD_ALREADY_FULFILLED");

  // Reward 2: cancel then fulfill
  const redeemed2 = await request(`/api/member/vouchers/${def.json.definition.id}/redeem`, "POST", memberToken, undefined, {
    headers: { "Idempotency-Key": randomUUID() },
  });
  const v2Id = redeemed2.json.voucher.id as number;

  const cancelled = await request(`/api/merchant/rewards/${v2Id}/cancel`, "POST", merchantAToken, { reason: "Cancel first" });
  assert.equal(cancelled.response.status, 200);
  assert.equal(cancelled.json.reward.status, "CANCELLED");

  // Attempt to fulfill cancelled reward -> 409
  const fulfillCancelled = await request(`/api/merchant/rewards/${v2Id}/fulfill`, "POST", merchantAToken, { note: "Fulfill after cancel" });
  assert.equal(fulfillCancelled.response.status, 409);
  assert.equal(fulfillCancelled.json.error, "REWARD_ALREADY_CANCELLED");
});

test("m5 reward cancellation: migration data preservation backfills REWARD vouchers and preserves DISCOUNT vouchers", async () => {
  const membership = await prisma.merchantMembership.findUniqueOrThrow({
    where: { memberId_merchantId: { memberId, merchantId: merchantAId } },
  });

  const discountDef = await prisma.voucherDefinition.create({
    data: {
      merchantId: merchantAId,
      type: "DISCOUNT",
      title: "M5 Test Discount Def",
      pointsCost: 10,
      discountAmount: "10000",
      rewardDescription: null,
    },
  });
  const rewardDef = await prisma.voucherDefinition.create({
    data: {
      merchantId: merchantAId,
      type: "REWARD",
      title: "M5 Test Reward Def",
      pointsCost: 50,
      discountAmount: null,
      rewardDescription: "Quà test backfill",
    },
  });

  // Create pre-migration vouchers directly
  const discountAvailable = await prisma.memberVoucher.create({
    data: {
      membershipId: membership.id,
      definitionId: discountDef.id,
      snapshotType: "DISCOUNT",
      snapshotTitle: "Discount Avail",
      snapshotPointsCost: 10,
      snapshotDiscountAmount: "10000",
      snapshotRewardDescription: null,
      status: "AVAILABLE",
    },
  });
  const discountUsed = await prisma.memberVoucher.create({
    data: {
      membershipId: membership.id,
      definitionId: discountDef.id,
      snapshotType: "DISCOUNT",
      snapshotTitle: "Discount Used",
      snapshotPointsCost: 10,
      snapshotDiscountAmount: "10000",
      snapshotRewardDescription: null,
      status: "USED",
    },
  });
  // Simulate legacy unfulfilled reward voucher that had status AVAILABLE
  const rewardLegacy = await prisma.memberVoucher.create({
    data: {
      membershipId: membership.id,
      definitionId: rewardDef.id,
      snapshotType: "REWARD",
      snapshotTitle: "Reward Legacy",
      snapshotPointsCost: 50,
      snapshotDiscountAmount: null,
      snapshotRewardDescription: "Quà test backfill",
      status: "AVAILABLE",
    },
  });
  const rewardFulfilled = await prisma.memberVoucher.create({
    data: {
      membershipId: membership.id,
      definitionId: rewardDef.id,
      snapshotType: "REWARD",
      snapshotTitle: "Reward Fulfilled",
      snapshotPointsCost: 50,
      snapshotDiscountAmount: null,
      snapshotRewardDescription: "Quà test backfill",
      status: "FULFILLED",
    },
  });

  // Execute the exact migration backfill SQL
  await prisma.$executeRawUnsafe(
    "UPDATE `MemberVoucher` SET `status` = 'PENDING_FULFILLMENT' WHERE `snapshotType` = 'REWARD' AND `status` = 'AVAILABLE';"
  );

  // Verify discount vouchers are preserved
  const checkDiscountAvail = await prisma.memberVoucher.findUniqueOrThrow({ where: { id: discountAvailable.id } });
  assert.equal(checkDiscountAvail.status, "AVAILABLE");

  const checkDiscountUsed = await prisma.memberVoucher.findUniqueOrThrow({ where: { id: discountUsed.id } });
  assert.equal(checkDiscountUsed.status, "USED");

  // Verify reward voucher was backfilled
  const checkRewardLegacy = await prisma.memberVoucher.findUniqueOrThrow({ where: { id: rewardLegacy.id } });
  assert.equal(checkRewardLegacy.status, "PENDING_FULFILLMENT");

  // Verify fulfilled reward was untouched
  const checkRewardFulfilled = await prisma.memberVoucher.findUniqueOrThrow({ where: { id: rewardFulfilled.id } });
  assert.equal(checkRewardFulfilled.status, "FULFILLED");

  // Backfilled reward is cancelable
  const cancelBackfilled = await request(`/api/merchant/rewards/${rewardLegacy.id}/cancel`, "POST", merchantAToken, {
    reason: "Cancelled after backfill",
  });
  assert.equal(cancelBackfilled.response.status, 200);
  assert.equal(cancelBackfilled.json.reward.status, "CANCELLED");
});

