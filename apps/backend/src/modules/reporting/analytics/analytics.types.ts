export type AnalyticsGranularity = "day" | "month";

export interface AnalyticsRange {
  from: string;
  to: string;
  granularity: AnalyticsGranularity;
  timezone: "Asia/Ho_Chi_Minh";
  startAt: Date;
  endExclusive: Date;
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

export interface MerchantAnalyticsDto {
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
