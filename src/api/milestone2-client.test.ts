import { describe, expect, it } from "vitest";
import { createMilestone2Client } from "./milestone2-client";

describe("Milestone 2 HTTP client", () => {
  it("sends Member registration to the backend contract", async () => {
    let requestUrl = "";
    let requestInit: RequestInit | undefined;
    const fetcher: typeof fetch = async (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      return Response.json(
        { user: { id: 7, email: "member@example.com", role: "MEMBER", isActive: true } },
        { status: 201 },
      );
    };
    const client = createMilestone2Client("http://localhost:3000", fetcher);

    await client.registerMember({ email: "member@example.com", password: "a-long-password" });

    expect(requestUrl).toBe("http://localhost:3000/api/auth/register/member");
    expect(requestInit?.method).toBe("POST");
    expect(new Headers(requestInit?.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      email: "member@example.com",
      password: "a-long-password",
    });
  });

  it("uses the Bearer token on protected merchant requests", async () => {
    let authorization = "";
    const fetcher: typeof fetch = async (_input, init) => {
      authorization = new Headers(init?.headers).get("Authorization") ?? "";
      return Response.json({ merchant: { id: 12, name: "Demo", slug: "store-1", isActive: true } });
    };
    const client = createMilestone2Client("", fetcher);

    await client.getOwnMerchant("signed-token");

    expect(authorization).toBe("Bearer signed-token");
  });

  it("preserves backend error codes for UI mapping", async () => {
    const fetcher: typeof fetch = async () => Response.json({ error: "MERCHANT_PENDING" }, { status: 403 });
    const client = createMilestone2Client("", fetcher);

    await expect(client.login({ email: "merchant@example.com", password: "password" })).rejects.toThrow(
      "MERCHANT_PENDING",
    );
  });

  it("checks application status with credentials, without sending a bearer token", async () => {
    let requestUrl = "";
    let requestInit: RequestInit | undefined;
    const fetcher: typeof fetch = async (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      return Response.json({
        application: {
          id: 15,
          applicantId: 21,
          storeName: "Nhà Mây",
          status: "APPROVED",
          reviewedById: 1,
          reviewedAt: "2026-11-09T03:00:00.000Z",
        },
      });
    };
    const client = createMilestone2Client("http://localhost:3000", fetcher);

    const result = await client.checkApplicationStatus({
      email: "shop@example.com",
      password: "a-long-password",
    });

    expect(requestUrl).toBe("http://localhost:3000/api/auth/application-status");
    expect(requestInit?.method).toBe("POST");
    expect(new Headers(requestInit?.headers).get("Authorization")).toBeNull();
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      email: "shop@example.com",
      password: "a-long-password",
    });
    expect(result.application.status).toBe("APPROVED");
  });
});
