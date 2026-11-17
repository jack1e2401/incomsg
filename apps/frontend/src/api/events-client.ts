import { translateApiError } from "./commerce-http";
import { fetchWithSessionRefresh } from "./session-http";
import type {
  CreateEventInput,
  DeleteEventResponse,
  ListMerchantEventsParams,
  ListPublicEventsParams,
  MerchantEventResponse,
  MerchantEventsListResponse,
  PublicStoreEventDetailResponse,
  PublicStoreEventsResponse,
  UpdateEventInput,
} from "./events-types";

export function translateEventError(code: string): string {
  const translations: Record<string, string> = {
    EVENT_SLUG_TAKEN: "Đường dẫn (slug) sự kiện đã tồn tại trong cửa hàng.",
    EVENT_NOT_DRAFT: "Chỉ có thể xóa sự kiện đang ở trạng thái Nháp. Hãy gỡ xuất bản trước.",
    EVENT_NOT_FOUND: "Không tìm thấy sự kiện.",
    MERCHANT_NOT_FOUND: "Không tìm thấy cửa hàng hoặc cửa hàng đã tạm ngưng.",
    INVALID_INPUT: "Thông tin sự kiện chưa hợp lệ. Vui lòng kiểm tra lại.",
  };
  return translations[code] ?? translateApiError(code);
}

type FetchLike = typeof fetch;

async function requestJson<T>(
  fetcher: FetchLike,
  baseUrl: string,
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    token?: string;
    body?: unknown;
  } = {},
): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);

  const response = await fetchWithSessionRefresh(fetcher, baseUrl, path, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  }, options.token);
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

export function createEventsClient(
  baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000",
  fetcher: FetchLike = fetch,
) {
  return {
    listMerchantEvents(params: ListMerchantEventsParams = {}, token: string) {
      const search = new URLSearchParams();
      if (params.status) search.set("status", params.status);
      if (params.q?.trim()) search.set("q", params.q.trim());
      if (params.page) search.set("page", String(params.page));
      if (params.limit) search.set("limit", String(params.limit));
      const qs = search.toString();
      return requestJson<MerchantEventsListResponse>(
        fetcher,
        baseUrl,
        `/api/merchant/events${qs ? `?${qs}` : ""}`,
        { token },
      );
    },

    createMerchantEvent(input: CreateEventInput, token: string) {
      return requestJson<MerchantEventResponse>(fetcher, baseUrl, "/api/merchant/events", {
        method: "POST",
        body: input,
        token,
      });
    },

    getMerchantEvent(eventId: number, token: string) {
      return requestJson<MerchantEventResponse>(fetcher, baseUrl, `/api/merchant/events/${eventId}`, {
        token,
      });
    },

    updateMerchantEvent(eventId: number, patch: UpdateEventInput, token: string) {
      return requestJson<MerchantEventResponse>(fetcher, baseUrl, `/api/merchant/events/${eventId}`, {
        method: "PATCH",
        body: patch,
        token,
      });
    },

    publishMerchantEvent(eventId: number, token: string) {
      return requestJson<MerchantEventResponse>(
        fetcher,
        baseUrl,
        `/api/merchant/events/${eventId}/publish`,
        {
          method: "POST",
          token,
        },
      );
    },

    unpublishMerchantEvent(eventId: number, token: string) {
      return requestJson<MerchantEventResponse>(
        fetcher,
        baseUrl,
        `/api/merchant/events/${eventId}/unpublish`,
        {
          method: "POST",
          token,
        },
      );
    },

    deleteMerchantEvent(eventId: number, token: string) {
      return requestJson<DeleteEventResponse>(fetcher, baseUrl, `/api/merchant/events/${eventId}`, {
        method: "DELETE",
        token,
      });
    },

    listPublicStoreEvents(storeSlug: string, params: ListPublicEventsParams = {}) {
      const search = new URLSearchParams();
      if (params.scope) search.set("scope", params.scope);
      if (params.page) search.set("page", String(params.page));
      if (params.limit) search.set("limit", String(params.limit));
      const qs = search.toString();
      return requestJson<PublicStoreEventsResponse>(
        fetcher,
        baseUrl,
        `/api/public/stores/${encodeURIComponent(storeSlug)}/events${qs ? `?${qs}` : ""}`,
      );
    },

    getPublicStoreEvent(storeSlug: string, eventSlug: string) {
      return requestJson<PublicStoreEventDetailResponse>(
        fetcher,
        baseUrl,
        `/api/public/stores/${encodeURIComponent(storeSlug)}/events/${encodeURIComponent(eventSlug)}`,
      );
    },
  };
}
