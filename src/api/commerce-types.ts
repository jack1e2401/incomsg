import type { BackendMerchantDto } from "./contracts/milestone2";

/** Exact JSON DTOs returned by the implemented backend commerce routes. */
export type ProductStatus = "ACTIVE" | "HIDDEN";
export type OrderStatus = "PENDING" | "PAID";
export type TierLevel = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
export type VoucherType = "DISCOUNT" | "REWARD";
export type MemberVoucherStatus = "AVAILABLE" | "USED" | "FULFILLED";
export type MemberTier = TierLevel | "UNRANKED";

export interface ProductDto {
  id: number;
  merchantId: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: string;
  status: ProductStatus;
}

export interface ProductInput {
  name: string;
  price: string;
  description?: string | null;
  imageUrl?: string | null;
}

export type ProductPatch = Partial<ProductInput> & { status?: ProductStatus };

export interface OrderItemDto {
  productId: number;
  productName: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
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
}

export interface CreateOrderInput {
  productId: number;
  quantity: number;
  voucherId?: number;
}

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
  isActive: boolean;
}

export interface VoucherDefinitionInput {
  type: VoucherType;
  title: string;
  pointsCost: number;
  discountAmount: string | null;
  rewardDescription: string | null;
}

export type VoucherDefinitionPatch = Partial<
  Pick<VoucherDefinitionInput, "title" | "pointsCost" | "discountAmount" | "rewardDescription">
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
}

export type PointTransactionType = "EARN" | "REDEEM_DISCOUNT" | "REDEEM_REWARD";

export interface WalletTransactionDto {
  id: number;
  type: PointTransactionType;
  delta: number;
  balanceAfter: number;
  reason: string;
  orderId: number | null;
  memberVoucherId: number | null;
  createdAt: string;
}

export interface WalletDto {
  merchantId: number;
  availablePoints: number;
  lifetimeEarnedPoints: number;
  tier: MemberTier;
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
