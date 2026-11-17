import type {
  OrderStatus,
  PaymentAttemptStatus,
  PointTransactionSource,
  PointTransactionType,
  RefundStatus,
  TierLevel,
} from "../../generated/prisma/enums.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { HttpError } from "../../lib/http-error.js";
import type { describeWallet } from "../loyalty/loyalty.balance.js";

export class OrderNotCancellableError extends HttpError {
  readonly orderStatus: string;
  readonly paymentStatus: string | null;

  constructor(orderStatus: string, paymentStatus: string | null) {
    super(409, "ORDER_NOT_CANCELLABLE");
    this.orderStatus = orderStatus;
    this.paymentStatus = paymentStatus;
  }
}

export type WalletDescriptionDto = ReturnType<typeof describeWallet>;

type OrderLineInput = {
  productId: number;
  quantity: number;
};

export type CreateOrderInput = {
  items: OrderLineInput[];
  voucherId?: number;
};

export type CreatePendingOrderInput = {
  memberId: number;
  merchantId: number;
  items: (OrderLineInput & {
    productName: string;
    unitPrice: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
  })[];
  subtotal: Prisma.Decimal;
  voucherId: number | null;
};

export type OrderItemDto = {
  productId: number;
  productName: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
};

export type OrderActionsDto = {
  canCancel: boolean;
  canRefund: boolean;
  requiresReconciliation: boolean;
  canRequestRefund?: boolean;
};
export type RefundRequestSummaryDto = {
  id: number;
  status: import("../../generated/prisma/enums.js").RefundRequestStatus;
  requestedAt: string;
  reason: string;
  merchantReviewedAt: string | null;
  adminReviewedAt: string | null;
  merchantDecisionReason: string | null;
  adminDecisionReason: string | null;
};

export type OrderLoyaltyEventDto = {
  id: number;
  type: PointTransactionType;
  delta: string;
  balanceAfter: string;
  availablePointsAfter: number;
  fractionalCarryAfter: string;
  pointDebtAfter: string;
  reason: string;
  source: PointTransactionSource;
  actorId: number | null;
  createdAt: string;
};

export type OrderDto = {
  id: number;
  merchantId: number;
  memberId: number;
  status: OrderStatus;
  subtotal: string;
  discountAmount: string;
  total: string;
  paidAt: string | null;
  stockReservedUntil?: string | null;
  appliedLoyaltyPolicy?: AppliedLoyaltyPolicyDto | null;
  items: OrderItemDto[];
  earnedPoints?: number | null;
  earnedPointsExact: string | null;
  promotedToTier?: TierLevel | null;
  paymentStatus?: PaymentAttemptStatus | null;
  refundStatus?: RefundStatus | null;
  refundRequest?: RefundRequestSummaryDto | null;
  loyaltyEvents?: OrderLoyaltyEventDto[];
  actions?: OrderActionsDto;
};

export type AppliedLoyaltyPolicyDto = {
  policyVersionId: number;
  version: number;
  publishedAt: string;
  capturedAt: string;
  vndPerPoint: number;
  isActive: boolean;
  tierLevel: TierLevel;
  multiplier: string;
  tiers: { level: TierLevel; minLifetimePoints: number; multiplier: string }[];
};

export type CancelOrderResult = {
  order: OrderDto;
  voucherReleased: boolean;
  capacityReleasedExact: string;
};

export type RefundPreviewDto = {
  orderId: number;
  refundAmountVnd: string;
  refundStatus: RefundStatus | null;
  earningReversalExact: string;
  walletBefore: WalletDescriptionDto;
  walletAfter: WalletDescriptionDto;
  tierBefore: string;
  tierAfter: string;
  discountVoucherRestorable: boolean;
  providerConfirmationRequired: boolean;
  challenges: ChallengeRefundImpactDto[];
};
export type ChallengeRefundImpactDto = {
  challengeId: number; title: string; type: string; targetValue: string; currentValueBefore: string; currentValueAfter: string;
  rewardStateBefore: string; rewardStateAfter: string; grantStatusBefore: "GRANTED" | null; grantStatusAfter: "REVERSED" | "GRANTED" | null;
  pointsToReverseExact: string; budgetSpentBefore: string; budgetSpentAfter: string;
};

export type RefundResponseDto = {
  refund: {
    id: number;
    status: RefundStatus;
    amountVnd: string;
    reason: string;
    requestedById: number;
    requestedAt: string;
    completedAt: string | null;
    providerReference: string | null;
  };
  order: OrderDto;
  walletImpact: WalletDescriptionDto | null;
};
