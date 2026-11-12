import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type {
  BackendRole,
  BackendUserDto,
  LoginResponse,
  MemberRegistrationResponse,
  MerchantRegistrationResponse,
  ApplicationStatusResponse,
} from "./contracts/milestone2";
import { createMilestone2Client } from "./milestone2-client";

const SESSION_KEY = "loyalty.m2.session";
const authApi = createMilestone2Client(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

interface AuthSessionValue {
  user: BackendUserDto | null;
  accessToken: string | null;
  login(input: { email: string; password: string }): Promise<LoginResponse>;
  registerMember(input: { email: string; password: string }): Promise<MemberRegistrationResponse>;
  registerMerchant(input: {
    email: string;
    password: string;
    storeName: string;
  }): Promise<MerchantRegistrationResponse>;
  checkApplicationStatus(input: { email: string; password: string }): Promise<ApplicationStatusResponse>;
  logout(): void;
}

const AuthSessionContext = createContext<AuthSessionValue | null>(null);

function readSession(): LoginResponse | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem("loyalty.auth.session");
    const value: unknown = JSON.parse(raw ?? "null");
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
      async login(input) {
        const result = await authApi.login(input);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(result));
        setSession(result);
        return result;
      },
      registerMember: (input) => authApi.registerMember(input),
      registerMerchant: (input) => authApi.registerMerchant(input),
      checkApplicationStatus: (input) => authApi.checkApplicationStatus(input),
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
