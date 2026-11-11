export type Tier = "Unranked" | "Bronze" | "Silver" | "Gold" | "Platinum";
export type MerchantStatus = "PENDING" | "APPROVED" | "REJECTED";
export type OrderStatus = "PENDING" | "PAID";
export type VoucherKind = "DISCOUNT" | "REWARD";

export interface Merchant {
  id: string;
  name: string;
  tagline: string;
  category: string;
  description: string;
  location: string;
  status: MerchantStatus;
  color: string;
  initials: string;
}

export interface Application {
  id: string;
  merchantId: string;
  owner: string;
  email: string;
  submittedAt: string;
  status: MerchantStatus;
  note: string;
}

export interface Product {
  id: string;
  merchantId: string;
  name: string;
  category: string;
  description: string;
  price: number;
  stock: number;
  active: boolean;
  image: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  merchantId: string;
  memberId: string;
  memberName: string;
  createdAt: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  status: OrderStatus;
  earnedPoints: number;
  voucherId?: string;
}

export interface PointTransaction {
  id: string;
  reason: string;
  amount: number;
  date: string;
  reference: string;
}

export interface Wallet {
  merchantId: string;
  availablePoints: number;
  lifetimeEarnedPoints: number;
  tier: Tier;
  transactions: PointTransaction[];
}

export interface VoucherDefinition {
  id: string;
  merchantId: string;
  title: string;
  description: string;
  kind: VoucherKind;
  pointsCost: number;
  discountAmount?: number;
  active: boolean;
  icon: string;
}

export interface MemberVoucher {
  id: string;
  definitionId: string;
  merchantId: string;
  memberId: string;
  title: string;
  kind: VoucherKind;
  status: "AVAILABLE" | "USED" | "PENDING_FULFILLMENT" | "FULFILLED";
  issuedAt: string;
}

export interface LoyaltyConfig {
  merchantId: string;
  baseAmount: number;
  tiers: {
    tier: Exclude<Tier, "Unranked">;
    threshold: number;
    multiplier: number;
  }[];
}

export interface DashboardStats {
  merchants: number;
  pendingApplications: number;
  paidOrders: number;
  totalVolume: number;
}

export interface CheckoutInput {
  merchantId: string;
  items: { productId: string; quantity: number }[];
  voucherId?: string;
}

export interface CommerceApi {
  mode: "mock" | "http";
  listMerchants(): Promise<Merchant[]>;
  getMerchant(id: string): Promise<Merchant>;
  updateMerchant(
    id: string,
    changes: Partial<Pick<Merchant, "name" | "tagline" | "description" | "location">>,
  ): Promise<Merchant>;
  listApplications(): Promise<Application[]>;
  approveApplication(id: string): Promise<Application>;
  rejectApplication(id: string): Promise<Application>;
  canManageMerchant(id: string): Promise<boolean>;
  getDashboardStats(): Promise<DashboardStats>;
  listProducts(merchantId: string): Promise<Product[]>;
  saveProduct(product: Partial<Product> & Pick<Product, "merchantId" | "name" | "price">): Promise<Product>;
  toggleProduct(id: string, merchantId: string): Promise<Product>;
  listOrders(merchantId?: string): Promise<Order[]>;
  listMemberOrders(merchantId: string): Promise<Order[]>;
  createOrder(input: CheckoutInput): Promise<Order>;
  getWallet(merchantId: string): Promise<Wallet>;
  getLoyaltyConfig(merchantId: string): Promise<LoyaltyConfig>;
  saveLoyaltyConfig(config: LoyaltyConfig): Promise<LoyaltyConfig>;
  listVoucherDefinitions(merchantId: string): Promise<VoucherDefinition[]>;
  saveVoucherDefinition(
    input: Partial<VoucherDefinition> &
      Pick<VoucherDefinition, "merchantId" | "title" | "kind" | "pointsCost">,
  ): Promise<VoucherDefinition>;
  toggleVoucherDefinition(id: string, merchantId: string): Promise<VoucherDefinition>;
  listMemberVouchers(merchantId: string): Promise<MemberVoucher[]>;
  redeemVoucher(
    definitionId: string,
    merchantId: string,
  ): Promise<{ voucher: MemberVoucher; wallet: Wallet }>;
  listRewardFulfillments(merchantId: string): Promise<MemberVoucher[]>;
  fulfillReward(memberVoucherId: string, merchantId: string): Promise<MemberVoucher>;
}
