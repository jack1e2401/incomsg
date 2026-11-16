import { prisma } from "../../lib/prisma.js";
import {
  buildRevenueSeries,
  computeAnalyticsKpis,
  computeLowStockProducts,
  computeNoSales90DaysProducts,
  computeSlowMovingProducts,
  computeTopProducts,
  type ActiveProductInventoryInput,
} from "./analytics.domain.js";
import type { AnalyticsRange, MerchantAnalyticsDto } from "./analytics.types.js";

const NINETY_DAYS_MS = 90 * 86_400_000;

export async function getMerchantAnalytics(
  merchantId: number,
  range: AnalyticsRange,
): Promise<MerchantAnalyticsDto> {
  const window90Start = new Date(range.endExclusive.getTime() - NINETY_DAYS_MS);

  const [
    ordersInRange,
    totalMembers,
    newMembers,
    rangeOrderItems,
    activeProducts,
    sold90Rows,
    lastSoldItems,
  ] = await prisma.$transaction([
    prisma.order.findMany({
      where: {
        merchantId,
        status: { in: ["PAID", "REFUND_PENDING", "REFUNDED"] },
        paidAt: { gte: range.startAt, lt: range.endExclusive },
      },
      select: {
        memberId: true,
        status: true,
        total: true,
        paidAt: true,
      },
    }),
    prisma.merchantMembership.count({
      where: { merchantId },
    }),
    prisma.merchantMembership.count({
      where: {
        merchantId,
        createdAt: { gte: range.startAt, lt: range.endExclusive },
      },
    }),
    prisma.orderItem.findMany({
      where: {
        order: {
          merchantId,
          status: { in: ["PAID", "REFUND_PENDING"] },
          paidAt: { gte: range.startAt, lt: range.endExclusive },
        },
        product: {
          kind: "SALE",
        },
      },
      select: {
        productId: true,
        productName: true,
        quantity: true,
        lineTotal: true,
        product: { select: { sku: true } },
      },
    }),
    prisma.product.findMany({
      where: { merchantId, status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        sku: true,
        kind: true,
        lowStockThreshold: true,
        inventoryBalance: {
          select: { onHandQuantity: true, reservedQuantity: true },
        },
      },
    }),
    prisma.orderItem.findMany({
      where: {
        order: {
          merchantId,
          status: { in: ["PAID", "REFUND_PENDING"] },
          paidAt: { gte: window90Start, lt: range.endExclusive },
        },
        product: { kind: "SALE" },
      },
      distinct: ["productId"],
      select: { productId: true },
    }),
    prisma.orderItem.findMany({
      where: {
        order: {
          merchantId,
          status: { in: ["PAID", "REFUND_PENDING"] },
          paidAt: { lt: range.endExclusive },
        },
        product: { kind: "SALE" },
      },
      select: {
        productId: true,
        order: { select: { paidAt: true } },
      },
    }),
  ]);

  const qualifyingOrders = ordersInRange.filter(
    (order) => order.status === "PAID" || order.status === "REFUND_PENDING",
  );
  const inRangeMemberIds = Array.from(new Set(qualifyingOrders.map((order) => order.memberId)));

  let returningCustomers = 0;
  if (inRangeMemberIds.length > 0) {
    const lifetimeCounts = await prisma.order.groupBy({
      by: ["memberId"],
      where: {
        merchantId,
        memberId: { in: inRangeMemberIds },
        status: { in: ["PAID", "REFUND_PENDING"] },
      },
      orderBy: { memberId: "asc" },
      _count: { _all: true },
    });
    returningCustomers = lifetimeCounts.filter((row) => row._count._all >= 2).length;
  }

  const productInputs: ActiveProductInventoryInput[] = activeProducts.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    kind: product.kind,
    lowStockThreshold: product.lowStockThreshold,
    availableQuantity: product.inventoryBalance
      ? product.inventoryBalance.onHandQuantity - product.inventoryBalance.reservedQuantity
      : 0,
  }));

  const normalizedRangeItems = rangeOrderItems.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    sku: item.product.sku,
    quantity: item.quantity,
    lineTotal: item.lineTotal,
  }));

  const soldIn90DaysProductIds = new Set(sold90Rows.map((row) => row.productId));
  const lastSoldAtByProduct = new Map<number, Date>();
  for (const item of lastSoldItems) {
    const paidAt = item.order.paidAt;
    if (!paidAt) continue;
    const prev = lastSoldAtByProduct.get(item.productId);
    if (!prev || paidAt > prev) {
      lastSoldAtByProduct.set(item.productId, paidAt);
    }
  }

  return {
    range: {
      from: range.from,
      to: range.to,
      granularity: range.granularity,
      timezone: range.timezone,
    },
    kpis: computeAnalyticsKpis({
      ordersInRange,
      totalMembers,
      newMembers,
      returningCustomers,
    }),
    revenueSeries: buildRevenueSeries(range, qualifyingOrders),
    topProducts: computeTopProducts(normalizedRangeItems, 10),
    slowMovingProducts: computeSlowMovingProducts(productInputs, normalizedRangeItems, 10),
    noSales90DaysProducts: computeNoSales90DaysProducts(
      productInputs,
      soldIn90DaysProductIds,
      lastSoldAtByProduct,
    ),
    lowStockProducts: computeLowStockProducts(productInputs),
  };
}
