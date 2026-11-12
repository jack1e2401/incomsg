import { describe, expect, it, vi } from "vitest";
import { createCommerceClient } from "../../../../apps/frontend/src/api/commerce-http";

describe("admin moderation HTTP client", () => {
  it("calls listAdminUsers with proper query params and Bearer token", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        items: [
          {
            id: 1,
            email: "user@example.com",
            role: "MEMBER",
            accountStatus: "ACTIVE",
            isActive: true,
            createdAt: "2026-11-12T00:00:00.000Z",
          },
        ],
        nextCursor: "1",
      }),
    );
    const client = createCommerceClient("http://localhost:3000", fetcher);

    const result = await client.listAdminUsers(
      { search: "user@example.com", status: "ACTIVE", role: "MEMBER", limit: 25 },
      "admin-token",
    );

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toBe("http://localhost:3000/api/admin/users?search=user%40example.com&status=ACTIVE&role=MEMBER&limit=25");
    expect(options?.method).toBe("GET");
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer admin-token");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.email).toBe("user@example.com");
  });

  it("calls changeAdminUserStatus with PATCH, userId and reason", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        user: {
          id: 5,
          email: "target@example.com",
          role: "MEMBER",
          accountStatus: "SUSPENDED",
          isActive: false,
          createdAt: "2026-11-12T00:00:00.000Z",
        },
      }),
    );
    const client = createCommerceClient("http://localhost:3000", fetcher);

    const result = await client.changeAdminUserStatus(
      5,
      { status: "SUSPENDED", reason: "Vi phạm chính sách cộng đồng" },
      "admin-token",
    );

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toBe("http://localhost:3000/api/admin/users/5/status");
    expect(options?.method).toBe("PATCH");
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer admin-token");
    expect(JSON.parse(String(options?.body))).toEqual({
      status: "SUSPENDED",
      reason: "Vi phạm chính sách cộng đồng",
    });
    expect(result.user.accountStatus).toBe("SUSPENDED");
  });

  it("calls changeAdminMerchantStatus with PATCH, merchantId and reason", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        merchant: {
          id: 3,
          name: "Tiệm Trà Sen",
          slug: "tiem-tra-sen",
          isActive: false,
        },
      }),
    );
    const client = createCommerceClient("http://localhost:3000", fetcher);

    const result = await client.changeAdminMerchantStatus(
      3,
      { isActive: false, reason: "Tạm ngưng kiểm tra an toàn" },
      "admin-token",
    );

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toBe("http://localhost:3000/api/admin/merchants/3/status");
    expect(options?.method).toBe("PATCH");
    expect(JSON.parse(String(options?.body))).toEqual({
      isActive: false,
      reason: "Tạm ngưng kiểm tra an toàn",
    });
    expect(result.merchant.isActive).toBe(false);
  });

  it("calls listAdminBlacklist with query params and Bearer token", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        items: [
          {
            id: 10,
            email: "spammer@evil.com",
            reason: "Tạo tài khoản ảo lặp lại",
            isActive: true,
            lastActorId: 1,
            lastActorEmail: "admin@incom.local",
            createdAt: "2026-11-12T01:00:00.000Z",
            updatedAt: "2026-11-12T01:00:00.000Z",
          },
        ],
        nextCursor: null,
      }),
    );
    const client = createCommerceClient("http://localhost:3000", fetcher);

    const result = await client.listAdminBlacklist({ active: true }, "admin-token");

    expect(fetcher).toHaveBeenCalledOnce();
    const [url] = fetcher.mock.calls[0]!;
    expect(url).toBe("http://localhost:3000/api/admin/email-blacklist?active=true");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.email).toBe("spammer@evil.com");
  });

  it("calls addAdminBlacklist with POST and body", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(
        {
          entry: {
            id: 11,
            email: "fraud@bad.org",
            reason: "Hành vi gian lận điểm",
            isActive: true,
            lastActorId: 1,
            lastActorEmail: "admin@incom.local",
            createdAt: "2026-11-12T02:00:00.000Z",
            updatedAt: "2026-11-12T02:00:00.000Z",
          },
        },
        { status: 201 },
      ),
    );
    const client = createCommerceClient("http://localhost:3000", fetcher);

    const result = await client.addAdminBlacklist(
      { email: "fraud@bad.org", reason: "Hành vi gian lận điểm" },
      "admin-token",
    );

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toBe("http://localhost:3000/api/admin/email-blacklist");
    expect(options?.method).toBe("POST");
    expect(JSON.parse(String(options?.body))).toEqual({
      email: "fraud@bad.org",
      reason: "Hành vi gian lận điểm",
    });
    expect(result.entry.email).toBe("fraud@bad.org");
  });

  it("calls deactivateAdminBlacklist with POST and reason", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        entry: {
          id: 11,
          email: "fraud@bad.org",
          reason: "Đã làm rõ và giải quyết khiếu nại",
          isActive: false,
          lastActorId: 1,
          lastActorEmail: "admin@incom.local",
          createdAt: "2026-11-12T02:00:00.000Z",
          updatedAt: "2026-11-12T02:30:00.000Z",
        },
      }),
    );
    const client = createCommerceClient("http://localhost:3000", fetcher);

    const result = await client.deactivateAdminBlacklist(
      11,
      { reason: "Đã làm rõ và giải quyết khiếu nại" },
      "admin-token",
    );

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toBe("http://localhost:3000/api/admin/email-blacklist/11/deactivate");
    expect(options?.method).toBe("POST");
    expect(JSON.parse(String(options?.body))).toEqual({
      reason: "Đã làm rõ và giải quyết khiếu nại",
    });
    expect(result.entry.isActive).toBe(false);
  });

  it("calls listAdminAuditLogs with query filters and parses response", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        items: [
          {
            id: 101,
            actorId: 1,
            actorEmail: "admin@incom.local",
            action: "USER_STATUS_CHANGED",
            targetType: "USER",
            targetId: 5,
            reason: "Khóa kiểm tra",
            before: { accountStatus: "ACTIVE" },
            after: { accountStatus: "SUSPENDED" },
            createdAt: "2026-11-12T03:00:00.000Z",
          },
        ],
        nextCursor: null,
      }),
    );
    const client = createCommerceClient("http://localhost:3000", fetcher);

    const result = await client.listAdminAuditLogs(
      { action: "USER_STATUS_CHANGED", targetType: "USER", targetId: 5 },
      "admin-token",
    );

    expect(fetcher).toHaveBeenCalledOnce();
    const [url] = fetcher.mock.calls[0]!;
    expect(url).toBe("http://localhost:3000/api/admin/audit-logs?action=USER_STATUS_CHANGED&targetType=USER&targetId=5");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.action).toBe("USER_STATUS_CHANGED");
  });

  it("propagates HTTP backend errors with their code", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ error: "EMAIL_BLACKLIST_ACTIVE" }, { status: 409 }),
    );
    const client = createCommerceClient("http://localhost:3000", fetcher);

    await expect(
      client.addAdminBlacklist({ email: "taken@bad.org", reason: "spam" }, "admin-token"),
    ).rejects.toThrow("EMAIL_BLACKLIST_ACTIVE");
  });
});
