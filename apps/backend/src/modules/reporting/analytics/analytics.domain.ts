import { Prisma } from "../../../generated/prisma/client.js";
import type { OrderStatus } from "../../../generated/prisma/enums.js";
import { HttpError } from "../../../lib/http-error.js";
import type {
  AnalyticsGranularity,
  AnalyticsKpisDto,
  AnalyticsRange,
  LowStockProductDto,
  NoSalesProductDto,
  RevenueSeriesPointDto,
  SlowMovingProductDto,
  TopProductDto,
} from "./analytics.types.js";

const VN_TIMEZONE = "Asia/Ho_Chi_Minh";
const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 366;

const vnDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: VN_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatVnDate(date: Date): string {
  return vnDateFormatter.format(date);
}

export function formatVnMonth(date: Date): string {
  return formatVnDate(date).slice(0, 7);
}

export function parseVnDateString(raw: unknown): string {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  const utc = new Date(`${raw}T00:00:00Z`);
  if (!Number.isFinite(utc.getTime()) || utc.toISOString().slice(0, 10) !== raw) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return raw;
}

export function defaultFromForTo(to: string, granularity: AnalyticsGranularity): string {
  if (granularity === "day") {
    const toStart = new Date(`${to}T00:00:00+07:00`);
    return formatVnDate(new Date(toStart.getTime() - 29 * DAY_MS));
  }
  const [year, month] = to.split("-").map(Number);
  const startMonth = new Date(Date.UTC(year!, month! - 1 - 11, 1));
  return startMonth.toISOString().slice(0, 10);
}

export function parseAnalyticsQuery(
  query: Record<string, unknown>,
  now = new Date(),
): AnalyticsRange {
  const granularityRaw = query.granularity;
  let granularity: AnalyticsGranularity = "day";
  if (granularityRaw !== undefined && granularityRaw !== "") {
    if (granularityRaw !== "day" && granularityRaw !== "month") {
      throw new HttpError(400, "INVALID_INPUT");
    }
    granularity = granularityRaw;
  }

  const to = query.to === undefined || query.to === ""
    ? formatVnDate(now)
    : parseVnDateString(query.to);

  const from = query.from === undefined || query.from === ""
    ? defaultFromForTo(to, granularity)
    : parseVnDateString(query.from);

  const startAt = new Date(`${from}T00:00:00+07:00`);
  const endInclusiveStart = new Date(`${to}T00:00:00+07:00`);
  const endExclusive = new Date(endInclusiveStart.getTime() + DAY_MS);

  if (startAt > endInclusiveStart) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  const totalDays = Math.round((endExclusive.getTime() - startAt.getTime()) / DAY_MS);
  if (totalDays > MAX_RANGE_DAYS) {
    throw new HttpError(400, "INVALID_INPUT");
  }

  return {
    from,
    to,
    granularity,
    timezone: VN_TIMEZONE,
    startAt,
    endExclusive,
  };
}

export interface AnalyticsOrderInput {
  memberId: number;
  status: OrderStatus;
  total: Prisma.Decimal | string | number;
  paidAt: Date | null;
}

export function computeAnalyticsKpis(params: {
  ordersInRange: readonly AnalyticsOrderInput[];
  totalMembers: number;
  newMembers: number;
  returningCustomers: number;
}): AnalyticsKpisDto {
  let paidOnlyRevenue = new Prisma.Decimal(0);
  let refundPendingRevenue = new Prisma.Decimal(0);
  let refundedRevenue = new Prisma.Decimal(0);
  let paidOnlyCount = 0;
  let refundPendingOrderCount = 0;
  let refundedOrderCount = 0;

  for (const order of params.ordersInRange) {
    const amount = new Prisma.Decimal(order.total.toString());
    if (order.status === "PAID") {
      paidOnlyCount += 1;
      paidOnlyRevenue = paidOnlyRevenue.plus(amount);
    } else if (order.status === "REFUND_PENDING") {
      refundPendingOrderCount += 1;
      refundPendingRevenue = refundPendingRevenue.plus(amount);
    } else if (order.status === "REFUNDED") {
      refundedOrderCount += 1;
      refundedRevenue = refundedRevenue.plus(amount);
    }
  }

  const netRevenue = paidOnlyRevenue.plus(refundPendingRevenue);
  const paidOrderCount = paidOnlyCount + refundPendingOrderCount;
  const averageOrderValueVnd = paidOrderCount === 0
    ? "0"
    : netRevenue.div(paidOrderCount).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toFixed(0);

  return {
    netRevenueVnd: netRevenue.toFixed(0),
    paidOnlyRevenueVnd: paidOnlyRevenue.toFixed(0),
    refundPendingRevenueVnd: refundPendingRevenue.toFixed(0),
    refundedRevenueVnd: refundedRevenue.toFixed(0),
    paidOrderCount,
    refundPendingOrderCount,
    refundedOrderCount,
    averageOrderValueVnd,
    totalMembers: params.totalMembers,
    newMembers: params.newMembers,
    returningCustomers: params.returningCustomers,
  };
}

export function buildRevenueSeries(
  range: Pick<AnalyticsRange, "from" | "to" | "granularity" | "startAt" | "endExclusive">,
  qualifyingOrders: readonly AnalyticsOrderInput[],
): RevenueSeriesPointDto[] {
  const buckets = new Map<string, { bucket: string; label: string; revenue: Prisma.Decimal; orderCount: number }>();

  if (range.granularity === "day") {
    for (let ts = range.startAt.getTime(); ts < range.endExclusive.getTime(); ts += DAY_MS) {
      const bucket = formatVnDate(new Date(ts));
      const label = `${bucket.slice(8, 10)}/${bucket.slice(5, 7)}`;
      buckets.set(bucket, { bucket, label, revenue: new Prisma.Decimal(0), orderCount: 0 });
    }
  } else {
    const [fromYear, fromMonth] = range.from.slice(0, 7).split("-").map(Number);
    const [toYear, toMonth] = range.to.slice(0, 7).split("-").map(Number);
    let year = fromYear!;
    let month = fromMonth!;
    while (year < toYear! || (year === toYear! && month <= toMonth!)) {
      const mm = String(month).padStart(2, "0");
      const bucket = `${year}-${mm}`;
      const label = `${mm}/${year}`;
      buckets.set(bucket, { bucket, label, revenue: new Prisma.Decimal(0), orderCount: 0 });
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  }

  for (const order of qualifyingOrders) {
    if ((order.status !== "PAID" && order.status !== "REFUND_PENDING") || !order.paidAt) {
      continue;
    }
    const bucketKey = range.granularity === "day"
      ? formatVnDate(order.paidAt)
      : formatVnMonth(order.paidAt);
    const entry = buckets.get(bucketKey);
    if (!entry) continue;
    entry.revenue = entry.revenue.plus(order.total.toString());
    entry.orderCount += 1;
  }

  return Array.from(buckets.values()).map((entry) => ({
    bucket: entry.bucket,
    label: entry.label,
    revenueVnd: entry.revenue.toFixed(0),
    orderCount: entry.orderCount,
  }));
}

export interface RangeSaleItemInput {
  productId: number;
  productName: string;
  sku: string | null;
  quantity: number;
  lineTotal: Prisma.Decimal | string | number;
}

export interface ActiveProductInventoryInput {
  id: number;
  name: string;
  sku: string | null;
  kind: "SALE" | "REWARD";
  lowStockThreshold: number;
  availableQuantity: number;
}

export function computeTopProducts(items: readonly RangeSaleItemInput[], limit = 10): TopProductDto[] {
  const byProduct = new Map<
    number,
    { productId: number; productName: string; sku: string | null; unitsSold: number; revenue: Prisma.Decimal }
  >();
  for (const item of items) {
    const existing = byProduct.get(item.productId) ?? {
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      unitsSold: 0,
      revenue: new Prisma.Decimal(0),
    };
    existing.unitsSold += item.quantity;
    existing.revenue = existing.revenue.plus(item.lineTotal.toString());
    byProduct.set(item.productId, existing);
  }

  return Array.from(byProduct.values())
    .sort((a, b) => {
      if (b.unitsSold !== a.unitsSold) return b.unitsSold - a.unitsSold;
      const revCmp = b.revenue.comparedTo(a.revenue);
      if (revCmp !== 0) return revCmp;
      return a.productId - b.productId;
    })
    .slice(0, limit)
    .map((entry) => ({
      productId: entry.productId,
      productName: entry.productName,
      sku: entry.sku,
      unitsSold: entry.unitsSold,
      revenueVnd: entry.revenue.toFixed(0),
    }));
}

export function computeSlowMovingProducts(
  activeSaleProducts: readonly ActiveProductInventoryInput[],
  rangeSaleItems: readonly RangeSaleItemInput[],
  limit = 10,
): SlowMovingProductDto[] {
  const salesByProduct = new Map<number, { unitsSold: number; revenue: Prisma.Decimal }>();
  for (const item of rangeSaleItems) {
    const existing = salesByProduct.get(item.productId) ?? {
      unitsSold: 0,
      revenue: new Prisma.Decimal(0),
    };
    existing.unitsSold += item.quantity;
    existing.revenue = existing.revenue.plus(item.lineTotal.toString());
    salesByProduct.set(item.productId, existing);
  }

  return activeSaleProducts
    .filter((product) => product.kind === "SALE")
    .map((product) => {
      const sales = salesByProduct.get(product.id);
      return {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        unitsSold: sales?.unitsSold ?? 0,
        revenue: sales?.revenue ?? new Prisma.Decimal(0),
        availableQuantity: product.availableQuantity,
      };
    })
    .sort((a, b) => {
      if (a.unitsSold !== b.unitsSold) return a.unitsSold - b.unitsSold;
      const revCmp = a.revenue.comparedTo(b.revenue);
      if (revCmp !== 0) return revCmp;
      if (b.availableQuantity !== a.availableQuantity) return b.availableQuantity - a.availableQuantity;
      return a.productId - b.productId;
    })
    .slice(0, limit)
    .map(({ revenue, ...rest }) => ({
      ...rest,
      revenueVnd: revenue.toFixed(0),
    }));
}

export function computeNoSales90DaysProducts(
  activeSaleProducts: readonly ActiveProductInventoryInput[],
  soldIn90DaysProductIds: ReadonlySet<number>,
  lastSoldAtByProduct: ReadonlyMap<number, Date>,
): NoSalesProductDto[] {
  return activeSaleProducts
    .filter((product) => product.kind === "SALE" && !soldIn90DaysProductIds.has(product.id))
    .sort((a, b) => {
      if (b.availableQuantity !== a.availableQuantity) return b.availableQuantity - a.availableQuantity;
      return a.id - b.id;
    })
    .map((product) => ({
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      availableQuantity: product.availableQuantity,
      lastSoldAt: lastSoldAtByProduct.get(product.id)?.toISOString() ?? null,
    }));
}

export function computeLowStockProducts(
  activeProducts: readonly ActiveProductInventoryInput[],
): LowStockProductDto[] {
  return activeProducts
    .filter((product) => product.availableQuantity <= product.lowStockThreshold)
    .sort((a, b) => {
      if (a.availableQuantity !== b.availableQuantity) return a.availableQuantity - b.availableQuantity;
      return a.id - b.id;
    })
    .map((product) => ({
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      availableQuantity: product.availableQuantity,
      lowStockThreshold: product.lowStockThreshold,
    }));
}
