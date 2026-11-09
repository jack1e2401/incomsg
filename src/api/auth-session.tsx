import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { BackendRole, BackendUserDto, LoginResponse } from "./contracts/milestone2";
import { createMilestone2Client } from "./milestone2-client";

const SESSION_KEY = "loyalty.m2.session";

interface AuthSessionValue {
  user: BackendUserDto | null;
  accessToken: string | null;
  login(input: { email: string; password: string }): Promise<LoginResponse>;
  logout(): void;
}

const AuthSessionContext = createContext<AuthSessionValue | null>(null);
const backendUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
const authApi = createMilestone2Client(backendUrl);

function readSession(): LoginResponse | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null");
    if (!value || typeof value !== "object") return null;
    const session = value as Partial<LoginResponse>;
    if (
      typeof session.accessToken !== "string" ||
      !session.user ||
      typeof session.user.id !== "number" ||
      typeof session.user.email !== "string" ||
      !["ADMIN", "MERCHANT", "MEMBER"].includes(session.user.role) ||
      typeof session.user.isActive !== "boolean"
    )
      return null;
    return session as LoginResponse;
  } catch {
    return null;
  }
}

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<LoginResponse | null>(readSession);

  const value = useMemo<AuthSessionValue>(
    () => ({
      user: session?.user ?? null,
      accessToken: session?.accessToken ?? null,
      async login(credentials) {
        const result = await authApi.login(credentials);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(result));
        setSession(result);
        return result;
      },
      logout() {
        sessionStorage.removeItem(SESSION_KEY);
        setSession(null);
      },
    }),
    [session],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
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
