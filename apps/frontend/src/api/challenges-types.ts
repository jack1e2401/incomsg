export type ChallengeType = "ORDER_COUNT" | "DAILY_CHECKIN" | "SPEND_TOTAL";
export type ChallengeStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
export type ChallengeEffectiveStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ENDED" | "ARCHIVED";
export type ChallengeRewardState = "IN_PROGRESS" | "WAITING_BUDGET" | "REWARDED";
export type ChallengeRewardGrantStatus = "GRANTED" | "REVERSED";
export type MemberActivityType = "ORDER_PAID" | "DAILY_CHECKIN" | "ORDER_REFUNDED";

export interface ChallengePaginationDto {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface MerchantChallengeDto {
  id: number;
  merchantId: number;
  title: string;
  description: string;
  type: ChallengeType;
  status: ChallengeStatus;
  effectiveStatus: ChallengeEffectiveStatus;
  targetValue: string;
  rewardPoints: string;
  budgetTotal: string;
  budgetSpent: string;
  budgetRemaining: string;
  startsAt: string;
  endsAt: string;
  isFeatured: boolean;
  hasProgress: boolean;
  lockedFields: boolean;
  inProgressCount: number;
  completedCount: number;
  waitingBudgetCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChallengeParticipantDto {
  progressId: number;
  membershipId: number;
  memberId: number;
  memberEmail: string;
  currentValue: string;
  targetValue: string;
  rewardState: ChallengeRewardState;
  rewardCycle: number;
  completedAt: string | null;
  updatedAt: string;
}

export interface ChallengeGrantHistoryDto {
  id: number;
  progressId: number;
  memberId: number;
  memberEmail: string;
  cycle: number;
  status: ChallengeRewardGrantStatus;
  pointsGranted: string;
  earnTransactionId: number;
  reversalTransactionId: number | null;
  grantedAt: string;
  reversedAt: string | null;
}

export interface MerchantChallengesListResponse {
  items: MerchantChallengeDto[];
  pagination: ChallengePaginationDto;
}

export interface MerchantChallengeDetailResponse {
  challenge: MerchantChallengeDto;
  participants: {
    items: ChallengeParticipantDto[];
    pagination: ChallengePaginationDto;
  };
  recentGrants: ChallengeGrantHistoryDto[];
}

export interface MerchantChallengeMutationResponse {
  challenge: MerchantChallengeDto;
  replenishedCount?: number;
}

export interface CreateChallengeInput {
  title: string;
  description: string;
  type: ChallengeType;
  targetValue: string | number;
  rewardPoints: string | number;
  budgetTotal: string | number;
  startsAt: string;
  endsAt: string;
  isFeatured?: boolean;
  status?: "DRAFT" | "ACTIVE";
}

export interface UpdateChallengeInput {
  title?: string;
  description?: string;
  type?: ChallengeType;
  targetValue?: string | number;
  rewardPoints?: string | number;
  budgetTotal?: string | number;
  startsAt?: string;
  endsAt?: string;
  isFeatured?: boolean;
}

export interface ListMerchantChallengesParams {
  status?: ChallengeEffectiveStatus | "";
  type?: ChallengeType | "";
  q?: string;
  page?: number;
  limit?: number;
}

export interface ChallengeProgressDto {
  currentValue: string;
  targetValue: string;
  remainingValue: string;
  percent: number;
  rewardState: ChallengeRewardState;
  rewardCycle: number;
  completedAt: string | null;
  grantedAt: string | null;
}

export interface PublicChallengeDto {
  id: number;
  merchantId: number;
  title: string;
  description: string;
  type: ChallengeType;
  effectiveStatus: ChallengeEffectiveStatus;
  targetValue: string;
  rewardPoints: string;
  startsAt: string;
  endsAt: string;
  isFeatured: boolean;
}

export interface MemberChallengeDto extends PublicChallengeDto {
  progress: ChallengeProgressDto | null;
}

export interface StoreSummaryDto {
  id: number;
  name: string;
  slug: string;
}

export interface PublicStoreChallengesResponse {
  merchant: StoreSummaryDto;
  heroChallenge: PublicChallengeDto | null;
  challenges: PublicChallengeDto[];
}

export interface PublicStoreChallengeDetailResponse {
  merchant: StoreSummaryDto;
  challenge: PublicChallengeDto;
}

export interface MemberStoreChallengesResponse {
  merchant: StoreSummaryDto;
  checkedInToday: boolean;
  todayDateKey: string;
  heroChallenge: MemberChallengeDto | null;
  challenges: MemberChallengeDto[];
}

export interface ChallengeEntryDto {
  id: number;
  activityType: MemberActivityType;
  deltaValue: string;
  orderId: number | null;
  occurredAt: string;
}

export interface MemberStoreChallengeDetailResponse {
  merchant: StoreSummaryDto;
  checkedInToday: boolean;
  todayDateKey: string;
  challenge: MemberChallengeDto;
  recentEntries: ChallengeEntryDto[];
}

export interface MemberCheckinResponse {
  checkedIn: boolean;
  alreadyCheckedInToday: boolean;
  dateKey: string;
  updatedChallenges: Array<{
    challengeId: number;
    title: string;
    currentValue: string;
    targetValue: string;
    rewardState: ChallengeRewardState;
    pointsAwardedExact: string | null;
  }>;
}
