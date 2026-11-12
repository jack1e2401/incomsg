import type { MemberVoucherStatus, VoucherType } from "../../generated/prisma/client.js";
import type { describeWallet } from "../loyalty/loyalty.balance.js";

export interface DefinitionInput {
  type: VoucherType;
  title: string;
  pointsCost: number;
  discountAmount: string | null;
  rewardDescription: string | null;
  rewardProductId: number | null;
}
export type DefinitionPatch = Partial<Pick<DefinitionInput, "title" | "pointsCost" | "discountAmount" | "rewardDescription">> & { isActive?: boolean };
export interface DefinitionDto extends DefinitionInput {
  id: number;
  merchantId: number;
  isActive: boolean;
}
export interface MemberVoucherDto {
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

export interface RewardItemDto extends MemberVoucherDto {
  memberVoucherId: number;
  memberEmail: string;
  requestedAt: string;
  fulfilledAt: string | null;
  fulfilledById: number | null;
  note: string | null;
  cancelledAt: string | null;
  cancelledById: number | null;
  cancellationReason: string | null;
}

export interface CancelRewardResponseDto {
  reward: RewardItemDto;
  wallet: ReturnType<typeof describeWallet>;
  walletImpact: ReturnType<typeof describeWallet>;
}
