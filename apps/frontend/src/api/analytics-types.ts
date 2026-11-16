import type {
  LoyaltyConfigDto,
  MemberTier,
  MemberVoucherDto,
  OrderDto,
  WalletTransactionDto,
} from "./commerce-types";

export interface EnsureMembershipResponse {
  membership: {
    id: number;
    merchantId: number;
    memberId: number;
    tier: MemberTier;
    createdAt: string;
  };
  created: boolean;
}

export interface PaginationDto {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export type CustomerPurchaseStatus = "all" | "buyers" | "non_buyers";

export interface CustomerListQuery {
  q?: string;
  tier?: MemberTier | "";
  purchaseStatus?: CustomerPurchaseStatus;
  page?: number;
  limit?: number;
}

export interface CustomerSummaryDto {
  memberId: number;
  email: string;
  joinedAt: string;
  tier: MemberTier;
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

export interface CustomerListResponse {
  items: CustomerSummaryDto[];
  pagination: PaginationDto;
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

export interface CustomerDetailDto {
  member: {
    id: number;
    email: string;
    joinedAt: string;
  };
  stats: CustomerStatsDto;
  wallet: {
    merchantId: number;
    policy: LoyaltyConfigDto;
    exactBalance: string;
    availablePoints: number;
    fractionalCarry: string;
    pointDebt: string;
    netLifetimeEarned: string;
    lifetimeEarnedPoints: number;
    tier: MemberTier;
  };
  pointLedger: WalletTransactionDto[];
  vouchers: MemberVoucherDto[];
  orders: OrderDto[];
}

export interface CustomerDetailResponse {
  customer: CustomerDetailDto;
}

export type AnalyticsGranularity = "day" | "month";

export interface MerchantAnalyticsQuery {
  from?: string;
  to?: string;
  granularity?: AnalyticsGranularity;
}

export interface AnalyticsKpisDto {
  netRevenueVnd: string;
  paidOnlyRevenueVnd: string;
  refundPendingRevenueVnd: string;
  refundedRevenueVnd: string;
  paidOrderCount: number;
  refundPendingOrderCount: number;
  refundedOrderCount: number;
  averageOrderValueVnd: string;
  totalMembers: number;
  newMembers: number;
  returningCustomers: number;
}

export interface RevenueSeriesPointDto {
  bucket: string;
  label: string;
  revenueVnd: string;
  orderCount: number;
}

export interface TopProductDto {
  productId: number;
  productName: string;
  sku: string | null;
  unitsSold: number;
  revenueVnd: string;
}

export interface SlowMovingProductDto {
  productId: number;
  productName: string;
  sku: string | null;
  unitsSold: number;
  revenueVnd: string;
  availableQuantity: number;
}

export interface NoSalesProductDto {
  productId: number;
  productName: string;
  sku: string | null;
  availableQuantity: number;
  lastSoldAt: string | null;
}

export interface LowStockProductDto {
  productId: number;
  productName: string;
  sku: string | null;
  availableQuantity: number;
  lowStockThreshold: number;
}

export interface MerchantAnalyticsResponse {
  range: {
    from: string;
    to: string;
    granularity: AnalyticsGranularity;
    timezone: "Asia/Ho_Chi_Minh";
  };
  kpis: AnalyticsKpisDto;
  revenueSeries: RevenueSeriesPointDto[];
  topProducts: TopProductDto[];
  slowMovingProducts: SlowMovingProductDto[];
  noSales90DaysProducts: NoSalesProductDto[];
  lowStockProducts: LowStockProductDto[];
}
