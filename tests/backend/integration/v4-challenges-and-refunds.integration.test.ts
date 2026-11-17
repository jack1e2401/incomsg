import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import type { Server } from "node:http";

process.env.JWT_SECRET ??= "v4-challenges-refund-test-secret-32-bytes";
process.env.PAYMENT_MODE = "mock";
const [{ app }, { prisma }, { signAccessToken }] = await Promise.all([
  import("../../../apps/backend/src/app.js"),
  import("../../../apps/backend/src/lib/prisma.js"),
  import("../../../apps/backend/src/lib/access-token.js"),
]);

type ApiResponse = Record<string, unknown>;
const suffix = randomUUID().slice(0, 8);
const slug = `v4-engine-${suffix}`;
let server: Server;
let base = "";
let merchantToken = "";
let memberToken = "";
let adminToken = "";
let merchantId = 0;
let ownerId = 0;
let memberId = 0;
let adminId = 0;
let productId = 0;
let orderChallengeId = 0;

async function req(path: string, method = "GET", token?: string, body?: unknown) {
  const response = await fetch(base + path, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, json: await response.json() as ApiResponse };
}

before(async () => {
  const [owner, member, admin] = await Promise.all([
    prisma.user.create({ data: { email: `${slug}-owner@test.local`, passwordHash: "x", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: `${slug}-member@test.local`, passwordHash: "x", role: "MEMBER" } }),
    prisma.user.create({ data: { email: `${slug}-admin@test.local`, passwordHash: "x", role: "ADMIN" } }),
  ]);
  ownerId = owner.id; memberId = member.id; adminId = admin.id;
  const store = await prisma.merchant.create({ data: { ownerId, name: slug, slug } });
  merchantId = store.id;
  const product = await prisma.product.create({ data: { merchantId, name: "Test coffee", price: "10000" } });
  productId = product.id;
  await prisma.inventoryBalance.create({ data: { merchantId, ownerType: "SALE_PRODUCT", productId, onHandQuantity: 10 } });
  [merchantToken, memberToken, adminToken] = await Promise.all([signAccessToken(ownerId), signAccessToken(memberId), signAccessToken(adminId)]);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr !== "string");
  base = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.refundRequest.deleteMany({ where: { merchantId } });
  await prisma.orderRefund.deleteMany({ where: { order: { merchantId } } });
  await prisma.challengeProgressEntry.deleteMany({ where: { progress: { challenge: { merchantId } } } });
  await prisma.challengeRewardGrant.deleteMany({ where: { progress: { challenge: { merchantId } } } });
  await prisma.challengeProgress.deleteMany({ where: { challenge: { merchantId } } });
  await prisma.memberActivity.deleteMany({ where: { membership: { merchantId } } });
  await prisma.pointTransaction.deleteMany({ where: { wallet: { membership: { merchantId } } } });
  await prisma.merchantFeeTransaction.deleteMany({ where: { merchantId } });
  await prisma.inventoryMovement.deleteMany({ where: { merchantId } });
  await prisma.orderItem.deleteMany({ where: { order: { merchantId } } });
  await prisma.order.deleteMany({ where: { merchantId } });
  await prisma.challenge.deleteMany({ where: { merchantId } });
  await prisma.loyaltyWallet.deleteMany({ where: { membership: { merchantId } } });
  await prisma.merchantMembership.deleteMany({ where: { merchantId } });
  await prisma.inventoryBalance.deleteMany({ where: { merchantId } });
  await prisma.product.deleteMany({ where: { merchantId } });
  await prisma.loyaltyTier.deleteMany({ where: { merchantId } });
  await prisma.loyaltyRule.deleteMany({ where: { merchantId } });
  await prisma.loyaltyPolicyVersion.deleteMany({ where: { merchantId } });
  await prisma.merchant.deleteMany({ where: { id: merchantId } });
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, memberId, adminId] } } });
  await prisma.$disconnect();
});

test("challenge CMS activation, public privacy, and daily check-in are scoped", async () => {
  const create = await req("/api/merchant/challenges", "POST", merchantToken, {
    title: "One visit", description: "One visit", type: "ORDER_COUNT", targetValue: "1", rewardPoints: "5", budgetTotal: "50",
    startsAt: "2026-11-01T00:00:00.000Z", endsAt: "2026-12-31T00:00:00.000Z", isFeatured: true,
  });
  assert.equal(create.status, 201);
  const id = (create.json.challenge as { id: number }).id;
  orderChallengeId = id;
  assert.equal((await req(`/api/merchant/challenges/${id}/activate`, "POST", merchantToken)).status, 200);
  const daily = await req("/api/merchant/challenges", "POST", merchantToken, {
    title: "Check in twice", description: "Two daily visits", type: "DAILY_CHECKIN", targetValue: "2", rewardPoints: "3", budgetTotal: "30",
    startsAt: "2026-11-01T00:00:00.000Z", endsAt: "2026-12-31T00:00:00.000Z", status: "ACTIVE",
  });
  assert.equal(daily.status, 201);
  const pub = await req(`/api/public/stores/${slug}/challenges`);
  assert.equal(pub.status, 200);
  const publicChallenges = pub.json.challenges as Record<string, unknown>[];
  assert.equal((publicChallenges[0]).id, id);
  assert.equal("progress" in publicChallenges[0], false);
  const first = await req(`/api/member/stores/${slug}/check-in`, "POST", memberToken);
  assert.equal(first.json.alreadyCheckedInToday, false);
  const again = await req(`/api/member/stores/${slug}/check-in`, "POST", memberToken);
  assert.equal(again.json.alreadyCheckedInToday, true);
});

test("refund approval gates mock refunds and blocks merchant bypass", async () => {
  const created = await req("/api/orders", "POST", memberToken, { items: [{ productId, quantity: 1 }] });
  assert.equal(created.status, 201);
  const orderId = (created.json.order as { id: number }).id;
  const paid = await req(`/api/orders/${orderId}/pay`, "POST", memberToken);
  assert.equal(paid.status, 200);
  const membership = await prisma.merchantMembership.findUniqueOrThrow({ where: { memberId_merchantId: { memberId, merchantId } } });
  const progress = await prisma.challengeProgress.findUniqueOrThrow({ where: { challengeId_membershipId: { challengeId: orderChallengeId, membershipId: membership.id } } });
  assert.equal(progress.currentValue.toFixed(0), "1");
  assert.equal(progress.rewardState, "REWARDED");
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const bypass = await req(`/api/merchant/orders/${order.id}/refund`, "POST", merchantToken, { reason: "bypass" });
  assert.equal(bypass.status, 409);
  assert.equal(bypass.json.error, "USE_REFUND_APPROVAL_WORKFLOW");
  const submitted = await req(`/api/orders/${order.id}/refund-request`, "POST", memberToken, { reason: "Wrong item" });
  assert.equal(submitted.status, 201);
  const requestId = (submitted.json.refundRequest as { id: number }).id;
  const merchantApproval = await req(`/api/merchant/refund-requests/${requestId}/approve`, "POST", merchantToken);
  assert.equal((merchantApproval.json.refundRequest as { status: string }).status, "PENDING_ADMIN");
  const approved = await req(`/api/admin/refund-requests/${requestId}/approve`, "POST", adminToken);
  assert.equal(approved.status, 200);
  assert.equal((approved.json.refundRequest as { status: string }).status, "COMPLETED");
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status, "REFUNDED");
  const reversedProgress = await prisma.challengeProgress.findUniqueOrThrow({ where: { id: progress.id } });
  assert.equal(reversedProgress.currentValue.toFixed(0), "0");
  assert.equal(reversedProgress.rewardState, "IN_PROGRESS");
  assert.equal((await prisma.challengeRewardGrant.findFirstOrThrow({ where: { progressId: progress.id } })).status, "REVERSED");
  assert.equal(await prisma.pointTransaction.count({ where: { source: "CHALLENGE_REFUND", orderId: null, wallet: { membershipId: membership.id } } }), 1);
});

test("locked fields, WAITING_BUDGET FIFO replenishment, Option B keep-above-target, and cycle-2 re-earn", async () => {
  // Locked fields after activation
  const lockAttempt = await req(`/api/merchant/challenges/${orderChallengeId}`, "PATCH", merchantToken, { targetValue: "5" });
  assert.equal(lockAttempt.status, 409);
  assert.equal(lockAttempt.json.error, "CHALLENGE_FIELDS_LOCKED");

  // Create SPEND_TOTAL challenge with budget = reward (only enough for 1 reward -> 2nd member waits for budget)
  const member2 = await prisma.user.create({ data: { email: `${slug}-m2@test.local`, passwordHash: "x", role: "MEMBER" } });
  const m2Token = await signAccessToken(member2.id);
  const spendCreate = await req("/api/merchant/challenges", "POST", merchantToken, {
    title: "Spend 10k", description: "Spend 10k", type: "SPEND_TOTAL", targetValue: "10000",
    rewardPoints: "7", budgetTotal: "7", startsAt: "2026-11-01T00:00:00.000Z", endsAt: "2026-12-31T00:00:00.000Z", status: "ACTIVE",
  });
  assert.equal(spendCreate.status, 201);
  const spendId = (spendCreate.json.challenge as { id: number }).id;

  const o1 = await req("/api/orders", "POST", memberToken, { items: [{ productId, quantity: 1 }] });
  const o1Id = (o1.json.order as { id: number }).id;
  assert.equal((await req(`/api/orders/${o1Id}/pay`, "POST", memberToken)).status, 200);

  const o2 = await req("/api/orders", "POST", m2Token, { items: [{ productId, quantity: 1 }] });
  const o2Id = (o2.json.order as { id: number }).id;
  assert.equal((await req(`/api/orders/${o2Id}/pay`, "POST", m2Token)).status, 200);

  const m2Membership = await prisma.merchantMembership.findUniqueOrThrow({ where: { memberId_merchantId: { memberId: member2.id, merchantId } } });
  const m2Progress = await prisma.challengeProgress.findUniqueOrThrow({ where: { challengeId_membershipId: { challengeId: spendId, membershipId: m2Membership.id } } });
  assert.equal(m2Progress.rewardState, "WAITING_BUDGET");

  // Top up budget -> auto-replenishes member2 FIFO
  const topUp = await req(`/api/merchant/challenges/${spendId}`, "PATCH", merchantToken, { budgetTotal: "14" });
  assert.equal(topUp.status, 200);
  assert.equal(topUp.json.replenishedCount, 1);
  const m2AfterTopUp = await prisma.challengeProgress.findUniqueOrThrow({ where: { id: m2Progress.id } });
  assert.equal(m2AfterTopUp.rewardState, "REWARDED");

  // Option B: member1 gets 2nd paid order on orderChallenge (now 2/1 >= 1), then refunds 1 -> 1/1 keeps grant!
  const o3 = await req("/api/orders", "POST", memberToken, { items: [{ productId, quantity: 1 }] });
  const o3Id = (o3.json.order as { id: number }).id;
  assert.equal((await req(`/api/orders/${o3Id}/pay`, "POST", memberToken)).status, 200);
  // Now member1 has currentValue = 2 on orderChallengeId (target = 1), cycle 2 GRANTED!
  const o3Req = await req(`/api/orders/${o3Id}/refund-request`, "POST", memberToken, { reason: "Keep above target test" });
  const o3ReqId = (o3Req.json.refundRequest as { id: number }).id;
  await req(`/api/merchant/refund-requests/${o3ReqId}/approve`, "POST", merchantToken);
  const o3Approve = await req(`/api/admin/refund-requests/${o3ReqId}/approve`, "POST", adminToken);
  assert.equal(o3Approve.status, 200);
  const m1Membership = await prisma.merchantMembership.findUniqueOrThrow({ where: { memberId_merchantId: { memberId, merchantId } } });
  const m1OrderProgress = await prisma.challengeProgress.findUniqueOrThrow({ where: { challengeId_membershipId: { challengeId: orderChallengeId, membershipId: m1Membership.id } } });
  assert.equal(m1OrderProgress.currentValue.toFixed(0), "1");
  assert.equal(m1OrderProgress.rewardState, "REWARDED");
  assert.equal(m1OrderProgress.rewardCycle, 2);

  // Clean up extra member2 records before after()
  await prisma.challengeProgressEntry.deleteMany({ where: { progress: { membershipId: m2Membership.id } } });
  await prisma.challengeRewardGrant.deleteMany({ where: { progress: { membershipId: m2Membership.id } } });
  await prisma.challengeProgress.deleteMany({ where: { membershipId: m2Membership.id } });
  await prisma.memberActivity.deleteMany({ where: { membershipId: m2Membership.id } });
  await prisma.pointTransaction.deleteMany({ where: { wallet: { membershipId: m2Membership.id } } });
  await prisma.loyaltyWallet.deleteMany({ where: { membershipId: m2Membership.id } });
  await prisma.merchantMembership.deleteMany({ where: { id: m2Membership.id } });
  await prisma.merchantFeeTransaction.deleteMany({ where: { orderId: o2Id } });
  await prisma.inventoryMovement.deleteMany({ where: { orderId: o2Id } });
  await prisma.orderItem.deleteMany({ where: { orderId: o2Id } });
  await prisma.order.deleteMany({ where: { id: o2Id } });
  await prisma.user.deleteMany({ where: { id: member2.id } });
});
