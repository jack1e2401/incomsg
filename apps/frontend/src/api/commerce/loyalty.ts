import type {
  LoyaltyConfigInput,
  LoyaltyConfigResponse,
  WalletResponse,
  MemberEarningPreviewResponse,
  MerchantLoyaltyPreviewInput,
  MerchantLoyaltyPreviewResponse,
  MerchantTransactionsResponse,
  MerchantTransactionsQuery,
  MerchantLoyaltyMembersResponse,
  MerchantLoyaltyMemberWalletResponse,
  MerchantLoyaltyHistoryResponse,
} from "../contracts/loyalty";
import { requestJson } from "./shared";

export function createLoyaltyClient(baseUrl = "", fetcher: typeof fetch = fetch) {
  return {
    getLoyaltyConfig(token: string) {
      return requestJson<LoyaltyConfigResponse>(fetcher, baseUrl, "/api/merchant/loyalty", { token });
    },
    putLoyaltyConfig(input: LoyaltyConfigInput, token: string) {
      return requestJson<LoyaltyConfigResponse>(fetcher, baseUrl, "/api/merchant/loyalty", {
        method: "PUT",
        token,
        body: input,
      });
    },
    getLoyaltyPolicyHistory(token: string) {
      return requestJson<MerchantLoyaltyHistoryResponse>(fetcher, baseUrl, "/api/merchant/loyalty/history", {
        token,
      });
    },
    getMemberWallet(merchantId: number, token: string) {
      return requestJson<WalletResponse>(fetcher, baseUrl, `/api/member/merchants/${merchantId}/wallet`, {
        token,
      });
    },
    listMerchantLoyaltyMembers(filters: { email: string; cursor: number | null }, token: string) {
      const params = new URLSearchParams();
      if (filters.email) params.set("email", filters.email);
      if (filters.cursor !== null) params.set("cursor", String(filters.cursor));
      const query = params.toString();
      return requestJson<MerchantLoyaltyMembersResponse>(
        fetcher,
        baseUrl,
        `/api/merchant/loyalty/members${query ? `?${query}` : ""}`,
        { token },
      );
    },
    getMerchantLoyaltyMemberWallet(memberId: string, token: string) {
      return requestJson<MerchantLoyaltyMemberWalletResponse>(
        fetcher,
        baseUrl,
        `/api/merchant/loyalty/members/${encodeURIComponent(memberId)}/wallet`,
        { token },
      );
    },
    previewMemberEarning(merchantId: number, netOrderAmountVnd: string, token: string) {
      return requestJson<MemberEarningPreviewResponse>(
        fetcher,
        baseUrl,
        `/api/member/merchants/${merchantId}/loyalty/preview`,
        {
          method: "POST",
          token,
          body: { netOrderAmountVnd },
        },
      );
    },
    previewMerchantLoyalty(input: MerchantLoyaltyPreviewInput, token: string) {
      return requestJson<MerchantLoyaltyPreviewResponse>(fetcher, baseUrl, "/api/merchant/loyalty/preview", {
        method: "POST",
        token,
        body: input,
      });
    },
    listMerchantTransactions(params: MerchantTransactionsQuery, token: string) {
      const searchParams = new URLSearchParams();
      if (params.memberId !== undefined) searchParams.set("memberId", String(params.memberId));
      if (params.orderId !== undefined) searchParams.set("orderId", String(params.orderId));
      if (params.type !== undefined) searchParams.set("type", params.type);
      if (params.from !== undefined) searchParams.set("from", params.from);
      if (params.to !== undefined) searchParams.set("to", params.to);
      if (params.cursor !== undefined) searchParams.set("cursor", params.cursor);
      if (params.limit !== undefined) searchParams.set("limit", String(params.limit));
      const queryString = searchParams.toString();
      const path = `/api/merchant/loyalty/transactions${queryString ? `?${queryString}` : ""}`;
      return requestJson<MerchantTransactionsResponse>(fetcher, baseUrl, path, { token });
    },
  };
}
