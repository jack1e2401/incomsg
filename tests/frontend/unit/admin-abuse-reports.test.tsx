// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockFetchHandler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

vi.mock("../../../apps/frontend/src/api/commerce-http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../apps/frontend/src/api/commerce-http")>();
  return {
    ...actual,
    createCommerceClient: (baseUrl: string, fetcher?: typeof fetch) => {
      return actual.createCommerceClient(baseUrl, (input, init) => {
        if (mockFetchHandler) return mockFetchHandler(input, init);
        return (fetcher ?? fetch)(input, init);
      });
    },
  };
});

import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthSessionProvider } from "../../../apps/frontend/src/api/auth-session";
import { AdminAbuseReports } from "../../../apps/frontend/src/features/admin/BackendAdminPages";
import { BackendConsoleLayout } from "../../../apps/frontend/src/layouts/BackendConsoleLayout";

function renderWithAdminSession(ui: React.ReactElement, initialEntry = "/admin/abuse-reports") {
  const session = JSON.stringify({
    accessToken: "admin-jwt-token",
    user: { id: 1, email: "admin@incom.local", role: "ADMIN", isActive: true },
  });
  sessionStorage.setItem("loyalty.m2.session", session);
  sessionStorage.setItem("loyalty.auth.session", session);

  return render(
    <AuthSessionProvider>
      <MemoryRouter initialEntries={[initialEntry]}>{ui}</MemoryRouter>
    </AuthSessionProvider>,
  );
}

describe("Admin Abuse Reports UI & Navigation", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const mockReports = [
    {
      id: 10,
      merchantId: 2,
      reporterId: 4,
      memberId: 15,
      orderId: 77,
      reason: "Thành viên lạm dụng mã giảm giá bất thường",
      createdAt: "2026-11-12T04:30:00.000Z",
      merchant: { id: 2, name: "Cửa hàng Hoa Cúc" },
      reporter: { id: 4, email: "merchant@hoacuc.local" },
      member: { id: 15, email: "member15@example.com" },
      order: { id: 77, status: "PAID", total: "250000", createdAt: "2026-11-12T04:00:00.000Z" },
    },
    {
      id: 9,
      merchantId: 3,
      reporterId: 5,
      memberId: 22,
      orderId: null,
      reason: "Hành vi spam tích điểm tại quầy",
      createdAt: "2026-11-11T14:15:00.000Z",
      merchant: { id: 3, name: "Tiệm Bánh Mì" },
      reporter: { id: 5, email: "merchant@banhmi.local" },
      member: { id: 22, email: "member22@example.com" },
      order: null,
    },
  ];

  it("renders report list with merchant, reporter, member, order, and reason", async () => {
    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/admin/abuse-reports")) {
        return Response.json({
          items: mockReports,
          nextCursor: null,
        });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderWithAdminSession(<AdminAbuseReports />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Báo cáo vi phạm" })).toBeInTheDocument();
      expect(screen.getByText("Cửa hàng Hoa Cúc")).toBeInTheDocument();
      expect(screen.getByText("member15@example.com")).toBeInTheDocument();
      expect(screen.getByText("Thành viên lạm dụng mã giảm giá bất thường")).toBeInTheDocument();
      expect(screen.getByText("Đơn #77")).toBeInTheDocument();

      expect(screen.getByText("Tiệm Bánh Mì")).toBeInTheDocument();
      expect(screen.getByText("member22@example.com")).toBeInTheDocument();
      expect(screen.getByText("Hành vi spam tích điểm tại quầy")).toBeInTheDocument();
    });
  });

  it("filters reports by merchantId and memberId", async () => {
    let capturedUrl = "";

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/admin/abuse-reports")) {
        capturedUrl = url;
        return Response.json({
          items: [mockReports[0]],
          nextCursor: null,
        });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderWithAdminSession(<AdminAbuseReports />);

    await waitFor(() => {
      expect(screen.getByText("Cửa hàng Hoa Cúc")).toBeInTheDocument();
    });

    const merchantInput = screen.getByLabelText("ID Cửa hàng");
    const memberInput = screen.getByLabelText("ID Thành viên");
    fireEvent.change(merchantInput, { target: { value: "2" } });
    fireEvent.change(memberInput, { target: { value: "15" } });

    const submitBtn = screen.getByRole("button", { name: "Tìm kiếm" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(capturedUrl).toContain("merchantId=2");
      expect(capturedUrl).toContain("memberId=15");
    });
  });

  it("supports pagination with 'Tải thêm' when nextCursor is available", async () => {
    let fetchCount = 0;

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/admin/abuse-reports")) {
        fetchCount += 1;
        if (fetchCount === 1) {
          return Response.json({
            items: [mockReports[0]],
            nextCursor: "9",
          });
        }
        return Response.json({
          items: [mockReports[1]],
          nextCursor: null,
        });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderWithAdminSession(<AdminAbuseReports />);

    await waitFor(() => {
      expect(screen.getByText("Cửa hàng Hoa Cúc")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Tải thêm" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Tải thêm" }));

    await waitFor(() => {
      expect(screen.getByText("Tiệm Bánh Mì")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Tải thêm" })).not.toBeInTheDocument();
    });
  });

  it("shows empty state when no reports match", async () => {
    mockFetchHandler = vi.fn().mockImplementation(async () => {
      return Response.json({ items: [], nextCursor: null });
    });

    renderWithAdminSession(<AdminAbuseReports />);

    await waitFor(() => {
      expect(screen.getByText("Không có báo cáo vi phạm")).toBeInTheDocument();
    });
  });

  it("shows error state with retry when fetch fails", async () => {
    mockFetchHandler = vi.fn().mockRejectedValueOnce(new Error("Lỗi kết nối máy chủ"));

    renderWithAdminSession(<AdminAbuseReports />);

    await waitFor(() => {
      expect(screen.getByText("Lỗi kết nối máy chủ")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
    });
  });

  it("renders navigation link in BackendConsoleLayout for Admin", async () => {
    mockFetchHandler = vi.fn().mockResolvedValue(Response.json({ items: [], nextCursor: null }));

    renderWithAdminSession(
      <Routes>
        <Route path="/admin" element={<BackendConsoleLayout role="admin" />}>
          <Route path="abuse-reports" element={<AdminAbuseReports />} />
        </Route>
      </Routes>,
      "/admin/abuse-reports",
    );

    const navLink = screen.getByRole("link", { name: "Báo cáo vi phạm" });
    expect(navLink).toBeInTheDocument();
    expect(navLink).toHaveAttribute("href", "/admin/abuse-reports");
  });
});
