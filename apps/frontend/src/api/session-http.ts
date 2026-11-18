import { authPaths, type BackendUserDto, type LoginResponse } from "./contracts/auth";

export const AUTH_SESSION_KEY = "loyalty.m2.session";
const LEGACY_SESSION_KEY = "loyalty.auth.session";
const SESSION_CHANGED_EVENT = "incomsg:auth-session-changed";

type FetchLike = typeof fetch;
let refreshInFlight: Promise<LoginResponse | null> | null = null;

function isBackendUser(value: unknown): value is BackendUserDto {
  if (!value || typeof value !== "object") return false;
  const user = value as Partial<BackendUserDto>;
  return (
    typeof user.id === "number" &&
    typeof user.email === "string" &&
    ["ADMIN", "MERCHANT", "MEMBER"].includes(user.role ?? "") &&
    typeof user.isActive === "boolean"
  );
}

function isLoginResponse(value: unknown): value is LoginResponse {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<LoginResponse>;
  return typeof session.accessToken === "string" && isBackendUser(session.user);
}

function authStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function publishSessionChange(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

export function readStoredAuthSession(): LoginResponse | null {
  try {
    const storage = authStorage();
    if (!storage) return null;
    const parsed: unknown = JSON.parse(storage.getItem(AUTH_SESSION_KEY) ?? storage.getItem(LEGACY_SESSION_KEY) ?? "null");
    return isLoginResponse(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function persistAuthSession(session: LoginResponse): void {
  const storage = authStorage();
  storage?.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  storage?.removeItem(LEGACY_SESSION_KEY);
  publishSessionChange();
}

export function clearStoredAuthSession(): void {
  const storage = authStorage();
  storage?.removeItem(AUTH_SESSION_KEY);
  storage?.removeItem(LEGACY_SESSION_KEY);
  publishSessionChange();
}

function refreshUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}${authPaths.refresh}`;
}

async function refreshWithCrossTabLock(
  fetcher: FetchLike,
  baseUrl: string,
): Promise<LoginResponse | null> {
  const execute = async (): Promise<LoginResponse | null> => {
    const response = await fetcher(refreshUrl(baseUrl), {
      method: "POST",
      headers: { Accept: "application/json" },
      credentials: "include",
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) clearStoredAuthSession();
      return null;
    }

    const payload: unknown = await response.json().catch(() => null);
    if (!isLoginResponse(payload)) {
      clearStoredAuthSession();
      return null;
    }
    persistAuthSession(payload);
    return payload;
  };

  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request("incomsg-auth-refresh", execute);
  }
  return execute();
}

export function refreshStoredAuthSession(
  fetcher: FetchLike,
  baseUrl: string,
): Promise<LoginResponse | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = refreshWithCrossTabLock(fetcher, baseUrl).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function fetchWithSessionRefresh(
  fetcher: FetchLike,
  baseUrl: string,
  path: string,
  init: RequestInit,
  suppliedToken?: string,
): Promise<Response> {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const isAuthRequest = path.startsWith("/api/auth/");
  const originalSession = isAuthRequest ? null : readStoredAuthSession();
  const requestToken = originalSession?.accessToken ?? suppliedToken;
  const headers = new Headers(init.headers);
  if (requestToken) headers.set("Authorization", `Bearer ${requestToken}`);
  const requestInit: RequestInit = { ...init, headers, credentials: "include" };

  const firstResponse = await fetcher(url, requestInit);
  if (firstResponse.status !== 401 || !originalSession || !requestToken) {
    return firstResponse;
  }

  const latestSession = readStoredAuthSession();
  let nextSession = latestSession?.accessToken !== requestToken ? latestSession : null;
  if (!nextSession) nextSession = await refreshStoredAuthSession(fetcher, baseUrl);
  if (!nextSession) return firstResponse;

  const retryHeaders = new Headers(init.headers);
  retryHeaders.set("Authorization", `Bearer ${nextSession.accessToken}`);
  const retryResponse = await fetcher(url, { ...init, headers: retryHeaders, credentials: "include" });
  if (retryResponse.status === 401) clearStoredAuthSession();
  return retryResponse;
}

export function isAccessTokenNearExpiry(token: string, nowSeconds = Date.now() / 1000): boolean {
  const payload = token.split(".")[1];
  if (!payload) return false;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded: unknown = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
    if (!decoded || typeof decoded !== "object" || !("exp" in decoded) || typeof decoded.exp !== "number") {
      return false;
    }
    return decoded.exp <= nowSeconds + 60;
  } catch {
    return false;
  }
}

export function subscribeToAuthSessionChanges(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(SESSION_CHANGED_EVENT, listener);
  return () => window.removeEventListener(SESSION_CHANGED_EVENT, listener);
}
