import { requestJson, translateApiError } from "./commerce/shared";
import type {
  CreateChallengeInput,
  ListMerchantChallengesParams,
  MemberCheckinResponse,
  MemberStoreChallengeDetailResponse,
  MemberStoreChallengesResponse,
  MerchantChallengeDetailResponse,
  MerchantChallengeMutationResponse,
  MerchantChallengesListResponse,
  PublicStoreChallengeDetailResponse,
  PublicStoreChallengesResponse,
  UpdateChallengeInput,
} from "./challenges-types";

export function translateChallengeError(code: string): string {
  const translations: Record<string, string> = {
    CHALLENGE_NOT_FOUND: "Không tìm thấy nhiệm vụ.",
    CHALLENGE_LOCKED_FIELDS: "Không thể sửa loại nhiệm vụ, mục tiêu, điểm thưởng hoặc ngày bắt đầu sau khi đã kích hoạt.",
    CHALLENGE_FIELDS_LOCKED: "Không thể sửa loại nhiệm vụ, mục tiêu, điểm thưởng hoặc ngày bắt đầu sau khi đã kích hoạt.",
    CHALLENGE_INVALID_BUDGET: "Ngân sách tổng phải lớn hơn hoặc bằng tổng điểm đã phát.",
    CHALLENGE_INSUFFICIENT_BUDGET_TO_ACTIVATE: "Ngân sách phải lớn hơn hoặc bằng điểm thưởng để kích hoạt.",
    INVALID_CHALLENGE_CONFIGURATION: "Cấu hình nhiệm vụ chưa hợp lệ hoặc ngân sách thấp hơn điểm thưởng.",
    CHALLENGE_INVALID_DATE_RANGE: "Ngày kết thúc phải lớn hơn ngày bắt đầu.",
    CHALLENGE_HAS_PROGRESS: "Không thể xóa nhiệm vụ đã phát sinh tiến trình hoặc giao dịch. Hãy lưu trữ.",
    CHALLENGE_NOT_ACTIVE: "Nhiệm vụ hiện không hoạt động.",
    STORE_NOT_FOUND: "Không tìm thấy cửa hàng hoặc cửa hàng đã tạm ngưng.",
    INVALID_INPUT: "Thông tin nhiệm vụ chưa hợp lệ. Vui lòng kiểm tra lại.",
  };
  return translations[code] ?? translateApiError(code);
}

export function createChallengesClient(
  baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000",
  fetcher: typeof fetch = fetch,
) {
  return {
    listMerchantChallenges(params: ListMerchantChallengesParams = {}, token: string) {
      const search = new URLSearchParams();
      if (params.status) search.set("status", params.status);
      if (params.type) search.set("type", params.type);
      if (params.q?.trim()) search.set("q", params.q.trim());
      if (params.page) search.set("page", String(params.page));
      if (params.limit) search.set("limit", String(params.limit));
      const qs = search.toString();
      return requestJson<MerchantChallengesListResponse>(
        fetcher,
        baseUrl,
        `/api/merchant/challenges${qs ? `?${qs}` : ""}`,
        { token },
      );
    },

    createMerchantChallenge(input: CreateChallengeInput, token: string) {
      return requestJson<MerchantChallengeMutationResponse>(fetcher, baseUrl, "/api/merchant/challenges", {
        method: "POST",
        body: input,
        token,
      });
    },

    getMerchantChallenge(challengeId: number, token: string, page = 1, limit = 20) {
      return requestJson<MerchantChallengeDetailResponse>(
        fetcher,
        baseUrl,
        `/api/merchant/challenges/${challengeId}?page=${page}&limit=${limit}`,
        { token },
      );
    },

    updateMerchantChallenge(challengeId: number, patch: UpdateChallengeInput, token: string) {
      return requestJson<MerchantChallengeMutationResponse>(
        fetcher,
        baseUrl,
        `/api/merchant/challenges/${challengeId}`,
        { method: "PATCH", body: patch, token },
      );
    },

    activateMerchantChallenge(challengeId: number, token: string) {
      return requestJson<MerchantChallengeMutationResponse>(
        fetcher,
        baseUrl,
        `/api/merchant/challenges/${challengeId}/activate`,
        { method: "POST", token },
      );
    },

    pauseMerchantChallenge(challengeId: number, token: string) {
      return requestJson<MerchantChallengeMutationResponse>(
        fetcher,
        baseUrl,
        `/api/merchant/challenges/${challengeId}/pause`,
        { method: "POST", token },
      );
    },

    archiveMerchantChallenge(challengeId: number, token: string) {
      return requestJson<MerchantChallengeMutationResponse>(
        fetcher,
        baseUrl,
        `/api/merchant/challenges/${challengeId}/archive`,
        { method: "POST", token },
      );
    },

    deleteMerchantChallenge(challengeId: number, token: string) {
      return requestJson<{ deleted: true }>(fetcher, baseUrl, `/api/merchant/challenges/${challengeId}`, {
        method: "DELETE",
        token,
      });
    },

    listPublicStoreChallenges(slug: string) {
      return requestJson<PublicStoreChallengesResponse>(
        fetcher,
        baseUrl,
        `/api/public/stores/${encodeURIComponent(slug)}/challenges`,
      );
    },

    getPublicStoreChallenge(slug: string, challengeId: number) {
      return requestJson<PublicStoreChallengeDetailResponse>(
        fetcher,
        baseUrl,
        `/api/public/stores/${encodeURIComponent(slug)}/challenges/${challengeId}`,
      );
    },

    listMemberStoreChallenges(slug: string, token: string) {
      return requestJson<MemberStoreChallengesResponse>(
        fetcher,
        baseUrl,
        `/api/member/stores/${encodeURIComponent(slug)}/challenges`,
        { token },
      );
    },

    getMemberStoreChallenge(slug: string, challengeId: number, token: string) {
      return requestJson<MemberStoreChallengeDetailResponse>(
        fetcher,
        baseUrl,
        `/api/member/stores/${encodeURIComponent(slug)}/challenges/${challengeId}`,
        { token },
      );
    },

    checkInStore(slug: string, token: string) {
      return requestJson<MemberCheckinResponse>(
        fetcher,
        baseUrl,
        `/api/member/stores/${encodeURIComponent(slug)}/check-in`,
        { method: "POST", token },
      );
    },
  };
}
