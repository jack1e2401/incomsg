import type {
  AppliedLoyaltyPolicySnapshot,
  MemberTier,
  TierLevel,
  WalletDto,
  WalletTransactionDto,
} from "./loyalty";

export type OrderStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUND_PENDING" | "REFUNDED";

export type PaymentAttemptStatus = "CREATED" | "SUCCEEDED" | "FAILED";

export type RefundStatus = "PENDING_PROVIDER" | "COMPLETED" | "FAILED";

export interface OrderItemDto {
  productId: number;
  productName: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
}

export interface OrderActionsDto {
  canCancel: boolean;
  canRefund: boolean;
  canRequestRefund?: boolean;
  requiresReconciliation: boolean;
}

export interface OrderRefundRequestSummaryDto {
  id: number;
  status:
    | "PENDING_MERCHANT"
    | "PENDING_ADMIN"
    | "REJECTED"
    | "APPROVED"
    | "PROCESSING"
    | "COMPLETED"
    | "FAILED";
  reason: string;
  merchantDecisionReason: string | null;
  adminDecisionReason: string | null;
  requestedAt: string;
}

export interface OrderDto {
  id: number;
  merchantId: number;
  memberId: number;
  status: OrderStatus;
  subtotal: string;
  discountAmount: string;
  total: string;
  paidAt: string | null;
  stockReservedUntil?: string | null;
  appliedLoyaltyPolicy?: AppliedLoyaltyPolicySnapshot | null;
  items: OrderItemDto[];
  earnedPoints?: number | null;
  earnedPointsExact: string | null;
  promotedToTier?: TierLevel | null;
  paymentStatus?: PaymentAttemptStatus | null;
  refundStatus?: RefundStatus | string | null;
  refundRequest?: OrderRefundRequestSummaryDto | null;
  loyaltyEvents?: WalletTransactionDto[];
  actions?: OrderActionsDto;
}

export type PaymentStatusDto = {
  orderStatus: OrderStatus;
  paymentStatus: "CREATED" | "SUCCEEDED" | "FAILED" | null;
};

export type VnpayPaymentResponse =
  { orderId: number; paymentUrl: string; txnRef: string } | { orderId: number; orderStatus: "PAID" };

export type OrdersResponse = { orders: OrderDto[] };

export type MerchantOrdersResponse = { orders: (OrderDto & { memberEmail?: string })[] };

interface OrderLineInput {
  productId: number;
  quantity: number;
}

export type CreateOrderInput = (OrderLineInput | { items: OrderLineInput[] }) & { voucherId?: number };

export type OrderResponse = { order: OrderDto };

export interface CancelOrderResponse {
  order: OrderDto;
  voucherReleased?: boolean;
  capacityReleasedExact?: string;
}

export interface RefundPreviewDto {
  orderId: number;
  refundAmountVnd: string;
  refundStatus: string | null;
  earningReversalExact: string;
  walletBefore: Partial<WalletDto>;
  walletAfter: Partial<WalletDto>;
  tierBefore: MemberTier;
  tierAfter: MemberTier;
  discountVoucherRestorable: boolean;
  providerConfirmationRequired: boolean;
}

export interface RefundDto {
  id: number;
  status: string;
  amountVnd: string;
  reason: string;
  requestedById: number;
  requestedAt: string;
  completedAt: string | null;
  providerReference: string | null;
}

export interface RefundResponseDto {
  refund: RefundDto;
  order: OrderDto;
  walletImpact: unknown;
}
