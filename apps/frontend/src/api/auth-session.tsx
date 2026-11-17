import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  BackendRole,
  BackendUserDto,
  LoginResponse,
  MemberRegistrationResponse,
  MerchantRegistrationResponse,
  ApplicationStatusResponse,
} from "./contracts/auth";
import { createAuthClient } from "./auth-client";
import {
  clearStoredAuthSession,
  isAccessTokenNearExpiry,
  persistAuthSession,
  readStoredAuthSession,
  refreshStoredAuthSession,
  subscribeToAuthSessionChanges,
} from "./session-http";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
const authApi = createAuthClient(API_BASE_URL);

interface AuthSessionValue {
  user: BackendUserDto | null;
  accessToken: string | null;
  login(input: { email: string; password: string }): Promise<LoginResponse>;
  registerMember(input: { email: string; password: string }): Promise<MemberRegistrationResponse>;
  registerMerchant(input: {
    email: string;
    password: string;
    storeName: string;
    slug?: string;
  }): Promise<MerchantRegistrationResponse>;
  checkApplicationStatus(input: { email: string; password: string }): Promise<ApplicationStatusResponse>;
  logout(): void;
}

const AuthSessionContext = createContext<AuthSessionValue | null>(null);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<LoginResponse | null>(readStoredAuthSession);
  useEffect(() => {
    const unsubscribe = subscribeToAuthSessionChanges(() => setSession(readStoredAuthSession()));
    if (session && isAccessTokenNearExpiry(session.accessToken)) {
      void refreshStoredAuthSession(fetch, API_BASE_URL).catch(() => undefined);
    }
    return unsubscribe;
  }, [session]);

  const value = useMemo<AuthSessionValue>(
    () => ({
      user: session?.user ?? null,
      accessToken: session?.accessToken ?? null,
      async login(input) {
        const result = await authApi.login(input);
        persistAuthSession(result);
        setSession(result);
        return result;
      },
      registerMember: (input) => authApi.registerMember(input),
      registerMerchant: (input) => authApi.registerMerchant(input),
      checkApplicationStatus: (input) => authApi.checkApplicationStatus(input),
      logout() {
        clearStoredAuthSession();
        setSession(null);
        void authApi.logout().catch(() => undefined);
      },
    }),
    [session],
  );
  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useOptionalAuthSession() {
  return useContext(AuthSessionContext);
}

export function useAuthSession() {
  const value = useContext(AuthSessionContext);
  if (!value) throw new Error("useAuthSession must be used inside AuthSessionProvider");
  return value;
}

export function routeForRole(role: BackendRole) {
  if (role === "ADMIN") return "/admin/applications";
  if (role === "MERCHANT") return "/merchant";
  return "/member";
}
