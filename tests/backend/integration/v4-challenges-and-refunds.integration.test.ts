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
const extraMemberIds: number[] = [];

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
  await prisma.challengeLimitNotice.deleteMany({ where: { challenge: { merchantId } } });
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
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, memberId, adminId, ...extraMemberIds] } } });
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
  assert.deepEqual((create.json.challenge as { milestones: unknown[] }).milestones, [
    { position: 1, thresholdValue: "1", title: "Mốc 1", description: "" },
  ]);
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

test("recipient caps preserve completion order, budget waiting and global notices", async () => {
  const createMember = async (name: string) => {
    const user = await prisma.user.create({ data: { email: `${slug}-quota-${name}@test.local`, passwordHash: "x", role: "MEMBER" } });
    extraMemberIds.push(user.id);
    return { id: user.id, token: await signAccessToken(user.id) };
  };
  const [first, second, third, outside] = await Promise.all(["first", "second", "third", "outside"].map(createMember));
  const now = Date.now();
  const config = {
    title: "Limited check-in", description: "First finishers", type: "DAILY_CHECKIN", status: "ACTIVE",
    targetValue: "1", rewardPoints: "10", budgetTotal: "10",
    startsAt: new Date(now - 60_000).toISOString(), endsAt: new Date(now + 3_600_000).toISOString(),
  };
  const create = await req("/api/merchant/challenges", "POST", merchantToken, { ...config, maxRewardRecipients: 1 });
  assert.equal(create.status, 201);
  const id = (create.json.challenge as { id: number }).id;
  const unlimited = await req("/api/merchant/challenges", "POST", merchantToken, { ...config, title: "Unlimited check-in", budgetTotal: "30" });
  assert.equal(unlimited.status, 201);
  assert.equal((unlimited.json.challenge as { maxRewardRecipients: null }).maxRewardRecipients, null);
  const unlimitedId = (unlimited.json.challenge as { id: number }).id;
  for (const member of [first, second, third]) {
    assert.equal((await req(`/api/member/stores/${slug}/check-in`, "POST", member.token)).status, 200);
  }
  const progress = async (id: number, userId: number) => prisma.challengeProgress.findFirstOrThrow({
    where: { challengeId: id, membership: { merchantId, memberId: userId } },
    include: { grants: true },
  });
  assert.equal((await progress(id, first.id)).rewardState, "REWARDED");
  assert.equal((await progress(id, second.id)).rewardState, "LIMIT_REACHED");
  assert.equal((await progress(id, third.id)).rewardState, "LIMIT_REACHED");
  assert.equal((await progress(unlimitedId, third.id)).rewardState, "REWARDED");
  assert.equal((await req(`/api/merchant/challenges/${id}`, "PATCH", merchantToken, { maxRewardRecipients: null })).status, 409);
  const increase = await req(`/api/merchant/challenges/${id}`, "PATCH", merchantToken, { maxRewardRecipients: 2 });
  assert.equal(increase.status, 200);
  assert.equal(increase.json.replenishedCount, 0);
  assert.equal((await progress(id, second.id)).rewardState, "WAITING_BUDGET");
  assert.equal((await progress(id, third.id)).rewardState, "LIMIT_REACHED");
  const grant = await req(`/api/merchant/challenges/${id}`, "PATCH", merchantToken, { budgetTotal: "30" });
  assert.equal(grant.json.replenishedCount, 1);
  assert.equal((await progress(id, second.id)).grants.length, 1);
  assert.equal((await progress(id, third.id)).grants.length, 0);
  const secondIncrease = await req(`/api/merchant/challenges/${id}`, "PATCH", merchantToken, { maxRewardRecipients: 3 });
  assert.equal(secondIncrease.json.replenishedCount, 1);
  assert.equal((await progress(id, third.id)).rewardState, "REWARDED");
  assert.equal((await req(`/api/merchant/challenges/${id}`, "PATCH", merchantToken, { maxRewardRecipients: 2 })).status, 409);
  assert.equal((await req(`/api/merchant/challenges/${id}`, "PATCH", merchantToken, { maxRewardRecipients: 3 })).status, 200);
  assert.equal(await prisma.challengeLimitNotice.count({ where: { challengeId: id } }), 2);
  const unreadPath = "/api/member/challenge-limit-notices/unread";
  assert.equal((await req(unreadPath, "GET", merchantToken)).status, 403);
  const unread = await req(unreadPath, "GET", outside.token);
  assert.equal(unread.status, 200);
  const notice = unread.json.notice as { id: number; challengeId: number; newLimit: number };
  assert.equal(notice.challengeId, id);
  assert.equal(notice.newLimit, 2);
  const readPath = `/api/member/challenge-limit-notices/${notice.id}/read`;
  assert.equal((await req(readPath, "POST", outside.token)).status, 200);
  assert.equal((await req(readPath, "POST", outside.token)).status, 200);
  assert.equal(((await req(unreadPath, "GET", outside.token)).json.notice as { newLimit: number }).newLimit, 3);
  assert.equal(((await req(unreadPath, "GET", first.token)).json.notice as { id: number }).id, notice.id);
  await prisma.challengeLimitNotice.deleteMany({ where: { challengeId: id } });
  await req(`/api/merchant/challenges/${id}/archive`, "POST", merchantToken);
  await req(`/api/merchant/challenges/${unlimitedId}/archive`, "POST", merchantToken);
});

test("two concurrent check-ins cannot both claim the final reward slot", async () => {
  const now = Date.now();
  const create = await req("/api/merchant/challenges", "POST", merchantToken, {
    title: "One concurrent slot", description: "Only one winner", type: "DAILY_CHECKIN", status: "ACTIVE",
    targetValue: "1", rewardPoints: "10", budgetTotal: "20", maxRewardRecipients: 1,
    startsAt: new Date(now - 60_000).toISOString(), endsAt: new Date(now + 3_600_000).toISOString(),
  });
  assert.equal(create.status, 201);
  const challengeId = (create.json.challenge as { id: number }).id;
  const tokens = await Promise.all([1, 2].map(async (index) => {
    const user = await prisma.user.create({ data: { email: `${slug}-quota-race-${index}@test.local`, passwordHash: "x", role: "MEMBER" } });
    extraMemberIds.push(user.id);
    return signAccessToken(user.id);
  }));
  const results = await Promise.all(tokens.map((token) => req(`/api/member/stores/${slug}/check-in`, "POST", token)));
  assert.deepEqual(results.map((result) => result.status), [200, 200]);
  const progress = await prisma.challengeProgress.findMany({ where: { challengeId }, include: { grants: true } });
  assert.deepEqual(progress.map((row) => row.rewardState).sort(), ["LIMIT_REACHED", "REWARDED"]);
  assert.equal(progress.flatMap((row) => row.grants).length, 1);
  const challenge = await prisma.challenge.findUniqueOrThrow({ where: { id: challengeId } });
  assert.equal(challenge.rewardSlotsClaimed, 1);
  assert.equal(challenge.budgetSpent.toFixed(0), "10");
  await req(`/api/merchant/challenges/${challengeId}/archive`, "POST", merchantToken);
});

test("refund approval gates mock refunds and blocks merchant bypass", async () => {
  const secondChallenge = await req("/api/merchant/challenges", "POST", merchantToken, {
    title: "Second reward", description: "Second challenge reward", type: "SPEND_TOTAL", targetValue: "10000", rewardPoints: "7", budgetTotal: "70",
    startsAt: "2026-11-01T00:00:00.000Z", endsAt: "2026-12-31T00:00:00.000Z", status: "ACTIVE",
  });
  assert.equal(secondChallenge.status, 201);
  const secondChallengeId = (secondChallenge.json.challenge as { id: number }).id;
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
  assert.equal((await req(`/api/admin/refund-requests/${requestId}`, "GET", adminToken)).status, 200);
  assert.equal((await req(`/api/admin/refund-requests/${requestId}/approve`, "POST", adminToken)).status, 404);
  assert.equal((await req(`/api/admin/refund-requests/${requestId}/reject`, "POST", adminToken, { reason: "No" })).status, 404);
  const approved = await req(`/api/merchant/refund-requests/${requestId}/approve`, "POST", merchantToken, { note: "Checked" });
  assert.equal(approved.status, 200);
  assert.equal((approved.json.refundRequest as { status: string }).status, "COMPLETED");
  assert.equal((approved.json.refundRequest as { merchantDecisionReason: string }).merchantDecisionReason, "Checked");
  assert.equal(approved.json.challengeReversals, 2);
  const wallet = await prisma.loyaltyWallet.findUniqueOrThrow({ where: { membershipId: membership.id } });
  assert.ok(wallet.exactBalance.isZero());
  assert.ok(wallet.netLifetimeEarned.isZero());
  assert.equal(Number((approved.json.walletImpact as { exactBalance: string }).exactBalance), 0);
  const retried = await req(`/api/merchant/refund-requests/${requestId}/approve`, "POST", merchantToken);
  assert.equal(retried.status, 200);
  assert.deepEqual(retried.json.refund, approved.json.refund);
  assert.deepEqual(retried.json.order, approved.json.order);
  assert.equal(retried.json.challengeReversals, 0);
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status, "REFUNDED");
  const reversedProgress = await prisma.challengeProgress.findUniqueOrThrow({ where: { id: progress.id } });
  assert.equal(reversedProgress.currentValue.toFixed(0), "0");
  assert.equal(reversedProgress.rewardState, "IN_PROGRESS");
  assert.equal((await prisma.challengeRewardGrant.findFirstOrThrow({ where: { progressId: progress.id } })).status, "REVERSED");
  assert.equal(await prisma.pointTransaction.count({ where: { source: "CHALLENGE_REFUND", orderId: null, wallet: { membershipId: membership.id }, actorId: ownerId } }), 2);
  const lastReversal = await prisma.pointTransaction.findFirstOrThrow({ where: { walletId: wallet.id, source: "CHALLENGE_REFUND" }, orderBy: { id: "desc" } });
  assert.ok(lastReversal.balanceAfter.eq(wallet.exactBalance));
  assert.equal((await req(`/api/merchant/challenges/${secondChallengeId}/archive`, "POST", merchantToken)).status, 200);
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
  await prisma.refundRequest.update({ where: { id: o3ReqId }, data: { status: "PENDING_ADMIN", merchantReviewedById: ownerId, merchantReviewedAt: new Date() } });
  const pending = await req("/api/merchant/refund-requests?status=PENDING_MERCHANT", "GET", merchantToken);
  assert.ok((pending.json.items as { id: number }[]).some(({ id }) => id === o3ReqId));
  const o3Approve = await req(`/api/merchant/refund-requests/${o3ReqId}/approve`, "POST", merchantToken);
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

test("challenge milestones round-trip, stay locked after activation, and do not grant points mid-campaign", async () => {
  const created = await req("/api/merchant/challenges", "POST", merchantToken, {
    title: "Ba lần ghé", description: "Theo dõi hành trình ba lần ghé quán", type: "DAILY_CHECKIN", targetValue: "3",
    rewardPoints: "11", budgetTotal: "110", startsAt: "2026-11-01T00:00:00.000Z", endsAt: "2026-12-31T00:00:00.000Z", status: "ACTIVE",
    milestones: [
      { thresholdValue: "1", title: "Lần ghé đầu tiên", description: "Bắt đầu hành trình" },
      { thresholdValue: "3", title: "Khách quen", description: "Đạt mục tiêu và nhận điểm" },
    ],
  });
  assert.equal(created.status, 201);
  const challengeId = (created.json.challenge as { id: number }).id;
  const expectedMilestones = [
    { position: 1, thresholdValue: "1", title: "Lần ghé đầu tiên", description: "Bắt đầu hành trình" },
    { position: 2, thresholdValue: "3", title: "Khách quen", description: "Đạt mục tiêu và nhận điểm" },
  ];
  assert.deepEqual((created.json.challenge as { milestones: unknown[] }).milestones, expectedMilestones);

  const merchantList = await req("/api/merchant/challenges", "GET", merchantToken);
  const merchantItems = merchantList.json.items as Array<{ id: number; milestones: unknown[] }>;
  assert.deepEqual(merchantItems.find((item) => item.id === challengeId)?.milestones, expectedMilestones);
  const merchantDetail = await req(`/api/merchant/challenges/${challengeId}`, "GET", merchantToken);
  assert.deepEqual((merchantDetail.json.challenge as { milestones: unknown[] }).milestones, expectedMilestones);
  const publicList = await req(`/api/public/stores/${slug}/challenges`);
  assert.deepEqual(((publicList.json.challenges as Array<{ id: number; milestones: unknown[] }>).find((item) => item.id === challengeId))?.milestones, expectedMilestones);
  const publicDetail = await req(`/api/public/stores/${slug}/challenges/${challengeId}`);
  assert.deepEqual((publicDetail.json.challenge as { milestones: unknown[] }).milestones, expectedMilestones);
  const memberDetail = await req(`/api/member/stores/${slug}/challenges/${challengeId}`, "GET", memberToken);
  assert.deepEqual((memberDetail.json.challenge as { milestones: unknown[] }).milestones, expectedMilestones);

  const lockedStructure = await req(`/api/merchant/challenges/${challengeId}`, "PATCH", merchantToken, {
    milestones: [
      { thresholdValue: "2", title: "Lần ghé đầu tiên", description: "Bắt đầu hành trình" },
      { thresholdValue: "3", title: "Khách quen", description: "Đạt mục tiêu và nhận điểm" },
    ],
  });
  assert.equal(lockedStructure.status, 409);
  assert.equal(lockedStructure.json.error, "CHALLENGE_FIELDS_LOCKED");
  const copyEdit = await req(`/api/merchant/challenges/${challengeId}`, "PATCH", merchantToken, {
    milestones: [
      { thresholdValue: "1", title: "Ghé lần đầu", description: "Cùng bắt đầu" },
      { thresholdValue: "3", title: "Khách thân quen", description: "Nhận điểm thưởng cuối" },
    ],
  });
  assert.equal(copyEdit.status, 200);
  assert.equal((copyEdit.json.challenge as { milestones: Array<{ title: string }> }).milestones[0]?.title, "Ghé lần đầu");

  const legacyChallenge = await prisma.challenge.create({ data: {
    merchantId, title: "Legacy challenge", description: "Created without milestone rows", type: "SPEND_TOTAL", status: "ACTIVE",
    targetValue: "3", rewardPoints: "1", budgetTotal: "10", startsAt: new Date("2026-11-01T00:00:00.000Z"), endsAt: new Date("2026-12-31T00:00:00.000Z"),
  } });
  const legacyRead = await req(`/api/public/stores/${slug}/challenges/${legacyChallenge.id}`);
  assert.deepEqual(
    ((legacyRead.json.challenge as { milestones: Array<{ thresholdValue: string }> }).milestones).map(({ thresholdValue }) => thresholdValue),
    ["1", "2", "3"],
  );

  const progressMember = await prisma.user.create({ data: { email: `${slug}-milestone-member@test.local`, passwordHash: "x", role: "MEMBER" } });
  extraMemberIds.push(progressMember.id);
  const progressToken = await signAccessToken(progressMember.id);
  const checkedIn = await req(`/api/member/stores/${slug}/check-in`, "POST", progressToken);
  assert.equal(checkedIn.status, 200);
  const membership = await prisma.merchantMembership.findUniqueOrThrow({ where: { memberId_merchantId: { memberId: progressMember.id, merchantId } } });
  const progress = await prisma.challengeProgress.findUniqueOrThrow({ where: { challengeId_membershipId: { challengeId, membershipId: membership.id } } });
  assert.equal(progress.currentValue.toFixed(0), "1");
  assert.equal(progress.rewardState, "IN_PROGRESS");
  assert.equal(await prisma.challengeRewardGrant.count({ where: { progress: { challengeId } } }), 0);
  assert.equal(await prisma.pointTransaction.count({ where: { wallet: { membershipId: membership.id } } }), 0);
});
