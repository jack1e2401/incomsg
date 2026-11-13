import { Prisma } from "../../generated/prisma/client.js";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { merchantFinanceYear } from "../merchant/merchant.finance.js";

const dayMs = 86_400_000;
const vietnamOffsetMs = 7 * 3_600_000;
const zero = new Prisma.Decimal(0);

export function readFinancePeriod(value: unknown) {
  if (value === undefined || value === "year") return "year";
  if (value === "7d" || value === "30d") return value;
  throw new HttpError(400, "INVALID_INPUT");
}

function vietnamDay(date: Date) {
  return new Date(date.getTime() + vietnamOffsetMs).toISOString().slice(0, 10);
}

function periodBounds(period: ReturnType<typeof readFinancePeriod>, now: Date) {
  const today = new Date(`${vietnamDay(now)}T00:00:00+07:00`);
  const end = new Date(today.getTime() + dayMs);
  const start = period === "year" ? merchantFinanceYear(now).from
    : new Date(end.getTime() - (period === "7d" ? 7 : 30) * dayMs);
  const granularity = period === "year" ? "month" : "day";
  const keys = new Set<string>();
  for (let day = start.getTime(); day < end.getTime(); day += dayMs) {
    keys.add(vietnamDay(new Date(day)).slice(0, granularity === "month" ? 7 : 10));
  }
  return { start, end, granularity, keys };
}

export function getAdminFinance(period: ReturnType<typeof readFinancePeriod>, now = new Date()) {
  const { start, end, granularity, keys } = periodBounds(period, now);
  const dateFilter = { gte: start, lt: end, lte: now };
  const bucketFormat = granularity === "month" ? "%Y-%m" : "%Y-%m-%d";

  return prisma.$transaction(async (tx) => {
    const [sales, fees, buckets, unrecorded] = await Promise.all([
      tx.order.groupBy({
        by: ["merchantId", "status"],
        where: { paidAt: dateFilter, status: { in: ["PAID", "REFUND_PENDING", "REFUNDED"] } },
        _sum: { total: true },
      }),
      tx.merchantFeeTransaction.groupBy({
        by: ["merchantId", "type"], where: { createdAt: dateFilter }, _sum: { amountVnd: true }, _count: { _all: true },
      }),
      tx.$queryRaw<{ bucket: string; amount: Prisma.Decimal }[]>`
        SELECT DATE_FORMAT(DATE_ADD(createdAt, INTERVAL 7 HOUR), ${bucketFormat}) AS bucket,
               SUM(amountVnd) AS amount
        FROM MerchantFeeTransaction
        WHERE createdAt >= ${start} AND createdAt < ${end} AND createdAt <= ${now}
        GROUP BY bucket
      `,
      tx.order.groupBy({
        by: ["merchantId"],
        where: { paidAt: dateFilter, status: { in: ["PAID", "REFUND_PENDING"] }, feeTransactions: { none: { type: "FEE_CHARGE" } } },
        _count: { _all: true },
      }),
    ]);

    const activity = new Map<number, { revenue: Prisma.Decimal; charged: Prisma.Decimal; reversed: Prisma.Decimal; feeCount: number; unrecordedCount: number }>();
    function totals(merchantId: number) {
      const entry = activity.get(merchantId) ?? { revenue: zero, charged: zero, reversed: zero, feeCount: 0, unrecordedCount: 0 };
      activity.set(merchantId, entry);
      return entry;
    }
    for (const row of sales) {
      const entry = totals(row.merchantId);
      if (row.status !== "REFUNDED") entry.revenue = entry.revenue.plus(row._sum.total ?? zero);
    }
    for (const row of fees) {
      const entry = totals(row.merchantId);
      const amount = row._sum.amountVnd ?? zero;
      entry.feeCount += row._count._all;
      if (row.type === "FEE_CHARGE") entry.charged = entry.charged.plus(amount);
      else entry.reversed = entry.reversed.minus(amount);
    }
    for (const row of unrecorded) totals(row.merchantId).unrecordedCount = row._count._all;

    const merchants = await tx.merchant.findMany({
      where: { id: { in: [...activity.keys()] } },
      select: { id: true, name: true, isActive: true },
      orderBy: { id: "asc" },
    });
    let charged = zero;
    let reversed = zero;
    const items = merchants.map((merchant) => {
      const entry = totals(merchant.id);
      charged = charged.plus(entry.charged);
      reversed = reversed.plus(entry.reversed);
      return {
        ...merchant, revenueVnd: entry.revenue.toFixed(0), chargedVnd: entry.charged.toFixed(0),
        reversedVnd: entry.reversed.toFixed(0), netVnd: entry.charged.minus(entry.reversed).toFixed(0),
        feeCount: entry.feeCount, unrecordedOrderCount: entry.unrecordedCount,
      };
    });
    const amounts = new Map(buckets.map(({ bucket, amount }) => [bucket, amount]));
    return {
      from: vietnamDay(start), to: vietnamDay(now), granularity,
      summary: { chargedVnd: charged.toFixed(0), reversedVnd: reversed.toFixed(0), netVnd: charged.minus(reversed).toFixed(0) },
      series: [...keys].map((bucket) => ({ bucket, netVnd: (amounts.get(bucket) ?? zero).toFixed(0) })),
      merchants: items,
    };
  });
}
