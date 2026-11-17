export type MerchantFinanceTierLevel = "BRONZE" | "SILVER" | "GOLD";

export interface MerchantFinanceTier {
  level: MerchantFinanceTierLevel;
  year: number;
  feeRate: string;
  revenueVnd: string;
  nextTier: MerchantFinanceTierLevel | null;
  nextThresholdVnd: string | null;
  lastEvaluatedAt: string | null;
}

export interface PlatformFeeSummary {
  chargedVnd: string;
  reversedVnd: string;
  netVnd: string;
}

export type AdminFinancePeriod = "7d" | "30d" | "year";

export interface AdminFinanceReport {
  from: string;
  to: string;
  granularity: "day" | "month";
  summary: PlatformFeeSummary;
  series: { bucket: string; netVnd: string }[];
  merchants: (PlatformFeeSummary & {
    id: number;
    name: string;
    isActive: boolean;
    revenueVnd: string;
    feeCount: number;
    unrecordedOrderCount: number;
  })[];
}

export type PlatformFeeType = "FEE_CHARGE" | "FEE_REVERSAL";

export interface PlatformFeeItem {
  id: number;
  merchantId: number;
  orderId: number;
  type: PlatformFeeType;
  amountVnd: string;
  tier: MerchantFinanceTierLevel;
  feeRate: string;
  orderTotalVnd: string;
  createdAt: string;
  eventRef: string;
}

export interface PlatformFeeFilters {
  from?: string;
  to?: string;
  type?: PlatformFeeType;
  orderId?: number;
  cursor?: number;
}

export interface MerchantFinanceResponse {
  tier: MerchantFinanceTier;
  summary: PlatformFeeSummary;
  sales: { orderNetVnd: string; merchantReceivesVnd: string };
  items: PlatformFeeItem[];
  nextCursor: number | null;
}
