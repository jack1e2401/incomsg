import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  beginVnpay, cleanup, confirmVnpay, createMember, createOrder, createShop, createUser, env,
  pay, prisma, request, start, wallet, completeRefundApproval, type Member, type Shop,
} from "./exact-points.fixtures.js";

type Tier = "BRONZE" | "SILVER" | "GOLD";
type FeeType = "FEE_CHARGE" | "FEE_REVERSAL";
type Summary = { chargedVnd: string; reversedVnd: string; netVnd: string };
type Finance = {
  tier: { level: Tier; year: number; feeRate: string; revenueVnd: string; lastEvaluatedAt: string | null };
  summary: Summary;
  sales: { orderNetVnd: string; merchantReceivesVnd: string };
  items: { orderId: number; type: FeeType; amountVnd: string; tier: Tier; feeRate: string; orderTotalVnd: string; eventRef: string }[];
  nextCursor: number | null;
};
const financePath = "/api/merchant/finance";
const noFees = { chargedVnd: "0", reversedVnd: "0", netVnd: "0" };
const calendarYear = Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric" }).format(new Date()));
const yearStart = new Date(Date.UTC(calendarYear - 1, 11, 31, 17));
const previousYearEnd = new Date(yearStart.getTime() - 1000);

before(start);
after(cleanup);

async function finance(shop: Shop, query = "") {
  const result = await request<Finance>(financePath + query, "GET", shop.token);
  assert.equal(result.status, 200, JSON.stringify(result.json));
  return result.json;
}

async function legacyOrder(shop: Shop, member: Member, total: string, paidAt = yearStart) {
  return prisma.order.create({
    data: { merchantId: shop.id, memberId: member.id, status: "PAID", subtotal: total, total, paidAt },
  });
}

function refund(shop: Shop, orderId: number) {
  return completeRefundApproval(shop, orderId, "Fee ledger integration test") as Promise<{ status: number; json: { refund: { status: string } } }>;
}

function feeRows(orderId: number) {
  return prisma.merchantFeeTransaction.findMany({ where: { orderId }, orderBy: { id: "asc" } });
}

test("Vietnam calendar year excludes the previous year's final second and applies exact tier thresholds", async () => {
  const shop = await createShop();
  const member = await createMember();
  await prisma.merchant.update({ where: { id: shop.id }, data: { feeTier: "GOLD", feeTierYear: calendarYear - 1, feeTierEvaluatedAt: previousYearEnd } });
  await legacyOrder(shop, member, "70000000", previousYearEnd);

  const baseline = await finance(shop);
  assert.equal(baseline.tier.year, calendarYear);
  assert.equal(baseline.tier.level, "BRONZE");
  assert.equal(baseline.tier.revenueVnd, "0");
  assert.deepEqual(baseline.summary, noFees);

  const current = await legacyOrder(shop, member, "9999999");
  for (const [total, expectedTier, rate] of [
    ["9999999", "BRONZE", 0.05], ["10000000", "SILVER", 0.04],
    ["49999999", "SILVER", 0.04], ["50000000", "GOLD", 0.03],
  ] as const) {
    await prisma.order.update({ where: { id: current.id }, data: { subtotal: total, total } });
    const result = await finance(shop);
    assert.equal(result.tier.revenueVnd, total);
    assert.equal(result.tier.level, expectedTier);
    assert.equal(Number(result.tier.feeRate), rate);
    assert.deepEqual(result.items, [], "historical orders must not create fee rows");
  }

  const refunded = await refund(shop, current.id);
  assert.equal(refunded.status, 200);
  assert.equal(refunded.json.refund.status, "COMPLETED");
  const merchant = await prisma.merchant.findUniqueOrThrow({ where: { id: shop.id } });
  assert.equal(merchant.feeTier, "BRONZE");
  const updated = await finance(shop);
  assert.equal(updated.tier.level, "BRONZE");
  assert.equal(updated.tier.revenueVnd, "0");
  assert.deepEqual(updated.items, [], "an old order with no charge cannot generate a reversal");
});

test("crossing order uses the prior tier, next order uses the new tier, and refund reverses the original fee exactly once", async () => {
  const shop = await createShop("200000");
  const member = await createMember();
  await legacyOrder(shop, member, "9800000");
  const crossing = await createOrder(shop, member);
  const paymentPath = `/api/orders/${crossing.id}/pay`;
  const payments = await Promise.all([request(paymentPath, "POST", member.token), request(paymentPath, "POST", member.token)]);
  assert.deepEqual(payments.map(({ status }) => status).sort(), [200, 409]);

  const initialFee = await feeRows(crossing.id);
  assert.equal(initialFee.length, 1);
  assert.equal(initialFee[0].type, "FEE_CHARGE");
  assert.equal(initialFee[0].tier, "BRONZE");
  assert.equal(initialFee[0].amountVnd.toFixed(0), "10000");
  assert.equal(initialFee[0].orderTotalVnd.toFixed(0), "200000");
  const promoted = await finance(shop);
  assert.equal(promoted.tier.level, "SILVER");
  assert.equal(promoted.tier.revenueVnd, "10000000");
  assert.ok(promoted.tier.lastEvaluatedAt);

  const next = await pay(shop, member);
  const [silverFee] = await feeRows(next.id);
  assert.equal(silverFee.tier, "SILVER");
  assert.equal(silverFee.amountVnd.toFixed(0), "8000");
  assert.equal((await wallet(shop, member)).exactBalance, "40");

  const completed = await refund(shop, crossing.id);
  assert.equal(completed.status, 200);
  assert.equal(completed.json.refund.status, "COMPLETED");
  const duplicate = await request<{ error: string }>(`/api/orders/${crossing.id}/refund-request`, "POST", member.token, { reason: "Duplicate" });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.json.error, "REFUND_REQUEST_ALREADY_EXISTS");
  const entries = await feeRows(crossing.id);
  assert.deepEqual(entries.map(({ type, amountVnd, tier, feeRate }) => [type, amountVnd.toFixed(0), tier, feeRate.toNumber()]), [
    ["FEE_CHARGE", "10000", "BRONZE", 0.05], ["FEE_REVERSAL", "-10000", "BRONZE", 0.05],
  ]);
  assert.notEqual(entries[0].eventRef, entries[1].eventRef);
  assert.equal((await wallet(shop, member)).exactBalance, "20");
  const report = await finance(shop);
  assert.deepEqual(report.summary, { chargedVnd: "18000", reversedVnd: "10000", netVnd: "8000" });
  assert.deepEqual(report.sales, { orderNetVnd: "200000", merchantReceivesVnd: "192000" });
  assert.equal(report.tier.revenueVnd, "10000000");
  const reversals = await finance(shop, `?type=FEE_REVERSAL&orderId=${crossing.id}`);
  assert.deepEqual(reversals.items.map(({ type, orderId, amountVnd }) => [type, orderId, amountVnd]), [["FEE_REVERSAL", crossing.id, "-10000"]]);
  const ledger = await request<{ summary: { earned: string; reversed: string } }>(`/api/merchant/loyalty/transactions?memberId=${member.id}&type=EARN_REVERSAL`, "GET", shop.token);
  assert.equal(ledger.status, 200);
  assert.equal(ledger.json.summary.earned, "40");
  assert.equal(ledger.json.summary.reversed, "20");
});

test("Gold fee and half-up rounding are persisted, and fee reads are limited to owner or Admin", async () => {
  const shop = await createShop("200050");
  const foreignShop = await createShop();
  const member = await createMember();
  const admin = await createUser("ADMIN");
  await legacyOrder(shop, member, "50000000");
  const beforeDashboard = await request<{ stats: { platformFees: Summary } }>("/api/admin/dashboard", "GET", admin.token);
  assert.equal(beforeDashboard.status, 200);
  const order = await pay(shop, member);
  const [charge] = await feeRows(order.id);
  assert.equal(charge.tier, "GOLD");
  assert.equal(charge.amountVnd.toFixed(0), "6002");
  const refundResult = await refund(shop, order.id);
  assert.equal(refundResult.status, 200);

  const path = `/api/admin/merchants/${shop.id}/fees`;
  assert.equal((await request(financePath)).status, 401);
  assert.equal((await request(financePath, "GET", member.token)).status, 403);
  assert.equal((await request(path, "GET", foreignShop.token)).status, 403);
  assert.equal((await request(`/api/admin/merchants/${shop.id}/recalculate-tier`, "POST", foreignShop.token)).status, 403);
  const ownerReport = await finance(shop);
  const adminReport = await request<Finance>(path, "GET", admin.token);
  assert.equal(adminReport.status, 200);
  assert.deepEqual(adminReport.json, ownerReport);
  assert.equal(ownerReport.items.length, 2);
  assert.deepEqual((await finance(foreignShop)).items, []);

  const afterDashboard = await request<{ stats: { platformFees: Summary } }>("/api/admin/dashboard", "GET", admin.token);
  assert.equal(afterDashboard.status, 200);
  const beforeFees = beforeDashboard.json.stats.platformFees;
  const afterFees = afterDashboard.json.stats.platformFees;
  assert.equal(BigInt(afterFees.chargedVnd) - BigInt(beforeFees.chargedVnd), 6002n);
  assert.equal(BigInt(afterFees.reversedVnd) - BigInt(beforeFees.reversedVnd), 6002n);
  assert.equal(afterFees.netVnd, beforeFees.netVnd);
});

test("a signed VNPay success records one fee while refund requests are rejected", async () => {
  env.paymentMode = "vnpay";
  try {
    const shop = await createShop("200000");
    const member = await createMember();
    await legacyOrder(shop, member, "9800000");
    const payment = await beginVnpay(shop, member);
    assert.deepEqual(await feeRows(payment.order.id), []);
    assert.equal(await confirmVnpay(payment), "00");
    assert.equal(await confirmVnpay(payment), "02");
    const result = await request<{ error: string }>(`/api/orders/${payment.order.id}/refund-request`, "POST", member.token, { reason: "VNPay refund unsupported" });
    assert.equal(result.status, 409);
    assert.equal(result.json.error, "VNPAY_REFUND_NOT_SUPPORTED");
    assert.deepEqual((await feeRows(payment.order.id)).map(({ type }) => type), ["FEE_CHARGE"]);
    const report = await finance(shop);
    assert.equal(report.tier.level, "SILVER");
    assert.equal(report.tier.revenueVnd, "10000000");
    assert.deepEqual(report.summary, { chargedVnd: "10000", reversedVnd: "0", netVnd: "10000" });
  } finally {
    env.paymentMode = "mock";
  }
});

test("year-end fee stays in its original period and a later refund records its own negative entry", async () => {
  const shop = await createShop("200000");
  const member = await createMember();
  await legacyOrder(shop, member, "10000000");
  const order = await pay(shop, member);
  await prisma.order.update({ where: { id: order.id }, data: { paidAt: previousYearEnd } });
  await prisma.merchantFeeTransaction.update({
    where: { orderId_type: { orderId: order.id, type: "FEE_CHARGE" } },
    data: { createdAt: previousYearEnd },
  });

  const result = await refund(shop, order.id);
  assert.equal(result.status, 200);
  assert.equal(result.json.refund.status, "COMPLETED");
  const lastDay = `${calendarYear - 1}-12-31`;
  const historical = await finance(shop, `?from=${lastDay}&to=${lastDay}`);
  assert.deepEqual(historical.summary, { chargedVnd: "8000", reversedVnd: "0", netVnd: "8000" });
  assert.deepEqual(historical.items.map(({ type }) => type), ["FEE_CHARGE"]);

  const current = await finance(shop);
  assert.equal(current.tier.revenueVnd, "10000000");
  assert.deepEqual(current.summary, { chargedVnd: "0", reversedVnd: "8000", netVnd: "-8000" });
  assert.deepEqual(current.items.map(({ type, tier, orderId }) => [type, tier, orderId]), [["FEE_REVERSAL", "SILVER", order.id]]);
  const related = await finance(shop, `?orderId=${order.id}`);
  assert.deepEqual(related.summary, { chargedVnd: "8000", reversedVnd: "8000", netVnd: "0" });
  assert.deepEqual(related.items.map(({ type }) => type), ["FEE_REVERSAL", "FEE_CHARGE"]);
});

test("fees rounded to zero retain both payment and refund audit entries", async () => {
  const shop = await createShop("1");
  const member = await createMember();
  const order = await pay(shop, member);
  assert.equal((await refund(shop, order.id)).status, 200);
  assert.deepEqual((await feeRows(order.id)).map(({ type, amountVnd }) => [type, amountVnd.toFixed(0)]), [
    ["FEE_CHARGE", "0"], ["FEE_REVERSAL", "0"],
  ]);
  assert.deepEqual((await finance(shop)).summary, noFees);
});

test("admin report distinguishes legacy sales from a recorded zero fee and a refunded fee", async () => {
  const shop = await createShop("1");
  const member = await createMember();
  const admin = await createUser("ADMIN");
  await legacyOrder(shop, member, "10000", new Date());
  const order = await pay(shop, member);
  const report = async () => {
    const result = await request<{ merchants: { id: number; revenueVnd: string; feeCount: number; unrecordedOrderCount: number }[] }>("/api/admin/finance?period=year", "GET", admin.token);
    assert.equal(result.status, 200);
    return result.json.merchants.find(({ id }) => id === shop.id)!;
  };
  const before = await report();
  assert.equal(before.revenueVnd, "10001");
  assert.equal(before.unrecordedOrderCount, 1);
  assert.equal(before.feeCount, 1);
  assert.equal((await refund(shop, order.id)).status, 200);
  const after = await report();
  assert.equal(after.revenueVnd, "10000");
  assert.equal(after.unrecordedOrderCount, 1);
  assert.equal(after.feeCount, 2);
});
