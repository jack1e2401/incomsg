import type { OrderDto, RefundDto, RefundPreviewDto } from "./contracts/orders";
import type { ChallengeRewardGrantStatus, ChallengeRewardState, ChallengeType } from "./challenges-types";

export type RefundRequestStatus =
  | "PENDING_MERCHANT"
  | "PENDING_ADMIN"
  | "REJECTED"
  | "APPROVED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export interface ChallengeRefundImpactDto {
  challengeId: number;
  title: string;
  type: ChallengeType;
  targetValue: string;
  currentValueBefore: string;
  currentValueAfter: string;
  rewardStateBefore: ChallengeRewardState;
  rewardStateAfter: ChallengeRewardState;
  grantStatusBefore: ChallengeRewardGrantStatus | null;
  grantStatusAfter: ChallengeRewardGrantStatus | null;
  pointsToReverseExact: string;
  budgetSpentBefore: string;
  budgetSpentAfter: string;
}

export interface ExtendedRefundPreviewDto extends RefundPreviewDto {
  challenges?: ChallengeRefundImpactDto[];
}

export interface RefundRequestDto {
  id: number;
  orderId: number;
  memberId: number;
  merchantId: number;
  reason: string;
  status: RefundRequestStatus;
  requestedAt: string;
  merchantReviewedById: number | null;
  merchantReviewedAt: string | null;
  merchantDecisionReason: string | null;
  adminReviewedById: number | null;
  adminReviewedAt: string | null;
  adminDecisionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RefundRequestListItemDto extends RefundRequestDto {
  orderTotalVnd: string;
  orderStatus: OrderDto["status"];
  memberEmail: string;
  merchantName?: string;
  merchantSlug?: string;
}

export interface RefundRequestPaginationDto {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface RefundRequestListResponse {
  items: RefundRequestListItemDto[];
  pagination: RefundRequestPaginationDto;
}

export interface RefundRequestDetailResponse {
  refundRequest: RefundRequestDto;
  order: OrderDto;
  merchant?: { id: number; name: string; slug: string };
  member?: { id: number; email: string };
  preview: ExtendedRefundPreviewDto;
}

export interface AdminApproveRefundResponse {
  refundRequest: RefundRequestDto;
  refund: RefundDto;
  order: OrderDto;
  walletImpact: unknown;
  challengeReversals: ChallengeRefundImpactDto[];
}

export interface ListRefundRequestsParams {
  status?: RefundRequestStatus | "";
  page?: number;
  limit?: number;
}
