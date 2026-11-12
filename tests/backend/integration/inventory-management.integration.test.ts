import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import {
  cleanup,
  createMember,
  createOrder,
  createShop,
  env,
  prisma,
  request,
  savePolicy,
  start,
  type Member,
  type Shop,
} from "./exact-points.fixtures.js";
import { releaseExpiredMockOrders } from "../../../apps/backend/src/modules/inventory/inventory.order.js";

const target = new URL(env.databaseUrl ?? "http://invalid");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(target.hostname), "inventory integration tests require local MySQL");
assert.equal(decodeURIComponent(target.pathname.slice(1)), "incomsg-test", "inventory integration tests must never write to incomsg");

before(start);
after(cleanup);

type Inventory = { onHandQuantity: number; reservedQuantity: number; availableQuantity: number };
type Adjustment = { inventory: Inventory; replayed?: boolean };
type Movement = {
  movementType: string;
  quantityDelta: number;
  reason: string;
  actorId: number | null;
  orderId: number | null;
  memberVoucherId: number | null;
};

async function adjustStock(
  shop: Shop,
  ownerType: "products" | "rewards" | "vouchers",
  itemId: number,
  direction: "in" | "out",
  quantity: number,
  reason: string,
  key = randomUUID(),
) {
  return request<Adjustment>(
    `/api/merchant/${ownerType}/${itemId}/stock/${direction}`,
    "POST",
    shop.token,
    { quantity, reason },
    { "Idempotency-Key": key },
  );
}

async function inventory(shop: Shop, ownerType: "products" | "rewards" | "vouchers", itemId: number) {
  return request<{ inventory: Inventory; movements: Movement[] }>(
    `/api/merchant/${ownerType}/${itemId}/stock/movements`,
    "GET",
    shop.token,
  );
}

test("sale stock is audited and reserved, consumed, cancelled, and expired exactly once", async () => {
  const shop = await createShop("10000", "1.00", 0);
  const otherShop = await createShop("10000");
  const member = await createMember();
  const stockKey = `stock-in-${randomUUID()}`;

  const stocked = await adjustStock(shop, "products", shop.productId, "in", 4, "Initial counted stock", stockKey);
  assert.equal(stocked.status, 200);
  assert.deepEqual(stocked.json.inventory, { onHandQuantity: 4, reservedQuantity: 0, availableQuantity: 4 });
  const replay = await adjustStock(shop, "products", shop.productId, "in", 4, "Initial counted stock", stockKey);
  assert.equal(replay.status, 200);
  assert.equal(replay.json.replayed, true);
  const conflict = await adjustStock(shop, "products", shop.productId, "in", 3, "Changed quantity", stockKey);
  assert.equal(conflict.status, 409);

  const history = await inventory(shop, "products", shop.productId);
  assert.equal(history.status, 200);
  const initialMovement = history.json.movements.find((movement) => movement.reason === "Initial counted stock");
  assert.ok(initialMovement);
  assert.equal(initialMovement.actorId, Number((await prisma.merchant.findUniqueOrThrow({ where: { id: shop.id } })).ownerId));
  assert.equal(initialMovement.quantityDelta, 4);

  const isolated = await inventory(otherShop, "products", shop.productId);
  assert.equal(isolated.status, 404);
  const crossTenantWrite = await adjustStock(otherShop, "products", shop.productId, "in", 1, "Must be rejected");
  assert.equal(crossTenantWrite.status, 404);

  const order = await createOrder(shop, member) as { id: number; stockReservedUntil: string | null };
  assert.ok(order.stockReservedUntil);
  const until = new Date(order.stockReservedUntil).getTime();
  assert.ok(until > Date.now() && until <= Date.now() + 5 * 60 * 1000 + 5000);
  assert.deepEqual((await inventory(shop, "products", shop.productId)).json.inventory,
    { onHandQuantity: 4, reservedQuantity: 1, availableQuantity: 3 });

  const paid = await request<{ order: { status: string } }>(`/api/orders/${order.id}/pay`, "POST", member.token);
  assert.equal(paid.status, 200);
  assert.equal(paid.json.order.status, "PAID");
  const duplicatePay = await request(`/api/orders/${order.id}/pay`, "POST", member.token);
  assert.equal(duplicatePay.status, 409);
  assert.deepEqual((await inventory(shop, "products", shop.productId)).json.inventory,
    { onHandQuantity: 3, reservedQuantity: 0, availableQuantity: 3 });
  const saleMovements = await prisma.inventoryMovement.findMany({ where: { orderId: order.id } });
  assert.deepEqual(saleMovements.map(({ movementType }) => movementType).sort(), ["ORDER_RESERVE", "SALE_OUT"]);

  const cancelled = await createOrder(shop, member);
  const cancelResult = await request(`/api/orders/${cancelled.id}/cancel`, "POST", member.token);
  assert.equal(cancelResult.status, 200);
  assert.deepEqual((await inventory(shop, "products", shop.productId)).json.inventory,
    { onHandQuantity: 3, reservedQuantity: 0, availableQuantity: 3 });

  const expired = await createOrder(shop, member);
  await prisma.order.update({ where: { id: expired.id }, data: { stockReservedUntil: new Date(Date.now() - 1000) } });
  assert.deepEqual(await releaseExpiredMockOrders(), { released: 1 });
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: expired.id } })).status, "CANCELLED");
  assert.deepEqual((await inventory(shop, "products", shop.productId)).json.inventory,
    { onHandQuantity: 3, reservedQuantity: 0, availableQuantity: 3 });

  const reserved = await createOrder(shop, member);
  const cannotRemoveReserved = await adjustStock(shop, "products", shop.productId, "out", 3, "Would consume reserved unit");
  assert.equal(cannotRemoveReserved.status, 409);
  const stockOut = await adjustStock(shop, "products", shop.productId, "out", 2, "Damaged after inspection");
  assert.equal(stockOut.status, 200);
  assert.deepEqual(stockOut.json.inventory, { onHandQuantity: 1, reservedQuantity: 1, availableQuantity: 0 });
  await request(`/api/orders/${reserved.id}/cancel`, "POST", member.token);
  assert.deepEqual((await inventory(shop, "products", shop.productId)).json.inventory,
    { onHandQuantity: 1, reservedQuantity: 0, availableQuantity: 1 });
});

test("discount issuance and physical reward reservations reconcile with points and movement history", async () => {
  const shop = await createShop("10000", "1.00", 0);
  const otherShop = await createShop("10000");
  const member = await createMember();
  await adjustStock(shop, "products", shop.productId, "in", 6, "Counted for integration flow");
  for (let index = 0; index < 4; index += 1) {
    const order = await createOrder(shop, member);
    assert.equal((await request(`/api/orders/${order.id}/pay`, "POST", member.token)).status, 200);
  }

  const discount = await request<{ definition: { id: number; inventory: { remainingToIssue: number } } }>(
    "/api/merchant/vouchers", "POST", shop.token,
    { type: "DISCOUNT", title: "Finite issue", pointsCost: 1, discountAmount: "500", initialQuantity: 2 },
  );
  assert.equal(discount.status, 201);
  const discountId = discount.json.definition.id;
  const key = `discount-${randomUUID()}`;
  const first = await request<{ voucher: { id: number } }>(`/api/member/vouchers/${discountId}/redeem`, "POST", member.token, undefined, { "Idempotency-Key": key });
  assert.equal(first.status, 201);
  const replay = await request<{ voucher: { id: number } }>(`/api/member/vouchers/${discountId}/redeem`, "POST", member.token, undefined, { "Idempotency-Key": key });
  assert.equal(replay.status, 201);
  assert.equal(replay.json.voucher.id, first.json.voucher.id);
  const second = await request<{ voucher: { id: number } }>(`/api/member/vouchers/${discountId}/redeem`, "POST", member.token, undefined, { "Idempotency-Key": `discount-second-${randomUUID()}` });
  assert.equal(second.status, 201);
  const exhausted = await request<{ error: string }>(`/api/member/vouchers/${discountId}/redeem`, "POST", member.token, undefined, { "Idempotency-Key": `discount-exhausted-${randomUUID()}` });
  assert.equal(exhausted.status, 409);
  assert.equal(exhausted.json.error, "VOUCHER_OUT_OF_STOCK");

  const appliedOrder = await createOrder(shop, member, first.json.voucher.id);
  assert.equal((await request(`/api/orders/${appliedOrder.id}/pay`, "POST", member.token)).status, 200);
  const discountStock = await inventory(shop, "vouchers", discountId);
  assert.equal(discountStock.status, 200);
  assert.deepEqual(discountStock.json.inventory, { onHandQuantity: 0, reservedQuantity: 0, availableQuantity: 0 });
  assert.equal(discountStock.json.movements.filter(({ movementType }) => movementType === "VOUCHER_REDEMPTION_OUT").length, 2);
  assert.equal((await prisma.memberVoucher.findUniqueOrThrow({ where: { id: first.json.voucher.id } })).status, "USED");
  const crossTenantVoucher = await inventory(otherShop, "vouchers", discountId);
  assert.equal(crossTenantVoucher.status, 404);

  const rewardProduct = await request<{ product: { id: number } }>("/api/merchant/products", "POST", shop.token, {
    name: "Physical reward", kind: "REWARD", initialQuantity: 2,
  });
  assert.equal(rewardProduct.status, 201);
  const rewardDefinition = await request<{ definition: { id: number } }>("/api/merchant/vouchers", "POST", shop.token, {
    type: "REWARD", title: "Physical reward", pointsCost: 1, rewardProductId: rewardProduct.json.product.id,
  });
  assert.equal(rewardDefinition.status, 201);
  const definitionId = rewardDefinition.json.definition.id;

  const redeemReward = async () => request<{ voucher: { id: number } }>(
    `/api/member/vouchers/${definitionId}/redeem`, "POST", member.token, undefined,
    { "Idempotency-Key": `reward-${randomUUID()}` },
  );
  const claim = await redeemReward();
  assert.equal(claim.status, 201);
  assert.deepEqual((await inventory(shop, "rewards", rewardProduct.json.product.id)).json.inventory,
    { onHandQuantity: 2, reservedQuantity: 1, availableQuantity: 1 });
  const fulfilled = await request<{ reward: { status: string } }>(`/api/merchant/rewards/${claim.json.voucher.id}/fulfill`, "POST", shop.token, { note: "Handed to member" });
  assert.equal(fulfilled.status, 200);
  assert.equal(fulfilled.json.reward.status, "FULFILLED");
  const duplicateFulfillment = await request(`/api/merchant/rewards/${claim.json.voucher.id}/fulfill`, "POST", shop.token, { note: "Duplicate" });
  assert.equal(duplicateFulfillment.status, 409);

  const cancelledClaim = await redeemReward();
  assert.equal(cancelledClaim.status, 201);
  const pointsBeforeCancel = (await prisma.loyaltyWallet.findFirstOrThrow({ where: { membership: { memberId: member.id, merchantId: shop.id } } })).exactBalance.toFixed();
  const cancelled = await request<{ wallet: { exactBalance: string } }>(`/api/merchant/rewards/${cancelledClaim.json.voucher.id}/cancel`, "POST", shop.token, { reason: "Member could not collect" });
  assert.equal(cancelled.status, 200);
  assert.equal(Number(cancelled.json.wallet.exactBalance), Number(pointsBeforeCancel) + 1);
  const rewardHistory = await inventory(shop, "rewards", rewardProduct.json.product.id);
  assert.deepEqual(rewardHistory.json.inventory, { onHandQuantity: 1, reservedQuantity: 0, availableQuantity: 1 });
  assert.equal(rewardHistory.json.movements.filter(({ movementType }) => movementType === "REWARD_FULFILL_OUT").length, 1);
  assert.equal(rewardHistory.json.movements.filter(({ movementType }) => movementType === "REWARD_CANCEL_RELEASE").length, 1);
  assert.equal(rewardHistory.json.movements.some(({ memberVoucherId }) => memberVoucherId === claim.json.voucher.id), true);
});

test("mock payment freezes the immutable published policy snapshot in member and merchant order detail", async () => {
  const shop = await createShop("10000", "1.00", 0);
  const otherShop = await createShop("10000");
  const member = await createMember();
  await adjustStock(shop, "products", shop.productId, "in", 2, "Policy snapshot checkout stock");
  const historyBefore = await request<{ versions: { id: number; version: number; vndPerPoint: number; publishedById: number | null; tiers: unknown }[] }>(
    "/api/merchant/loyalty/history", "GET", shop.token,
  );
  assert.equal(historyBefore.status, 200);
  const versionOne = historyBefore.json.versions.find(({ version }) => version === 1);
  assert.ok(versionOne);
  assert.equal(versionOne.publishedById, (await prisma.merchant.findUniqueOrThrow({ where: { id: shop.id } })).ownerId);

  const order = await createOrder(shop, member);
  assert.equal((await request(`/api/orders/${order.id}/pay`, "POST", member.token)).status, 200);
  const storedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  assert.equal(storedOrder.loyaltyPolicyVersionId, versionOne.id);
  const memberDetail = await request<{ order: { appliedLoyaltyPolicy: { policyVersionId: number; version: number; vndPerPoint: number; tierLevel: string; tiers: unknown } | null } }>(
    `/api/member/orders/${order.id}`, "GET", member.token,
  );
  assert.equal(memberDetail.status, 200);
  assert.equal(memberDetail.json.order.appliedLoyaltyPolicy?.policyVersionId, versionOne.id);
  assert.equal(memberDetail.json.order.appliedLoyaltyPolicy?.version, 1);
  assert.equal(memberDetail.json.order.appliedLoyaltyPolicy?.vndPerPoint, versionOne.vndPerPoint);
  const merchantDetail = await request<{ order: { appliedLoyaltyPolicy: { policyVersionId: number } | null } }>(
    `/api/merchant/orders/${order.id}`, "GET", shop.token,
  );
  assert.equal(merchantDetail.status, 200);
  assert.equal(merchantDetail.json.order.appliedLoyaltyPolicy?.policyVersionId, versionOne.id);
  assert.equal((await request(`/api/merchant/orders/${order.id}`, "GET", otherShop.token)).status, 404);

  await savePolicy(shop, { rate: 5000, silverThreshold: 1 });
  const historyAfter = await request<{ versions: { id: number; version: number; vndPerPoint: number; tiers: unknown }[] }>(
    "/api/merchant/loyalty/history", "GET", shop.token,
  );
  assert.equal(historyAfter.status, 200);
  const versionOneAfter = historyAfter.json.versions.find(({ id }) => id === versionOne.id);
  assert.deepEqual(versionOneAfter && {
    id: versionOneAfter.id,
    version: versionOneAfter.version,
    vndPerPoint: versionOneAfter.vndPerPoint,
    publishedById: versionOneAfter.publishedById,
    tiers: versionOneAfter.tiers,
  }, {
    id: versionOne.id,
    version: versionOne.version,
    vndPerPoint: versionOne.vndPerPoint,
    publishedById: versionOne.publishedById,
    tiers: versionOne.tiers,
  });
  assert.equal(historyAfter.json.versions[0]?.version, 2);
  assert.equal(historyAfter.json.versions[0]?.vndPerPoint, 5000);
  const legacyOrderStillShowsAppliedVersion = await request<{ order: { appliedLoyaltyPolicy: { policyVersionId: number; version: number } | null } }>(
    `/api/member/orders/${order.id}`, "GET", member.token,
  );
  assert.deepEqual(legacyOrderStillShowsAppliedVersion.json.order.appliedLoyaltyPolicy && {
    policyVersionId: legacyOrderStillShowsAppliedVersion.json.order.appliedLoyaltyPolicy.policyVersionId,
    version: legacyOrderStillShowsAppliedVersion.json.order.appliedLoyaltyPolicy.version,
  }, { policyVersionId: versionOne.id, version: 1 });

  const nextOrder = await createOrder(shop, member);
  assert.equal((await request(`/api/orders/${nextOrder.id}/pay`, "POST", member.token)).status, 200);
  const nextDetail = await request<{ order: { appliedLoyaltyPolicy: { policyVersionId: number; version: number; vndPerPoint: number } | null } }>(
    `/api/merchant/orders/${nextOrder.id}`, "GET", shop.token,
  );
  assert.equal(nextDetail.status, 200);
  assert.equal(nextDetail.json.order.appliedLoyaltyPolicy?.version, 2);
  assert.equal(nextDetail.json.order.appliedLoyaltyPolicy?.vndPerPoint, 5000);
  assert.equal((await request("/api/merchant/loyalty/history", "GET", otherShop.token)).status, 200);
});
