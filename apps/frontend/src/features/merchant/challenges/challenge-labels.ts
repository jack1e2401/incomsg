import type {
  ChallengeEffectiveStatus,
  ChallengeRewardGrantStatus,
  ChallengeRewardState,
  ChallengeType,
} from "../../../api/challenges-types";

const typeLabels: Record<ChallengeType, string> = {
  ORDER_COUNT: "Số đơn hàng",
  DAILY_CHECKIN: "Điểm danh hằng ngày",
  SPEND_TOTAL: "Tổng chi tiêu",
};

const statusLabels: Record<ChallengeEffectiveStatus, string> = {
  DRAFT: "Bản nháp",
  ACTIVE: "Đang hoạt động",
  PAUSED: "Tạm dừng",
  ENDED: "Đã kết thúc",
  ARCHIVED: "Đã lưu trữ",
};

const rewardStateLabels: Record<ChallengeRewardState, string> = {
  IN_PROGRESS: "Đang thực hiện",
  WAITING_BUDGET: "Chờ ngân sách",
  REWARDED: "Đã nhận thưởng",
};

const grantStatusLabels: Record<ChallengeRewardGrantStatus, string> = {
  GRANTED: "Đã phát",
  REVERSED: "Đã thu hồi",
};

export const challengeTypeLabel = (type: ChallengeType) => typeLabels[type];
export const challengeStatusLabel = (status: ChallengeEffectiveStatus) => statusLabels[status];
export const challengeRewardStateLabel = (state: ChallengeRewardState) => rewardStateLabels[state];
export const challengeGrantStatusLabel = (status: ChallengeRewardGrantStatus) => grantStatusLabels[status];
