import {
  authPaths,
  type ApproveApplicationResponse,
  type ApplicationsResponse,
  type ApplicationStatusResponse,
  type BackendErrorResponse,
  type LoginResponse,
  type MerchantRegistrationResponse,
  type MemberRegistrationResponse,
  type OwnMerchantResponse,
  type RejectApplicationResponse,
} from "./contracts/auth";
import { fetchWithSessionRefresh } from "./session-http";

type FetchLike = typeof fetch;
type Credentials = { email: string; password: string };

async function requestJson<T>(
  fetcher: FetchLike,
  baseUrl: string,
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {},
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
    const message = isBackendError(payload) ? payload.error : `Yêu cầu thất bại (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

function isBackendError(value: unknown): value is BackendErrorResponse {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string";
}

/** HTTP client for authentication and merchant application endpoints. */
export function createAuthClient(baseUrl = "", fetcher: FetchLike = fetch) {
  return {
    registerMember(input: Credentials) {
      return requestJson<MemberRegistrationResponse>(fetcher, baseUrl, authPaths.registerMember, {
        method: "POST",
        body: input,
      });
    },

    registerMerchant(input: Credentials & { storeName: string; slug?: string }) {
      return requestJson<MerchantRegistrationResponse>(fetcher, baseUrl, authPaths.registerMerchant, {
        method: "POST",
        body: input,
      });
    },

    checkApplicationStatus(input: Credentials) {
      return requestJson<ApplicationStatusResponse>(fetcher, baseUrl, authPaths.applicationStatus, {
        method: "POST",
        body: input,
      });
    },

    login(input: Credentials) {
      return requestJson<LoginResponse>(fetcher, baseUrl, authPaths.login, {
        method: "POST",
        body: input,
      });
    },

    refresh() {
      return requestJson<LoginResponse>(fetcher, baseUrl, authPaths.refresh, { method: "POST" });
    },

    logout() {
      return requestJson<void>(fetcher, baseUrl, authPaths.logout, { method: "POST" });
    },

    listPendingApplications(token: string) {
      return requestJson<ApplicationsResponse>(fetcher, baseUrl, authPaths.pendingApplications, {
        token,
      });
    },

    listApplicationHistory(token: string) {
      return requestJson<ApplicationsResponse>(fetcher, baseUrl, authPaths.applicationHistory, {
        token,
      });
    },

    approveApplication(id: number, token: string) {
      return requestJson<ApproveApplicationResponse>(
        fetcher,
        baseUrl,
        authPaths.approveApplication(id),
        {
          method: "PATCH",
          token,
        },
      );
    },

    rejectApplication(id: number, token: string) {
      return requestJson<RejectApplicationResponse>(fetcher, baseUrl, authPaths.rejectApplication(id), {
        method: "PATCH",
        token,
      });
    },

    getOwnMerchant(token: string) {
      return requestJson<OwnMerchantResponse>(fetcher, baseUrl, authPaths.ownMerchant, { token });
    },
  };
}
