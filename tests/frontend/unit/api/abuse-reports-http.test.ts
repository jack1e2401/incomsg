import { describe, expect, it, vi } from "vitest";
import { createCommerceClient, translateApiError } from "../../../../apps/frontend/src/api/commerce-http";

describe("abuse reports HTTP client", () => {
  it("translates abuse report specific API error codes", () => {
    expect(translateApiError("MEMBER_NOT_FOUND")).toBe("Không tìm thấy thành viên trong cửa hàng.");
    expect(translateApiError("ORDER_NOT_FOUND")).toBe("Không tìm thấy đơn hàng tương ứng.");
  });

  describe("createMerchantAbuseReport", () => {
    it("calls POST /api/merchant/abuse-reports with Bearer token and body", async () => {
      const mockReport = {
        id: 101,
        merchantId: 5,
        reporterId: 2,
        memberId: 12,
        orderId: 44,
        reason: "Khách hàng gian lận mã giảm giá và tạo nhiều đơn hủy",
        createdAt: "2026-11-12T10:00:00.000Z",
      };

      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({ report: mockReport }, { status: 201 }),
      );
      const client = createCommerceClient("http://localhost:3000", fetcher);

      const result = await client.createMerchantAbuseReport(
        {
          memberId: 12,
          orderId: 44,
          reason: "Khách hàng gian lận mã giảm giá và tạo nhiều đơn hủy",
        },
        "merchant-token",
      );

      expect(fetcher).toHaveBeenCalledOnce();
      const [url, options] = fetcher.mock.calls[0]!;
      expect(url).toBe("http://localhost:3000/api/merchant/abuse-reports");
      expect(options?.method).toBe("POST");
      expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer merchant-token");
      expect(JSON.parse(String(options?.body))).toEqual({
        memberId: 12,
        orderId: 44,
        reason: "Khách hàng gian lận mã giảm giá và tạo nhiều đơn hủy",
      });
      expect(result.report).toEqual(mockReport);
    });

    it("throws when endpoint returns error response", async () => {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({ error: "ORDER_NOT_FOUND" }, { status: 404 }),
      );
      const client = createCommerceClient("http://localhost:3000", fetcher);

      await expect(
        client.createMerchantAbuseReport(
          { memberId: 99, orderId: 88, reason: "Báo cáo lỗi" },
          "merchant-token",
        ),
      ).rejects.toThrow("ORDER_NOT_FOUND");
    });
  });

  describe("listAdminAbuseReports", () => {
    it("calls GET /api/admin/abuse-reports with query params and Bearer token", async () => {
      const mockItems = [
        {
          id: 1,
          merchantId: 5,
          reporterId: 2,
          memberId: 12,
          orderId: 44,
          reason: "Hành vi nghi ngờ gian lận điểm thưởng",
          createdAt: "2026-11-12T09:00:00.000Z",
          merchant: { id: 5, name: "Cửa hàng Mộc" },
          reporter: { id: 2, email: "merchant@moc.local" },
          member: { id: 12, email: "member@user.local" },
          order: { id: 44, status: "PAID", total: "150000", createdAt: "2026-11-12T08:00:00.000Z" },
        },
      ];

      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          items: mockItems,
          nextCursor: "1",
        }),
      );
      const client = createCommerceClient("http://localhost:3000", fetcher);

      const result = await client.listAdminAbuseReports(
        { merchantId: 5, memberId: 12, cursor: 10, limit: 25 },
        "admin-token",
      );

      expect(fetcher).toHaveBeenCalledOnce();
      const [url, options] = fetcher.mock.calls[0]!;
      expect(url).toBe("http://localhost:3000/api/admin/abuse-reports?merchantId=5&memberId=12&cursor=10&limit=25");
      expect(options?.method).toBe("GET");
      expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer admin-token");
      expect(result.items).toEqual(mockItems);
      expect(result.nextCursor).toBe("1");
    });

    it("omits empty query params from URL", async () => {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          items: [],
          nextCursor: null,
        }),
      );
      const client = createCommerceClient("http://localhost:3000", fetcher);

      await client.listAdminAbuseReports({}, "admin-token");

      expect(fetcher).toHaveBeenCalledOnce();
      const [url] = fetcher.mock.calls[0]!;
      expect(url).toBe("http://localhost:3000/api/admin/abuse-reports");
    });
  });
});
