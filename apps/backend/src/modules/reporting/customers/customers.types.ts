import type { MemberVoucherStatus, OrderStatus, PointTransactionSource, PointTransactionType, VoucherType } from "../../../generated/prisma/enums.js";
import type { TierLevel } from "../../loyalty/program/loyalty.calculation.js";
import type { OrderDto } from "../../commerce/orders/orders.types.js";

export type CustomerTier = TierLevel | "UNRANKED";
export type CustomerPurchaseStatus = "all" | "buyers" | "non_buyers";

export interface CustomerListQuery {
  q?: string;
  tier?: CustomerTier;
  purchaseStatus: CustomerPurchaseStatus;
  page: number;
  limit: number;
}

export interface CustomerSummaryDto {
  memberId: number;
  email: string;
  joinedAt: string;
  tier: CustomerTier;
  availablePoints: number;
  exactBalance: string;
  fractionalCarry: string;
  netLifetimeEarned: string;
  pointDebt: string;
  paidOrderCount: number;
  refundPendingOrderCount: number;
  refundPendingSpendVnd: string;
  netSpendVnd: string;
  lastPurchaseAt: string | null;
}

export interface PaginationDto {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface CustomerStatsDto {
  totalOrders: number;
  paidOrderCount: number;
  refundPendingOrderCount: number;
  refundedOrderCount: number;
  netSpendVnd: string;
  refundPendingSpendVnd: string;
  averageOrderValueVnd: string;
  lastPurchaseAt: string | null;
}

export interface CustomerPointLedgerItemDto {
  id: number;
  type: PointTransactionType;
  delta: string;
  balanceAfter: string;
  availablePointsAfter: number;
  fractionalCarryAfter: string;
  pointDebtAfter: string;
  reason: string;
  eventRef: string;
  source: PointTransactionSource;
  actorId: number | null;
  orderId: number | null;
  memberVoucherId: number | null;
  createdAt: string;
}

export interface CustomerVoucherItemDto {
  id: number;
  definitionId: number;
  merchantId: number;
  memberId: number;
  title: string;
  type: VoucherType;
  status: MemberVoucherStatus;
  reserved: boolean;
  pointsCost: number;
  discountAmount: string | null;
  rewardDescription: string | null;
  redeemedAt: string;
  usedAt: string | null;
}

export interface CustomerDetailDto {
  member: {
    id: number;
    email: string;
    joinedAt: string;
  };
  stats: CustomerStatsDto;
  wallet: {
    merchantId: number;
    policy: {
      merchantId: number;
      vndPerPoint: number;
      isActive: boolean;
      tiers: { level: TierLevel; minLifetimePoints: number; multiplier: string }[];
    };
    exactBalance: string;
    availablePoints: number;
    fractionalCarry: string;
    pointDebt: string;
    netLifetimeEarned: string;
    lifetimeEarnedPoints: number;
    tier: CustomerTier;
  };
  pointLedger: CustomerPointLedgerItemDto[];
  vouchers: CustomerVoucherItemDto[];
  orders: OrderDto[];
}

export interface CustomerOrderAggregateInput {
  status: OrderStatus;
  total: string | number;
  paidAt: Date | null;
}
