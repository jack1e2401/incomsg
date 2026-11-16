import type {
  MerchantStorefrontDraftResponse,
  MerchantStorefrontPreviewResponse,
  MerchantStorefrontPublishResponse,
  MerchantStorefrontStateResponse,
  MerchantStorefrontVersionsResponse,
  PublicStorefrontResponse,
  StorefrontConfig,
  UploadedMediaResponse,
} from "./storefront-types";

type FetchLike = typeof fetch;

const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export function resolveStorefrontAssetUrl(
  url: string | null | undefined,
  apiBaseUrl = DEFAULT_API_BASE,
): string | null {
  if (!url) return null;
  if (url.startsWith("/uploads/")) {
    return `${apiBaseUrl.replace(/\/+$/, "")}${url}`;
  }
  return url;
}

function isBackendError(value: unknown): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string";
}

async function requestJson<T>(
  fetcher: FetchLike,
  baseUrl: string,
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {},
): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);

  const response = await fetcher(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = isBackendError(payload) ? payload.error : `Yêu cầu thất bại (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

export function createStorefrontClient(baseUrl = DEFAULT_API_BASE, fetcher: FetchLike = fetch) {
  return {
    getMerchantStorefront(token: string) {
      return requestJson<MerchantStorefrontStateResponse>(fetcher, baseUrl, "/api/merchant/storefront", { token });
    },

    saveDraft(config: StorefrontConfig, token: string) {
      return requestJson<MerchantStorefrontDraftResponse>(fetcher, baseUrl, "/api/merchant/storefront/draft", {
        method: "PUT",
        token,
        body: config,
      });
    },

    getPreview(token: string) {
      return requestJson<MerchantStorefrontPreviewResponse>(fetcher, baseUrl, "/api/merchant/storefront/preview", {
        token,
      });
    },

    publish(note: string | undefined, token: string) {
      return requestJson<MerchantStorefrontPublishResponse>(fetcher, baseUrl, "/api/merchant/storefront/publish", {
        method: "POST",
        token,
        body: note ? { note } : {},
      });
    },

    listVersions(token: string) {
      return requestJson<MerchantStorefrontVersionsResponse>(fetcher, baseUrl, "/api/merchant/storefront/versions", {
        token,
      });
    },

    rollbackVersion(versionId: number, note: string | undefined, token: string) {
      return requestJson<MerchantStorefrontPublishResponse>(
        fetcher,
        baseUrl,
        `/api/merchant/storefront/versions/${versionId}/rollback`,
        {
          method: "POST",
          token,
          body: note ? { note } : {},
        },
      );
    },

    async uploadMedia(file: File, token: string): Promise<UploadedMediaResponse> {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetcher(`${baseUrl}/api/merchant/media/upload`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = isBackendError(payload) ? payload.error : `Tải ảnh thất bại (${response.status})`;
        throw new Error(message);
      }
      return payload as UploadedMediaResponse;
    },

    getPublicStorefront(slug: string) {
      return requestJson<PublicStorefrontResponse>(
        fetcher,
        baseUrl,
        `/api/public/stores/${encodeURIComponent(slug)}`,
      );
    },
  };
}
