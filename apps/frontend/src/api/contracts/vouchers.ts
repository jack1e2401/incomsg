import type { WalletDto } from "./loyalty";

export type VoucherType = "DISCOUNT" | "REWARD";

export type MemberVoucherStatus =
  "AVAILABLE" | "RESERVED" | "USED" | "PENDING_FULFILLMENT" | "FULFILLED" | "CANCELLED";

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
  availableQuantity: number | null;
  issuedQuantity: number | null;
}

export type VoucherDefinitionInput = {
  title: string;
  pointsCost: number;
} & (
  | { type: "DISCOUNT"; discountAmount: string; initialQuantity: number; rewardDescription?: null }
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
