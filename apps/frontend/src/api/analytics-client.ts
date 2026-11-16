import type {
  CustomerDetailResponse,
  CustomerListQuery,
  CustomerListResponse,
  EnsureMembershipResponse,
  MerchantAnalyticsQuery,
  MerchantAnalyticsResponse,
} from "./analytics-types";

type FetchLike = typeof fetch;

async function requestAnalyticsJson<T>(
  fetcher: FetchLike,
  baseUrl: string,
  path: string,
  options: { method?: "GET" | "POST"; token?: string } = {},
): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
  const response = await fetcher(`${baseUrl.replace(/\/$/, "")}${path}`, {
    method: options.method ?? "GET",
    headers,
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `Yêu cầu thất bại (${response.status})`;
    throw new Error(error);
  }
  return payload as T;
}

export function createAnalyticsClient(baseUrl: string, fetcher: FetchLike = fetch) {
  return {
    ensureStoreMembershipBySlug(slug: string, token: string) {
      return requestAnalyticsJson<EnsureMembershipResponse>(
        fetcher,
        baseUrl,
        `/api/member/stores/${encodeURIComponent(slug)}/membership`,
        { method: "POST", token },
      );
    },

    ensureStoreMembershipByMerchantId(merchantId: number, token: string) {
      return requestAnalyticsJson<EnsureMembershipResponse>(
        fetcher,
        baseUrl,
        `/api/member/merchants/${merchantId}/membership`,
        { method: "POST", token },
      );
    },

    listMerchantCustomers(query: CustomerListQuery, token: string) {
      const params = new URLSearchParams();
      if (query.q?.trim()) params.set("q", query.q.trim());
      if (query.tier) params.set("tier", query.tier);
      if (query.purchaseStatus && query.purchaseStatus !== "all") {
        params.set("purchaseStatus", query.purchaseStatus);
      }
      if (query.page) params.set("page", String(query.page));
      if (query.limit) params.set("limit", String(query.limit));
      const qs = params.toString();
      return requestAnalyticsJson<CustomerListResponse>(
        fetcher,
        baseUrl,
        `/api/merchant/customers${qs ? `?${qs}` : ""}`,
        { token },
      );
    },

    getMerchantCustomerDetail(memberId: number | string, token: string) {
      return requestAnalyticsJson<CustomerDetailResponse>(
        fetcher,
        baseUrl,
        `/api/merchant/customers/${memberId}`,
        { token },
      );
    },

    getMerchantAnalytics(query: MerchantAnalyticsQuery, token: string) {
      const params = new URLSearchParams();
      if (query.from) params.set("from", query.from);
      if (query.to) params.set("to", query.to);
      if (query.granularity) params.set("granularity", query.granularity);
      const qs = params.toString();
      return requestAnalyticsJson<MerchantAnalyticsResponse>(
        fetcher,
        baseUrl,
        `/api/merchant/analytics${qs ? `?${qs}` : ""}`,
        { token },
      );
    },
  };
}
