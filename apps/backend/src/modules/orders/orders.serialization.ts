import { Prisma } from "../../generated/prisma/client.js";
import type {
  OrderStatus,
  PaymentAttemptStatus,
  PointTransactionSource,
  PointTransactionType,
  RefundStatus,
} from "../../generated/prisma/enums.js";
import { describeTransaction, exactPoints } from "../loyalty/loyalty.balance.js";
import type { OrderActionsDto, OrderDto, OrderLoyaltyEventDto } from "./orders.types.js";

type OrderRecord = {
  id: number;
  merchantId: number;
  memberId: number;
  status: OrderStatus;
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  total: Prisma.Decimal;
  paidAt: Date | null;
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
