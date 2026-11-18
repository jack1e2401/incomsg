// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createCommerceClient } from "../../../../apps/frontend/src/api/commerce-http";
import { createAuthClient } from "../../../../apps/frontend/src/api/auth-client";
import { AuthSessionProvider, useAuthSession } from "../../../../apps/frontend/src/api/auth-session";
import { isAccessTokenNearExpiry } from "../../../../apps/frontend/src/api/session-http";

const baseUrl = "http://localhost:3000";
const member = { id: 3, email: "member@example.test", role: "MEMBER" as const, isActive: true };

function putSession(accessToken: string) {
  sessionStorage.setItem("loyalty.m2.session", JSON.stringify({ accessToken, user: member }));
}

describe("authenticated request refresh", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("restores an expiring session when the app opens", async () => {
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 1 }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    const expiredToken = `e30.${payload}.signature`;
    putSession(expiredToken);
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ accessToken: "restored-access-token", user: member }));
    vi.stubGlobal("fetch", fetcher);

    function SessionOutput() {
      const { accessToken } = useAuthSession();
      return <div>{accessToken}</div>;
    }

    render(
      <AuthSessionProvider>
        <SessionOutput />
      </AuthSessionProvider>,
    );

    expect(await screen.findByText("restored-access-token")).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith(
      `${baseUrl}/api/auth/refresh`,
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    expect(isAccessTokenNearExpiry(expiredToken)).toBe(true);
  });

  it("accepts the refresh cookie when login runs from the separate frontend origin", async () => {
    let requestInit: RequestInit | undefined;
    const fetcher: typeof fetch = async (_input, init) => {
      requestInit = init;
      return Response.json({ accessToken: "signed-access-token", user: member });
    };

    await createAuthClient(baseUrl, fetcher).login({ email: member.email, password: "password" });

    expect(requestInit?.credentials).toBe("include");
    expect(new Headers(requestInit?.headers).get("Authorization")).toBeNull();
  });

  it("refreshes after a 401, retries once with the rotated access token, and updates the session", async () => {
    putSession("expired-access-token");
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/api/auth/refresh")) {
        return Response.json({ accessToken: "fresh-access-token", user: member });
      }
      const authorization = new Headers(init?.headers).get("Authorization");
      if (authorization === "Bearer expired-access-token") {
        return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
      }
      return Response.json({ merchant: { id: 5, name: "Mộc", slug: "moc", isActive: true } });
    });

    const result = await createCommerceClient(baseUrl, fetcher).getOwnMerchant("stale-captured-token");

    expect(result.merchant.slug).toBe("moc");
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get("Authorization")).toBe("Bearer expired-access-token");
    expect(fetcher.mock.calls[1]?.[0]).toBe(`${baseUrl}/api/auth/refresh`);
    expect(fetcher.mock.calls[1]?.[1]?.credentials).toBe("include");
    expect(new Headers(fetcher.mock.calls[2]?.[1]?.headers).get("Authorization")).toBe("Bearer fresh-access-token");
    expect(JSON.parse(sessionStorage.getItem("loyalty.m2.session") ?? "{}").accessToken).toBe("fresh-access-token");
  });

  it("shares one refresh request when multiple calls expire together", async () => {
    putSession("expired-access-token");
    let releaseRefresh!: () => void;
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/api/auth/refresh")) {
        await refreshGate;
        return Response.json({ accessToken: "fresh-access-token", user: member });
      }
      const authorization = new Headers(init?.headers).get("Authorization");
      if (authorization === "Bearer expired-access-token") {
        return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
      }
      return Response.json({ merchant: { id: 5, name: "Mộc", slug: "moc", isActive: true } });
    });

    const client = createCommerceClient(baseUrl, fetcher);
    const first = client.getOwnMerchant("expired-access-token");
    const second = client.getOwnMerchant("expired-access-token");
    await vi.waitFor(() => expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith("/api/auth/refresh"))).toHaveLength(1));
    releaseRefresh();
    await Promise.all([first, second]);

    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith("/api/auth/refresh"))).toHaveLength(1);
  });

  it("does not retry forever and clears a session when refresh is rejected", async () => {
    putSession("expired-access-token");
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ error: "UNAUTHORIZED" }, { status: 401 }));

    await expect(createCommerceClient(baseUrl, fetcher).getOwnMerchant("expired-access-token")).rejects.toThrow("UNAUTHORIZED");

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(sessionStorage.getItem("loyalty.m2.session")).toBeNull();
  });
});
