import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  assertLedger, beginVnpay, cleanup, confirmVnpay, createMember, createOrder, createShop, env,
  pay, prisma, Prisma, request, savePolicy, start, wallet, type Wallet,
} from "./exact-points.fixtures.js";

before(start);
after(cleanup);

test("two 0.6 payments persist 1.2 exact points and expose one spendable point", async () => {
  const shop = await createShop();
  const member = await createMember();
  const empty = await wallet(shop, member);
  assert.equal(empty.exactBalance, "0");
  assert.equal(empty.fractionalCarry, "0");
  assert.equal(empty.pointDebt, "0");
  const first = await pay(shop, member);
  assert.equal(first.earnedPoints, 0);
  assert.equal(first.earnedPointsExact, "0.6");
  assert.equal((await wallet(shop, member)).availablePoints, 0);
  await pay(shop, member);
  const result = await wallet(shop, member);
  assert.equal(result.exactBalance, "1.2");
  assert.equal(result.availablePoints, 1);
  assert.equal(result.fractionalCarry, "0.2");
  assert.equal(result.netLifetimeEarned, "1.2");
  assert.equal(result.lifetimeEarnedPoints, 1);
  assert.equal(result.pointDebt, "0");
  assert.deepEqual(result.transactions.map(({ delta }) => delta), ["0.6", "0.6"]);
  assert.deepEqual(result.transactions.map(({ balanceAfter }) => balanceAfter), ["1.2", "0.6"]);
  assert.deepEqual(result.transactions.map(({ availablePointsAfter }) => availablePointsAfter), [1, 0]);
  assert.deepEqual(result.transactions.map(({ fractionalCarryAfter }) => fractionalCarryAfter), ["0.2", "0.6"]);
  assert.ok(result.transactions.every(({ pointDebtAfter }) => pointDebtAfter === "0"));
  await assertLedger(shop, member, "1.2");
  const receipt = await request<{ order: { earnedPointsExact: string } }>(`/api/member/orders/${first.id}`, "GET", member.token);
  assert.equal(receipt.status, 200);
  assert.equal(receipt.json.order.earnedPointsExact, "0.6");
});

test("fractional earning rounds HALF_UP once at 12 decimal places and persists that exact credit", async () => {
  const shop = await createShop("1");
  const member = await createMember();
  await savePolicy(shop, { rate: 128000000 });
  assert.equal((await pay(shop, member)).earnedPointsExact, "0.000000007813");
  assert.equal((await wallet(shop, member)).fractionalCarry, "0.000000007813");
  await assertLedger(shop, member, "0.000000007813");
  const thirds = await createShop("1");
  await savePolicy(thirds, { rate: 3 });
  for (let index = 0; index < 3; index++) {
    assert.equal((await pay(thirds, member)).earnedPointsExact, "0.333333333333");
  }
  const result = await wallet(thirds, member);
  assert.equal(result.exactBalance, "0.999999999999");
  assert.equal(result.availablePoints, 0);
  await assertLedger(thirds, member, "0.999999999999");
});

test("earning applies the multiplier before rounding and preserves carry across policy changes", async () => {
  const shop = await createShop("6000", "1.50");
  const member = await createMember();
  assert.equal((await pay(shop, member)).earnedPointsExact, "0.9");
  await savePolicy(shop, { rate: 20000, silverThreshold: 1 });
  assert.equal((await wallet(shop, member)).exactBalance, "0.9");
  assert.equal((await pay(shop, member)).earnedPointsExact, "0.3");
  assert.equal((await wallet(shop, member)).tier, "SILVER");
  assert.equal((await pay(shop, member)).earnedPointsExact, "0.45");
  const result = await wallet(shop, member);
  assert.equal(result.exactBalance, "1.65");
  assert.equal(result.fractionalCarry, "0.65");
  await assertLedger(shop, member, "1.65");
});

test("one member's fractional wallets stay isolated by merchant and member", async () => {
  const shopA = await createShop();
  const shopB = await createShop("3000");
  const member = await createMember();
  const other = await createMember();
  await pay(shopA, member);
  await pay(shopB, member);
  assert.equal((await wallet(shopA, member)).exactBalance, "0.6");
  assert.equal((await wallet(shopB, member)).exactBalance, "0.3");
  assert.equal((await wallet(shopA, other)).exactBalance, "0");
  assert.deepEqual((await wallet(shopB, other)).transactions, []);
  await assertLedger(shopA, member, "0.6");
  await assertLedger(shopB, member, "0.3");
});

test("inactive earning records zero without discarding a previously earned fraction", async () => {
  const shop = await createShop();
  const member = await createMember();
  await pay(shop, member);
  await savePolicy(shop, { active: false });
  assert.equal((await pay(shop, member)).earnedPointsExact, "0");
  const result = await wallet(shop, member);
  assert.equal(result.exactBalance, "0.6");
  assert.equal(result.netLifetimeEarned, "0.6");
  assert.equal(result.transactions[0]?.delta, "0");
  await assertLedger(shop, member, "0.6");
});

test("discounted earning uses the persisted net amount", async () => {
  const shop = await createShop("6000", "1.50");
  const member = await createMember();
  const membership = await prisma.merchantMembership.create({ data: { memberId: member.id, merchantId: shop.id } });
  const definition = await prisma.voucherDefinition.create({ data: { merchantId: shop.id, type: "DISCOUNT", title: "Discount", pointsCost: 1, discountAmount: "2000" } });
  const voucher = await prisma.memberVoucher.create({ data: { membershipId: membership.id, definitionId: definition.id, snapshotType: "DISCOUNT", snapshotTitle: "Discount", snapshotPointsCost: 1, snapshotDiscountAmount: "2000" } });
  const paid = await pay(shop, member, voucher.id);
  assert.equal(paid.total, "4000");
  assert.equal(paid.earnedPointsExact, "0.6");
  assert.equal((await prisma.memberVoucher.findUniqueOrThrow({ where: { id: voucher.id } })).status, "USED");
  await assertLedger(shop, member, "0.6");
});

test("concurrent fractional payments serialize exact balances and duplicate payment cannot credit again", async () => {
  const shop = await createShop();
  const member = await createMember();
  const orders = await Promise.all([createOrder(shop, member), createOrder(shop, member)]);
  const results = await Promise.all(orders.map(({ id }) => request(`/api/orders/${id}/pay`, "POST", member.token)));
  assert.deepEqual(results.map(({ status }) => status), [200, 200]);
  const again = await request<{ error: string }>(`/api/orders/${orders[0]!.id}/pay`, "POST", member.token);
  assert.equal(again.status, 409);
  assert.equal(again.json.error, "ORDER_ALREADY_PAID");
  const stored = await assertLedger(shop, member, "1.2");
  assert.equal(stored.transactions.length, 2);
  assert.equal(stored.netLifetimeEarned.toString(), "1.2");
});

test("integer redemption keeps carry and lifetime while concurrent redemption cannot overspend", async () => {
  const shop = await createShop();
  const member = await createMember();
  await pay(shop, member);
  await pay(shop, member);
  const definition = await prisma.voucherDefinition.create({ data: { merchantId: shop.id, type: "DISCOUNT", title: "One point", pointsCost: 1, discountAmount: "1000" } });
  const redemptions = await Promise.all([0, 1].map(() => request<{ wallet: Wallet }>(`/api/member/vouchers/${definition.id}/redeem`, "POST", member.token)));
  assert.deepEqual(redemptions.map(({ status }) => status).sort(), [201, 409]);
  const result = redemptions.find(({ status }) => status === 201)!.json.wallet;
  assert.equal(result.exactBalance, "0.2");
  assert.equal(result.availablePoints, 0);
  assert.equal(result.fractionalCarry, "0.2");
  assert.equal(result.netLifetimeEarned, "1.2");
  assert.equal(result.lifetimeEarnedPoints, 1);
  assert.equal(result.pointDebt, "0");
  const persisted = await assertLedger(shop, member, "0.2");
  assert.equal(persisted.transactions.at(-1)?.delta.toString(), "-1");
  assert.equal(persisted.netLifetimeEarned.toString(), "1.2");
  assert.equal((await wallet(shop, member)).fractionalCarry, "0.2");
});

test("VNPay freezes tier, multiplier and policy at initiation; duplicate IPN preserves exact ledger", async () => {
  env.paymentMode = "vnpay";
  try {
    const shop = await createShop();
    const member = await createMember();
    const first = await beginVnpay(shop, member);
    const second = await beginVnpay(shop, member);
    const snapshot = await prisma.paymentAttempt.findUniqueOrThrow({ where: { orderId: second.order.id } });
    assert.equal(snapshot.snapshotTierLevel, "BRONZE");
    assert.equal(snapshot.snapshotMultiplier?.toString(), "1");
    await savePolicy(shop, { rate: 20000, bronzeMultiplier: "1.50", silverThreshold: 1 });
    assert.equal(await confirmVnpay(first), "00");
    assert.equal(await confirmVnpay(second), "00");
    assert.equal(await confirmVnpay(second), "02");
    assert.equal((await wallet(shop, member)).tier, "SILVER");
    assert.equal((await wallet(shop, member)).exactBalance, "1.2");
    const future = await beginVnpay(shop, member);
    assert.equal(await confirmVnpay(future), "00");
    assert.equal((await wallet(shop, member)).exactBalance, "1.65");
    const stored = await assertLedger(shop, member, "1.65");
    assert.equal(stored.reservedPoints.toString(), "0");
    assert.equal(stored.transactions.length, 3);
  } finally {
    env.paymentMode = "mock";
  }
});

test("policy threshold changes select earning tier from exact lifetime instead of a stale membership tier", async () => {
  const shop = await createShop();
  const member = await createMember();
  await pay(shop, member);
  await pay(shop, member);
  assert.equal((await wallet(shop, member)).tier, "BRONZE");
  await savePolicy(shop, { silverThreshold: 1 });
  assert.equal((await pay(shop, member)).earnedPointsExact, "0.9");
  assert.equal((await wallet(shop, member)).tier, "SILVER");
  await assertLedger(shop, member, "2.1");
});

test("legacy zero-reservation VNPay attempts retain their original integer award while new attempts earn fractions", async () => {
  env.paymentMode = "vnpay";
  try {
    const shop = await createShop();
    const member = await createMember();
    const legacy = await beginVnpay(shop, member);
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { orderId: legacy.order.id } });
    const stored = await prisma.loyaltyWallet.findFirstOrThrow({ where: { membership: { memberId: member.id, merchantId: shop.id } } });
    // Emulate the pre-M1 integer calculator: 6000/10000 earned/reserved zero.
    // Nullable new fields identify attempts that were initiated before M1.
    await prisma.$transaction([
      prisma.paymentAttempt.update({ where: { id: attempt.id }, data: {
        reservedPoints: 0, snapshotTierLevel: null, snapshotMultiplier: null,
        snapshotPolicy: Prisma.DbNull,
      } }),
      prisma.loyaltyWallet.update({ where: { id: stored.id }, data: { reservedPoints: 0 } }),
    ]);
    assert.equal(await confirmVnpay(legacy), "00");
    const legacyCredit = await prisma.pointTransaction.findUniqueOrThrow({ where: { orderId: legacy.order.id } });
    assert.equal(legacyCredit.delta.toString(), "0");
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: legacy.order.id } })).earnedPointsExact?.toString(), "0");
    await assertLedger(shop, member, "0");
    const current = await beginVnpay(shop, member);
    assert.equal(await confirmVnpay(current), "00");
    await assertLedger(shop, member, "0.6");
  } finally {
    env.paymentMode = "mock";
  }
});

test("failed VNPay IPN releases the exact fractional reservation without creating an earning", async () => {
  env.paymentMode = "vnpay";
  try {
    const shop = await createShop();
    const member = await createMember();
    const payment = await beginVnpay(shop, member);
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { orderId: payment.order.id } });
    assert.equal(attempt.reservedPoints.toString(), "1.2");
    const before = await prisma.loyaltyWallet.findFirstOrThrow({ where: { membership: { memberId: member.id, merchantId: shop.id } } });
    assert.equal(before.reservedPoints.toString(), "1.2");
    const failure = { vnp_ResponseCode: "24", vnp_TransactionStatus: "02" };
    assert.equal(await confirmVnpay(payment, failure), "00");
    assert.equal(await confirmVnpay(payment, failure), "02");
    assert.equal((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).status, "FAILED");
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: payment.order.id } })).status, "PENDING");
    const after = await assertLedger(shop, member, "0");
    assert.equal(after.reservedPoints.toString(), "0");
    assert.equal(after.netLifetimeEarned.toString(), "0");
    assert.equal(after.transactions.length, 0);
    assert.equal((await wallet(shop, member)).exactBalance, "0");
  } finally {
    env.paymentMode = "mock";
  }
});
