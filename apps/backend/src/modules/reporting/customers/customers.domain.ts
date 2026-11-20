import { Prisma } from "../../../generated/prisma/client.js";
import type { OrderStatus } from "../../../generated/prisma/enums.js";
import { HttpError } from "../../../lib/http-error.js";
import { selectTier, type TierThreshold } from "../../loyalty/program/loyalty.calculation.js";
import type {
  CustomerListQuery,
  CustomerPurchaseStatus,
  CustomerStatsDto,
  CustomerTier,
} from "./customers.types.js";

const VALID_TIERS: readonly CustomerTier[] = ["UNRANKED", "BRONZE", "SILVER", "GOLD", "PLATINUM"];
const VALID_PURCHASE_STATUSES: readonly CustomerPurchaseStatus[] = ["all", "buyers", "non_buyers"];

function readPositiveInt(raw: unknown, fallback: number, max: number): number {
  if (raw === undefined || raw === "") return fallback;
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return value;
}

export function parseCustomerListQuery(query: Record<string, unknown>): CustomerListQuery {
  const qRaw = query.q;
  let q: string | undefined;
  if (qRaw !== undefined) {
    if (typeof qRaw !== "string" || qRaw.trim().length > 191) {
      throw new HttpError(400, "INVALID_INPUT");
    }
    const trimmed = qRaw.trim();
    if (trimmed.length > 0) q = trimmed;
  }

  const tierRaw = query.tier;
  let tier: CustomerTier | undefined;
  if (tierRaw !== undefined && tierRaw !== "") {
    if (typeof tierRaw !== "string" || !VALID_TIERS.includes(tierRaw as CustomerTier)) {
      throw new HttpError(400, "INVALID_INPUT");
    }
    tier = tierRaw as CustomerTier;
  }

  const statusRaw = query.purchaseStatus;
  let purchaseStatus: CustomerPurchaseStatus = "all";
  if (statusRaw !== undefined && statusRaw !== "") {
    if (typeof statusRaw !== "string" || !VALID_PURCHASE_STATUSES.includes(statusRaw as CustomerPurchaseStatus)) {
      throw new HttpError(400, "INVALID_INPUT");
    }
    purchaseStatus = statusRaw as CustomerPurchaseStatus;
  }

  return {
    q,
    tier,
    purchaseStatus,
    page: readPositiveInt(query.page, 1, 1_000_000),
    limit: readPositiveInt(query.limit, 20, 100),
  };
}

export function resolveMemberTier(params: {
  tierId: number | null;
  hasEarnTransaction: boolean;
  netLifetimeEarned: Prisma.Decimal | string;
  tiers: readonly TierThreshold[];
}): CustomerTier {
  const ranked = params.tierId !== null || params.hasEarnTransaction;
  if (!ranked) return "UNRANKED";
  return selectTier(params.netLifetimeEarned, params.tiers) ?? "UNRANKED";
}

export function computeCustomerStats(
  orders: readonly { status: OrderStatus; total: Prisma.Decimal | string | number; paidAt: Date | null }[],
): CustomerStatsDto {
  let paidOrderCount = 0;
  let refundPendingOrderCount = 0;
  let refundedOrderCount = 0;
  let paidSpend = new Prisma.Decimal(0);
  let refundPendingSpend = new Prisma.Decimal(0);
  let lastPurchaseAt: Date | null = null;

  for (const order of orders) {
    if (order.status === "PAID") {
      paidOrderCount += 1;
      paidSpend = paidSpend.plus(order.total.toString());
      if (order.paidAt && (!lastPurchaseAt || order.paidAt > lastPurchaseAt)) {
        lastPurchaseAt = order.paidAt;
      }
    } else if (order.status === "REFUND_PENDING") {
      refundPendingOrderCount += 1;
      refundPendingSpend = refundPendingSpend.plus(order.total.toString());
      if (order.paidAt && (!lastPurchaseAt || order.paidAt > lastPurchaseAt)) {
        lastPurchaseAt = order.paidAt;
      }
    } else if (order.status === "REFUNDED") {
      refundedOrderCount += 1;
    }
  }

  const netSpend = paidSpend.plus(refundPendingSpend);
  const qualifyingCount = paidOrderCount + refundPendingOrderCount;
  const averageOrderValueVnd = qualifyingCount === 0
    ? "0"
    : netSpend.div(qualifyingCount).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toFixed(0);

  return {
    totalOrders: orders.length,
    paidOrderCount,
    refundPendingOrderCount,
    refundedOrderCount,
    netSpendVnd: netSpend.toFixed(0),
    refundPendingSpendVnd: refundPendingSpend.toFixed(0),
    averageOrderValueVnd,
    lastPurchaseAt: lastPurchaseAt ? lastPurchaseAt.toISOString() : null,
  };
}
