import {
  milestone2Paths,
  type ApproveApplicationResponse,
  type ApplicationsResponse,
  type ApplicationStatusResponse,
  type BackendErrorResponse,
  type LoginResponse,
  type MerchantRegistrationResponse,
  type MemberRegistrationResponse,
  type OwnMerchantResponse,
  type RejectApplicationResponse,
} from "./contracts/milestone2";

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

function isBackendError(value: unknown): value is BackendErrorResponse {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string";
}

/** HTTP client for the endpoints delivered in Backend Milestone 2 only. */
export function createMilestone2Client(baseUrl = "", fetcher: FetchLike = fetch) {
  return {
    registerMember(input: Credentials) {
      return requestJson<MemberRegistrationResponse>(fetcher, baseUrl, milestone2Paths.registerMember, {
        method: "POST",
        body: input,
      });
    },

    registerMerchant(input: Credentials & { storeName: string }) {
      return requestJson<MerchantRegistrationResponse>(fetcher, baseUrl, milestone2Paths.registerMerchant, {
        method: "POST",
        body: input,
      });
    },

    checkApplicationStatus(input: Credentials) {
      return requestJson<ApplicationStatusResponse>(fetcher, baseUrl, milestone2Paths.applicationStatus, {
        method: "POST",
        body: input,
      });
    },

    login(input: Credentials) {
      return requestJson<LoginResponse>(fetcher, baseUrl, milestone2Paths.login, {
        method: "POST",
        body: input,
      });
    },

    listPendingApplications(token: string) {
      return requestJson<ApplicationsResponse>(fetcher, baseUrl, milestone2Paths.pendingApplications, {
        token,
      });
    },

    listApplicationHistory(token: string) {
      return requestJson<ApplicationsResponse>(fetcher, baseUrl, milestone2Paths.applicationHistory, {
        token,
      });
    },

    approveApplication(id: number, token: string) {
      return requestJson<ApproveApplicationResponse>(
        fetcher,
        baseUrl,
        milestone2Paths.approveApplication(id),
        {
          method: "PATCH",
          token,
        },
      );
    },

    rejectApplication(id: number, token: string) {
      return requestJson<RejectApplicationResponse>(fetcher, baseUrl, milestone2Paths.rejectApplication(id), {
        method: "PATCH",
        token,
      });
    },

    getOwnMerchant(token: string) {
      return requestJson<OwnMerchantResponse>(fetcher, baseUrl, milestone2Paths.ownMerchant, { token });
    },
  };
}
