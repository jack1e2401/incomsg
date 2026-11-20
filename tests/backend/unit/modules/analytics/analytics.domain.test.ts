import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildRevenueSeries,
  computeAnalyticsKpis,
  computeLowStockProducts,
  computeNoSales90DaysProducts,
  computeSlowMovingProducts,
  computeTopProducts,
  parseAnalyticsQuery,
} from "../../../../../apps/backend/src/modules/reporting/analytics/analytics.domain.js";
import {
  computeCustomerStats,
  parseCustomerListQuery,
  resolveMemberTier,
} from "../../../../../apps/backend/src/modules/reporting/customers/customers.domain.js";
import { defaultTiers } from "../../../../../apps/backend/src/modules/loyalty/program/loyalty.config.js";

test("parseAnalyticsQuery defaults to 30-day VN window and validates boundaries", () => {
  const now = new Date("2026-11-16T17:30:00Z"); // 2026-11-17 00:30 in Asia/Ho_Chi_Minh
  const range = parseAnalyticsQuery({}, now);
  assert.equal(range.to, "2026-11-17");
  assert.equal(range.from, "2026-10-19");
  assert.equal(range.granularity, "day");
  assert.equal(range.timezone, "Asia/Ho_Chi_Minh");
  assert.equal(range.startAt.toISOString(), "2026-10-18T17:00:00.000Z");
  assert.equal(range.endExclusive.toISOString(), "2026-11-17T17:00:00.000Z");

  const monthRange = parseAnalyticsQuery({ granularity: "month", to: "2026-11-16" });
  assert.equal(monthRange.from, "2025-12-01");
  assert.equal(monthRange.to, "2026-11-16");

  assert.throws(() => parseAnalyticsQuery({ from: "2026-11-20", to: "2026-11-10" }));
  assert.throws(() => parseAnalyticsQuery({ from: "2025-01-01", to: "2026-01-03" }));
  assert.throws(() => parseAnalyticsQuery({ from: "2026-02-30", to: "2026-03-01" }));
  assert.throws(() => parseAnalyticsQuery({ granularity: "week" }));
});

test("computeAnalyticsKpis uses exact Decimal arithmetic, ROUND_HALF_UP AOV, and REFUND_PENDING rules", () => {
  const kpis = computeAnalyticsKpis({
    ordersInRange: [
      { memberId: 1, status: "PAID", total: "100001", paidAt: new Date("2026-11-16T02:00:00+07:00") },
      { memberId: 2, status: "REFUND_PENDING", total: "50000", paidAt: new Date("2026-11-16T03:00:00+07:00") },
      { memberId: 3, status: "REFUNDED", total: "80000", paidAt: new Date("2026-11-16T04:00:00+07:00") },
      { memberId: 4, status: "PENDING", total: "999999", paidAt: null },
      { memberId: 5, status: "CANCELLED", total: "999999", paidAt: null },
    ],
    totalMembers: 12,
    newMembers: 4,
    returningCustomers: 1,
  });

  // 150001 / 2 = 75000.5 -> ROUND_HALF_UP => 75001
  assert.deepEqual(kpis, {
    netRevenueVnd: "150001",
    paidOnlyRevenueVnd: "100001",
    refundPendingRevenueVnd: "50000",
    refundedRevenueVnd: "80000",
    paidOrderCount: 2,
    refundPendingOrderCount: 1,
    refundedOrderCount: 1,
    averageOrderValueVnd: "75001",
    totalMembers: 12,
    newMembers: 4,
    returningCustomers: 1,
  });

  const emptyKpis = computeAnalyticsKpis({
    ordersInRange: [],
    totalMembers: 0,
    newMembers: 0,
    returningCustomers: 0,
  });
  assert.equal(emptyKpis.averageOrderValueVnd, "0");
  assert.equal(emptyKpis.netRevenueVnd, "0");
});

test("buildRevenueSeries assigns Asia/Ho_Chi_Minh day/month buckets and zero-fills empty buckets", () => {
  const range = parseAnalyticsQuery({ from: "2026-11-15", to: "2026-11-17", granularity: "day" });
  const series = buildRevenueSeries(range, [
    // 2026-11-15T17:30:00Z is 2026-11-16 00:30:00+07:00 -> bucket 2026-11-16
    { memberId: 1, status: "PAID", total: "120000", paidAt: new Date("2026-11-15T17:30:00Z") },
    { memberId: 2, status: "REFUND_PENDING", total: "30000", paidAt: new Date("2026-11-16T23:59:59+07:00") },
    { memberId: 3, status: "REFUNDED", total: "50000", paidAt: new Date("2026-11-15T12:00:00+07:00") },
  ]);

  assert.deepEqual(series, [
    { bucket: "2026-11-15", label: "15/11", revenueVnd: "0", orderCount: 0 },
    { bucket: "2026-11-16", label: "16/11", revenueVnd: "150000", orderCount: 2 },
    { bucket: "2026-11-17", label: "17/11", revenueVnd: "0", orderCount: 0 },
  ]);

  const monthRange = parseAnalyticsQuery({ from: "2026-10-01", to: "2026-11-30", granularity: "month" });
  const monthly = buildRevenueSeries(monthRange, [
    { memberId: 1, status: "PAID", total: "250000", paidAt: new Date("2026-10-31T17:00:00Z") }, // Nov 1 00:00 VN
  ]);
  assert.deepEqual(monthly, [
    { bucket: "2026-10", label: "10/2026", revenueVnd: "0", orderCount: 0 },
    { bucket: "2026-11", label: "11/2026", revenueVnd: "250000", orderCount: 1 },
  ]);
});

test("product analytics helpers compute top, slow-moving, no-sales-90d, and low-stock accurately", () => {
  const products = [
    { id: 1, name: "Matcha", sku: "M-01", kind: "SALE" as const, lowStockThreshold: 5, availableQuantity: 10 },
    { id: 2, name: "Oolong", sku: "O-01", kind: "SALE" as const, lowStockThreshold: 5, availableQuantity: 3 },
    { id: 3, name: "Gift Mug", sku: "G-01", kind: "REWARD" as const, lowStockThreshold: 2, availableQuantity: 2 },
  ];
  const rangeItems = [
    { productId: 1, productName: "Matcha", sku: "M-01", quantity: 4, lineTotal: "200000" },
  ];

  assert.deepEqual(computeTopProducts(rangeItems), [
    { productId: 1, productName: "Matcha", sku: "M-01", unitsSold: 4, revenueVnd: "200000" },
  ]);

  assert.deepEqual(computeSlowMovingProducts(products, rangeItems), [
    { productId: 2, productName: "Oolong", sku: "O-01", unitsSold: 0, revenueVnd: "0", availableQuantity: 3 },
    { productId: 1, productName: "Matcha", sku: "M-01", unitsSold: 4, revenueVnd: "200000", availableQuantity: 10 },
  ]);

  const sold90 = new Set([1]);
  const lastSold = new Map([[2, new Date("2026-01-01T00:00:00.000Z")]]);
  assert.deepEqual(computeNoSales90DaysProducts(products, sold90, lastSold), [
    { productId: 2, productName: "Oolong", sku: "O-01", availableQuantity: 3, lastSoldAt: "2026-01-01T00:00:00.000Z" },
  ]);

  assert.deepEqual(computeLowStockProducts(products), [
    { productId: 3, productName: "Gift Mug", sku: "G-01", availableQuantity: 2, lowStockThreshold: 2 },
    { productId: 2, productName: "Oolong", sku: "O-01", availableQuantity: 3, lowStockThreshold: 5 },
  ]);
});

test("customer domain helpers compute Customer 360 stats, unranked tier rule, and query validation", () => {
  const query = parseCustomerListQuery({ q: " alice@test ", tier: "GOLD", purchaseStatus: "buyers", page: "2", limit: "15" });
  assert.deepEqual(query, { q: "alice@test", tier: "GOLD", purchaseStatus: "buyers", page: 2, limit: 15 });
  assert.throws(() => parseCustomerListQuery({ tier: "DIAMOND" }));
  assert.throws(() => parseCustomerListQuery({ purchaseStatus: "vip" }));

  assert.equal(
    resolveMemberTier({ tierId: null, hasEarnTransaction: false, netLifetimeEarned: "0", tiers: defaultTiers }),
    "UNRANKED",
  );
  assert.equal(
    resolveMemberTier({ tierId: null, hasEarnTransaction: true, netLifetimeEarned: "1200", tiers: defaultTiers }),
    "SILVER",
  );

  const stats = computeCustomerStats([
    { status: "PAID", total: "100001", paidAt: new Date("2026-11-10T10:00:00Z") },
    { status: "REFUND_PENDING", total: "50000", paidAt: new Date("2026-11-12T10:00:00Z") },
    { status: "REFUNDED", total: "40000", paidAt: new Date("2026-11-13T10:00:00Z") },
    { status: "CANCELLED", total: "99000", paidAt: null },
  ]);
  assert.deepEqual(stats, {
    totalOrders: 4,
    paidOrderCount: 1,
    refundPendingOrderCount: 1,
    refundedOrderCount: 1,
    netSpendVnd: "150001",
    refundPendingSpendVnd: "50000",
    averageOrderValueVnd: "75001",
    lastPurchaseAt: "2026-11-12T10:00:00.000Z",
  });
});
