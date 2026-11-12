import { Prisma } from "../../generated/prisma/client.js";
import type {
  OrderStatus,
  PaymentAttemptStatus,
  PointTransactionSource,
  PointTransactionType,
  RefundStatus,
} from "../../generated/prisma/enums.js";
import { describeTransaction, exactPoints } from "../loyalty/loyalty.balance.js";
import type { AppliedLoyaltyPolicyDto, OrderActionsDto, OrderDto, OrderLoyaltyEventDto } from "./orders.types.js";

type OrderRecord = {
  id: number;
  merchantId: number;
  memberId: number;
  status: OrderStatus;
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  total: Prisma.Decimal;
  paidAt: Date | null;
  stockReservedUntil?: Date | null;
  loyaltySnapshot?: Prisma.JsonValue | null;
  items: {
    productId: number;
    productName: string;
    unitPrice: Prisma.Decimal;
    quantity: number;
    lineTotal: Prisma.Decimal;
  }[];
  earnedPointsExact?: Prisma.Decimal | null;
  paymentAttempt?: { status: PaymentAttemptStatus; createdAt: Date } | null;
  refund?: { status: RefundStatus } | null;
  pointTransactions?: {
    id: number;
    type: PointTransactionType;
    delta: Prisma.Decimal;
    balanceAfter: Prisma.Decimal;
    reason: string;
    source: PointTransactionSource;
    actorId: number | null;
    createdAt: Date;
  }[];
};

function appliedPolicy(value: Prisma.JsonValue | null | undefined): AppliedLoyaltyPolicyDto | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const snapshot = value as Record<string, Prisma.JsonValue>;
  const tiers = snapshot.tiers;
  if (!Array.isArray(tiers) || typeof snapshot.policyVersionId !== "number" || typeof snapshot.policyVersion !== "number" ||
      typeof snapshot.vndPerPoint !== "number" || typeof snapshot.ruleActive !== "boolean" ||
      typeof snapshot.tierLevel !== "string" || typeof snapshot.multiplier !== "string" ||
      typeof snapshot.capturedAt !== "string" || typeof snapshot.policyPublishedAt !== "string") return null;
  const validLevels = ["BRONZE", "SILVER", "GOLD", "PLATINUM"] as const;
  const tierLevel = validLevels.find((level) => level === snapshot.tierLevel);
  if (!tierLevel) return null;
  const parsedTiers: AppliedLoyaltyPolicyDto["tiers"] = [];
  for (const tier of tiers) {
    if (!tier || typeof tier !== "object" || Array.isArray(tier)) continue;
    const item = tier as Record<string, Prisma.JsonValue>;
    const level = validLevels.find((candidate) => candidate === item.level);
    if (level && typeof item.minLifetimePoints === "number" && typeof item.multiplier === "string") {
      parsedTiers.push({ level, minLifetimePoints: item.minLifetimePoints, multiplier: item.multiplier });
    }
  }
  return {
    policyVersionId: snapshot.policyVersionId,
    version: snapshot.policyVersion,
    publishedAt: snapshot.policyPublishedAt,
    capturedAt: snapshot.capturedAt,
    vndPerPoint: snapshot.vndPerPoint,
    isActive: snapshot.ruleActive,
    tierLevel,
    multiplier: snapshot.multiplier,
    tiers: parsedTiers,
  };
}

export function isStalePaymentAttempt(attempt: { status: PaymentAttemptStatus; createdAt: Date } | null | undefined): boolean {
  if (!attempt || attempt.status !== "CREATED") return false;
  return Date.now() - new Date(attempt.createdAt).getTime() > 15 * 60 * 1000;
}

export function computeOrderActions(
  status: OrderStatus,
  attempt: { status: PaymentAttemptStatus; createdAt: Date } | null | undefined,
  refund: { status: RefundStatus } | null | undefined,
): OrderActionsDto {
  const requiresReconciliation = isStalePaymentAttempt(attempt);
  const canCancel = status === "PENDING" && (!attempt || attempt.status === "FAILED");
  const canRefund = status === "PAID" && !refund;
  return {
    canCancel,
    canRefund,
    requiresReconciliation,
  };
}

export function toOrderDto(order: OrderRecord): OrderDto {
  const isPaidOrRefunded = ["PAID", "REFUND_PENDING", "REFUNDED"].includes(order.status);
  const earned = isPaidOrRefunded ? order.earnedPointsExact : null;
  const paymentAttempt = order.paymentAttempt ?? null;
  const refund = order.refund ?? null;
  const pointTransactions = order.pointTransactions;

  const loyaltyEvents: OrderLoyaltyEventDto[] = (pointTransactions ?? [])
    .filter((tx) => ["EARN", "EARN_REVERSAL"].includes(tx.type))
    .map((tx) => ({
      id: tx.id,
      type: tx.type,
      ...describeTransaction(tx),
      reason: tx.reason,
      source: tx.source,
      actorId: tx.actorId,
      createdAt: tx.createdAt.toISOString(),
    }));

  return {
    id: order.id,
    merchantId: order.merchantId,
    memberId: order.memberId,
    status: order.status,
    subtotal: order.subtotal.toFixed(0),
    discountAmount: order.discountAmount.toFixed(0),
    total: order.total.toFixed(0),
    paidAt: order.paidAt?.toISOString() ?? null,
    stockReservedUntil: order.stockReservedUntil?.toISOString() ?? null,
    appliedLoyaltyPolicy: appliedPolicy(order.loyaltySnapshot),
    earnedPoints: earned?.floor().toNumber() ?? (isPaidOrRefunded ? 0 : null),
    earnedPointsExact: earned === null || earned === undefined ? null : exactPoints(earned),
    items: order.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      unitPrice: item.unitPrice.toFixed(0),
      quantity: item.quantity,
      lineTotal: item.lineTotal.toFixed(0),
    })),
    paymentStatus: paymentAttempt?.status ?? null,
    refundStatus: refund?.status ?? null,
    loyaltyEvents,
    actions: computeOrderActions(order.status, paymentAttempt, refund),
  };
}
