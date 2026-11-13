import { Prisma } from "../../generated/prisma/client.js";
import type { MerchantFeeTier, MerchantFeeType } from "../../generated/prisma/enums.js";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";

const silverThreshold = 10_000_000;
const goldThreshold = 50_000_000;
const rates = { BRONZE: "0.05", SILVER: "0.04", GOLD: "0.03" } as const;
const vietnamYear = new Intl.DateTimeFormat("en", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric" });

export function merchantFinanceYear(now: Date) {
  const year = Number(vietnamYear.format(now));
  return { year, from: new Date(`${year}-01-01T00:00:00+07:00`), to: new Date(`${year + 1}-01-01T00:00:00+07:00`) };
}

export function merchantTierForRevenue(revenue: Prisma.Decimal): MerchantFeeTier {
  if (revenue.gte(goldThreshold)) return "GOLD";
  if (revenue.gte(silverThreshold)) return "SILVER";
  return "BRONZE";
}

function annualOrders(now: Date): Prisma.OrderWhereInput {
  const { from, to } = merchantFinanceYear(now);
  return { status: { in: ["PAID", "REFUND_PENDING"] }, paidAt: { gte: from, lt: to, lte: now } };
}

async function annualRevenue(tx: Prisma.TransactionClient, merchantId: number, now: Date, excludeOrderId?: number) {
  const result = await tx.order.aggregate({
    where: { merchantId, ...annualOrders(now), ...(excludeOrderId === undefined ? {} : { id: { not: excludeOrderId } }) },
    _sum: { total: true },
  });
  return result._sum.total ?? new Prisma.Decimal(0);
}

async function saveEvaluation(tx: Prisma.TransactionClient, merchantId: number, revenue: Prisma.Decimal, now: Date) {
  await tx.merchant.update({ where: { id: merchantId }, data: {
    feeTier: merchantTierForRevenue(revenue), feeTierYear: merchantFinanceYear(now).year, feeTierEvaluatedAt: now,
  } });
}

export async function recordMerchantFee(tx: Prisma.TransactionClient, order: { id: number; merchantId: number; total: Prisma.Decimal; paidAt: Date }) {
  const before = await annualRevenue(tx, order.merchantId, order.paidAt, order.id);
  const tier = merchantTierForRevenue(before);
  const feeRate = new Prisma.Decimal(rates[tier]);
  await tx.merchantFeeTransaction.create({ data: {
    orderId: order.id, merchantId: order.merchantId, type: "FEE_CHARGE",
    amountVnd: order.total.mul(feeRate).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP),
    orderTotalVnd: order.total, tier, feeRate, createdAt: order.paidAt, eventRef: `order-fee-${order.id}`,
  } });
  await saveEvaluation(tx, order.merchantId, before.plus(order.total), order.paidAt);
}

export async function reverseMerchantFee(tx: Prisma.TransactionClient, merchantId: number, orderId: number, now: Date) {
  const original = await tx.merchantFeeTransaction.findUnique({ where: { orderId_type: { orderId, type: "FEE_CHARGE" } } });
  if (original) {
    await tx.merchantFeeTransaction.create({ data: {
      orderId, merchantId, type: "FEE_REVERSAL", amountVnd: original.amountVnd.negated(),
      orderTotalVnd: original.orderTotalVnd, tier: original.tier, feeRate: original.feeRate,
      createdAt: now, eventRef: `order-fee-reversal-${orderId}`,
    } });
  }
  await saveEvaluation(tx, merchantId, await annualRevenue(tx, merchantId, now), now);
}

type Evaluation = { feeTierYear: number | null; feeTierEvaluatedAt: Date | null };

function tierDto(revenue: Prisma.Decimal, evaluation: Evaluation, now: Date) {
  const { year } = merchantFinanceYear(now);
  const level = merchantTierForRevenue(revenue);
  return {
    level, year, feeRate: rates[level], revenueVnd: revenue.toFixed(0),
    nextTier: level === "BRONZE" ? "SILVER" as const : level === "SILVER" ? "GOLD" as const : null,
    nextThresholdVnd: level === "BRONZE" ? String(silverThreshold) : level === "SILVER" ? String(goldThreshold) : null,
    lastEvaluatedAt: evaluation.feeTierYear === year ? evaluation.feeTierEvaluatedAt?.toISOString() ?? null : null,
  };
}

export async function listMerchantsWithFinanceTier() {
  const now = new Date();
  const [merchants, revenue] = await prisma.$transaction([
    prisma.merchant.findMany({
      select: { id: true, name: true, slug: true, isActive: true, feeTierYear: true, feeTierEvaluatedAt: true },
      orderBy: { id: "asc" },
    }),
    prisma.order.groupBy({ by: ["merchantId"], orderBy: { merchantId: "asc" }, where: annualOrders(now), _sum: { total: true } }),
  ]);
  const byMerchant = new Map(revenue.map((row) => [row.merchantId, row._sum?.total]));
  return merchants.map(({ feeTierYear, feeTierEvaluatedAt, ...merchant }) => ({
    ...merchant, financeTier: tierDto(byMerchant.get(merchant.id) ?? new Prisma.Decimal(0), { feeTierYear, feeTierEvaluatedAt }, now),
  }));
}

function dateBoundary(raw: unknown) {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new HttpError(400, "INVALID_INPUT");
  const utc = new Date(`${raw}T00:00:00Z`);
  if (!Number.isFinite(utc.getTime()) || utc.toISOString().slice(0, 10) !== raw) throw new HttpError(400, "INVALID_INPUT");
  return new Date(`${raw}T00:00:00+07:00`);
}

function queryId(raw: unknown) {
  if (raw === undefined) return undefined;
  if (typeof raw !== "string" || !/^\d+$/.test(raw) || +raw < 1 || +raw > 2_147_483_647) throw new HttpError(400, "INVALID_INPUT");
  return Number(raw);
}

export function readFinanceQuery(query: Record<string, unknown>) {
  const from = query.from === undefined ? undefined : dateBoundary(query.from);
  const to = query.to === undefined ? undefined : dateBoundary(query.to);
  if (from && to && from > to) throw new HttpError(400, "INVALID_INPUT");
  const { type } = query;
  if (type !== undefined && type !== "FEE_CHARGE" && type !== "FEE_REVERSAL") throw new HttpError(400, "INVALID_INPUT");
  const limit = queryId(query.limit) ?? 20;
  if (limit > 100) throw new HttpError(400, "INVALID_INPUT");
  return { from, to: to && new Date(to.getTime() + 86_400_000), type: type as MerchantFeeType | undefined, orderId: queryId(query.orderId), cursor: queryId(query.cursor), limit };
}

async function feeSummary(tx: Prisma.TransactionClient, where: Prisma.MerchantFeeTransactionWhereInput) {
  const rows = await tx.merchantFeeTransaction.groupBy({ by: ["type"], where, _sum: { amountVnd: true } });
  const total = (type: "FEE_CHARGE" | "FEE_REVERSAL") => rows.find((row) => row.type === type)?._sum.amountVnd ?? new Prisma.Decimal(0);
  const charged = total("FEE_CHARGE");
  const reversed = total("FEE_REVERSAL");
  return { chargedVnd: charged.toFixed(0), reversedVnd: reversed.abs().toFixed(0), netVnd: charged.plus(reversed).toFixed(0) };
}

export function getPlatformFeeSummary() {
  const { from, to } = merchantFinanceYear(new Date());
  return feeSummary(prisma, { createdAt: { gte: from, lt: to } });
}

export async function getMerchantFinance(merchantId: number, query: ReturnType<typeof readFinanceQuery>) {
  const now = new Date();
  const year = merchantFinanceYear(now);
  const { from, to, orderId, type, cursor, limit } = query;
  const createdAt = from || to ? { gte: from, lt: to } : orderId === undefined ? { gte: year.from, lt: year.to } : undefined;
  const where = { merchantId, createdAt, orderId };
  return prisma.$transaction(async (tx) => {
    const merchant = await tx.merchant.findUnique({ where: { id: merchantId }, select: { feeTierYear: true, feeTierEvaluatedAt: true } });
    if (!merchant) throw new HttpError(404, "MERCHANT_NOT_FOUND");
    const [revenue, summary, rows, orderAmounts] = await Promise.all([
      annualRevenue(tx, merchantId, now),
      feeSummary(tx, where),
      tx.merchantFeeTransaction.findMany({
        where: { ...where, ...(type ? { type } : {}), ...(cursor ? { id: { lt: cursor } } : {}) },
        orderBy: { id: "desc" }, take: limit + 1,
      }),
      tx.merchantFeeTransaction.groupBy({ by: ["type"], where, _sum: { orderTotalVnd: true } }),
    ]);
    const totalFor = (type: "FEE_CHARGE" | "FEE_REVERSAL") =>
      orderAmounts.find((entry) => entry.type === type)?._sum.orderTotalVnd ?? new Prisma.Decimal(0);
    const orderNet = totalFor("FEE_CHARGE").minus(totalFor("FEE_REVERSAL"));
    const items = rows.slice(0, limit).map((row) => ({
      ...row, amountVnd: row.amountVnd.toFixed(0), orderTotalVnd: row.orderTotalVnd.toFixed(0),
      feeRate: row.feeRate.toFixed(2), createdAt: row.createdAt.toISOString(),
    }));
    return { tier: tierDto(revenue, merchant, now), summary, sales: {
      orderNetVnd: orderNet.toFixed(0), merchantReceivesVnd: orderNet.minus(summary.netVnd).toFixed(0),
    }, items, nextCursor: rows.length > limit ? items.at(-1)!.id : null };
  });
}
