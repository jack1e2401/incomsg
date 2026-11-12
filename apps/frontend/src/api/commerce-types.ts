import type { BackendMerchantDto } from "./contracts/milestone2";

/** Exact JSON DTOs returned by the implemented backend commerce routes. */
export type ProductKind = "SALE" | "REWARD";
export type ProductStatus = "ACTIVE" | "HIDDEN";
export type OrderStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUND_PENDING" | "REFUNDED";
export type PaymentAttemptStatus = "CREATED" | "SUCCEEDED" | "FAILED";
export type RefundStatus = "PENDING_PROVIDER" | "COMPLETED" | "FAILED";
export type TierLevel = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
export type VoucherType = "DISCOUNT" | "REWARD";
export type MemberVoucherStatus =
  "AVAILABLE" | "RESERVED" | "USED" | "PENDING_FULFILLMENT" | "FULFILLED" | "CANCELLED";
export type MemberTier = TierLevel | "UNRANKED";

export interface ProductDto {
  id: number;
  merchantId: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  kind: ProductKind;
  price: string;
  status: ProductStatus;
}

interface ProductFields {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
}

export type ProductInput = ProductFields &
  ({ kind?: "SALE"; price: string } | { kind: "REWARD"; price?: never });

export type ProductPatch = Partial<ProductFields> & { price?: string; status?: ProductStatus };

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
  requiresReconciliation: boolean;
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
  items: OrderItemDto[];
  earnedPoints?: number | null;
  earnedPointsExact: string | null;
  promotedToTier?: TierLevel | null;
  paymentStatus?: PaymentAttemptStatus | null;
  refundStatus?: RefundStatus | string | null;
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
export type MerchantDirectoryResponse = {
  merchants: { id: number; name: string; slug: string; isActive?: boolean }[];
};
export type AdminDashboardResponse = {
  stats: { merchants: number; pendingApplications: number; paidOrders: number; totalVolume: string | number };
};

interface OrderLineInput {
  productId: number;
  quantity: number;
}

export type CreateOrderInput = (OrderLineInput | { items: OrderLineInput[] }) & { voucherId?: number };

export interface LoyaltyTierDto {
  level: TierLevel;
  minLifetimePoints: number;
  multiplier: string;
}

export interface LoyaltyConfigDto {
  merchantId: number;
  vndPerPoint: number;
  isActive: boolean;
  tiers: LoyaltyTierDto[];
}

export interface LoyaltyConfigInput {
  vndPerPoint: number;
  isActive: boolean;
  tiers: LoyaltyTierDto[];
}

export interface VoucherDefinitionDto {
  id: number;
  merchantId: number;
  type: VoucherType;
  title: string;
  pointsCost: number;
  discountAmount: string | null;
  rewardDescription: string | null;
  rewardProductId: number | null;
  isActive: boolean;
}

export type VoucherDefinitionInput = {
  title: string;
  pointsCost: number;
} & (
  | { type: "DISCOUNT"; discountAmount: string; rewardDescription?: null }
  | { type: "REWARD"; discountAmount: null; rewardProductId: number }
);

export type VoucherDefinitionPatch = Partial<
  Pick<VoucherDefinitionDto, "title" | "pointsCost" | "discountAmount" | "rewardDescription">
> & { isActive?: boolean };

export interface MemberVoucherDto {
  id: number;
  definitionId: number;
  merchantId: number;
  memberId: number;
  title: string;
  type: VoucherType;
  status: MemberVoucherStatus;
  pointsCost: number;
  discountAmount: string | null;
  rewardDescription: string | null;
  redeemedAt: string;
  usedAt: string | null;
  reserved?: boolean;
  memberEmail?: string | null;
  fulfilledAt?: string | null;
  fulfilledById?: number | null;
  note?: string | null;
  cancelledAt?: string | null;
  cancelledById?: number | null;
  cancellationReason?: string | null;
}

export type PointTransactionType =
  | "EARN"
  | "REDEEM_DISCOUNT"
  | "REDEEM_REWARD"
  | "EARN_REVERSAL"
  | "REDEMPTION_REVERSAL"
  | "ADMIN_ADJUSTMENT"
  | "LEGACY_BACKFILL";

export interface WalletTransactionDto {
  id: number;
  eventRef?: string;
  type: PointTransactionType;
  delta: string;
  balanceAfter: string;
  availablePointsAfter: number;
  fractionalCarryAfter: string;
  pointDebtAfter: string;
  reason: string;
  source?: string;
  actorId?: number | null;
  orderId: number | null;
  memberVoucherId: number | null;
  createdAt: string;
}

export interface WalletDto {
  merchantId: number;
  availablePoints: number;
  exactBalance: string;
  fractionalCarry: string;
  pointDebt: string;
  netLifetimeEarned: string;
  lifetimeEarnedPoints: number;
  tier: MemberTier;
  policy?: LoyaltyConfigDto;
  transactions: WalletTransactionDto[];
}

export type OwnMerchantResponse = { merchant: BackendMerchantDto };
export type ProductsResponse = { products: ProductDto[] };
export type ProductResponse = { product: ProductDto };
export type OrderResponse = { order: OrderDto };
export type LoyaltyConfigResponse = { config: LoyaltyConfigDto };
export type VoucherDefinitionsResponse = { definitions: VoucherDefinitionDto[] };
export type VoucherDefinitionResponse = { definition: VoucherDefinitionDto };
export type MemberVouchersResponse = { vouchers: MemberVoucherDto[] };
export type MemberVoucherResponse = {
  voucher: MemberVoucherDto;
  wallet: Pick<WalletDto, "availablePoints" | "lifetimeEarnedPoints">;
};
export type MerchantRewardsResponse = { rewards: MemberVoucherDto[] };
export type MerchantRewardResponse = { reward: MemberVoucherDto };
export type FulfillRewardInput = { note?: string };
export type WalletResponse = { wallet: WalletDto };

export interface CancelOrderResponse {
  order: OrderDto;
  voucherReleased?: boolean;
  capacityReleasedExact?: string;
}

export interface MemberEarningPreviewResponse {
  merchantId: number;
  active: boolean;
  netOrderAmountVnd: string;
  tierLevel: MemberTier;
  multiplier: string;
  vndPerPoint: number;
  estimatedPointsExact: string;
  policyUpdatedAt?: string;
}

export interface MerchantLoyaltyPreviewInput {
  netOrderAmountVnd: string;
  tierLevel?: TierLevel;
}

export interface MerchantLoyaltyPreviewResponse {
  netOrderAmountVnd: string;
  tierLevel: MemberTier;
  multiplier: string;
  vndPerPoint: number;
  active: boolean;
  estimatedPointsExact: string;
  integerProjection: number;
  fractionalProjection: string;
  rounding: "HALF_UP" | string;
  scale: number;
}

export interface MerchantLedgerItemDto extends WalletTransactionDto {
  memberId: number;
  memberEmail?: string | null;
  orderSummary?: { id: number; total: string; status: string } | null;
  voucherSummary?: { id: number; title: string; type: string } | null;
}

export interface MerchantTransactionsResponse {
  items: MerchantLedgerItemDto[];
  nextCursor: string | null;
}

export interface MerchantTransactionsQuery {
  memberId?: number;
  orderId?: number;
  type?: PointTransactionType;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
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

export interface RewardQueueItemDto {
  memberVoucherId: number;
  status: MemberVoucherStatus;
  memberId: number;
  memberEmail?: string | null;
  title: string;
  pointsCost: number;
  requestedAt: string;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  fulfilledById: number | null;
  cancelledById: number | null;
  note: string | null;
  cancellationReason: string | null;
}

export interface RewardCancelResponseDto {
  reward: RewardQueueItemDto | MemberVoucherDto;
  wallet?: WalletDto;
}
