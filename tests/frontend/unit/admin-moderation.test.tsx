// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthSessionProvider } from "../../../apps/frontend/src/api/auth-session";
import {
  AdminUsers,
  AdminBlacklist,
  AdminAuditLogs,
  AdminMerchants,
} from "../../../apps/frontend/src/features/admin/BackendAdminPages";
import { LoginPage, RegisterPage } from "../../../apps/frontend/src/features/auth/AuthPages";
import { ErrorState } from "../../../apps/frontend/src/components/ui";

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

vi.mock("../../../apps/frontend/src/api/milestone2-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../apps/frontend/src/api/milestone2-client")>();
  return {
    ...actual,
    createMilestone2Client: (baseUrl: string, fetcher?: typeof fetch) => {
      return actual.createMilestone2Client(baseUrl, (input, init) => {
        if (mockFetchHandler) return mockFetchHandler(input, init);
        return (fetcher ?? fetch)(input, init);
      });
    },
  };
});

function renderWithAdminSession(ui: React.ReactElement, initialEntry = "/admin") {
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

describe("M8 Admin Moderation UI", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("AdminUsers", () => {
    const mockUsers = [
      {
        id: 10,
        email: "active.user@example.com",
        role: "MEMBER",
        accountStatus: "ACTIVE",
        isActive: true,
        createdAt: "2026-11-12T00:00:00.000Z",
      },
      {
        id: 11,
        email: "suspended.user@example.com",
        role: "MEMBER",
        accountStatus: "SUSPENDED",
        isActive: false,
        createdAt: "2026-11-12T01:00:00.000Z",
      },
      {
        id: 12,
        email: "banned.user@example.com",
        role: "MERCHANT",
        accountStatus: "BANNED",
        isActive: false,
        createdAt: "2026-11-12T02:00:00.000Z",
      },
    ];

    it("renders user list with statuses and enforces action availability", async () => {
      mockFetchHandler = vi.fn().mockResolvedValue(
        Response.json({
          items: mockUsers,
          nextCursor: null,
        }),
      );

      renderWithAdminSession(<AdminUsers />);

      await waitFor(() => {
        expect(screen.getByText("active.user@example.com")).toBeInTheDocument();
        expect(screen.getByText("suspended.user@example.com")).toBeInTheDocument();
        expect(screen.getByText("banned.user@example.com")).toBeInTheDocument();
      });

      // Active user has "Tạm khóa" and "Cấm", but NOT "Mở khóa"
      expect(screen.getByTitle("Tạm khóa tài khoản active.user@example.com")).toBeInTheDocument();
      expect(screen.getByTitle("Cấm tài khoản active.user@example.com")).toBeInTheDocument();
      expect(screen.queryByTitle("Mở khóa tài khoản active.user@example.com")).not.toBeInTheDocument();

      // Suspended user has "Mở khóa" and "Cấm", but NOT "Tạm khóa"
      expect(screen.getByTitle("Mở khóa tài khoản suspended.user@example.com")).toBeInTheDocument();
      expect(screen.getByTitle("Cấm tài khoản suspended.user@example.com")).toBeInTheDocument();
      expect(screen.queryByTitle("Tạm khóa tài khoản suspended.user@example.com")).not.toBeInTheDocument();

      // Banned user has ONLY "Mở khóa", NOT "Tạm khóa" or "Cấm"
      expect(screen.getByTitle("Mở khóa tài khoản banned.user@example.com")).toBeInTheDocument();
      expect(screen.queryByTitle("Tạm khóa tài khoản banned.user@example.com")).not.toBeInTheDocument();
      expect(screen.queryByTitle("Cấm tài khoản banned.user@example.com")).not.toBeInTheDocument();
    });

    it("requires a reason to suspend and updates user upon confirmation", async () => {
      mockFetchHandler = vi.fn((input, init) => {
        const url = String(input);
        if (url.includes("/api/admin/users") && (!init?.method || init.method === "GET")) {
          return Promise.resolve(
            Response.json({
              items: mockUsers,
              nextCursor: null,
            }),
          );
        }
        if (url.includes("/api/admin/users/10/status") && init?.method === "PATCH") {
          const body = JSON.parse(String(init.body));
          expect(body).toEqual({
            status: "SUSPENDED",
            reason: "Nghi vấn lạm dụng voucher khuyến mãi",
          });
          return Promise.resolve(
            Response.json({
              user: {
                id: 10,
                email: "active.user@example.com",
                role: "MEMBER",
                accountStatus: "SUSPENDED",
                isActive: false,
                createdAt: "2026-11-12T00:00:00.000Z",
              },
            }),
          );
        }
        return Promise.reject(new Error(`Unexpected call: ${url}`));
      });

      renderWithAdminSession(<AdminUsers />);

      await waitFor(() => {
        expect(screen.getByText("active.user@example.com")).toBeInTheDocument();
      });

      // Click "Tạm khóa" for active user
      fireEvent.click(screen.getByTitle("Tạm khóa tài khoản active.user@example.com"));

      // Dialog opens
      expect(screen.getByText("Tạm khóa tài khoản?")).toBeInTheDocument();

      // Try submitting without reason
      const submitBtn = screen.getByRole("button", { name: "Xác nhận tạm khóa" });
      fireEvent.click(submitBtn);

      // Validation error appears
      expect(screen.getByText("Lý do là bắt buộc (từ 1 đến 255 ký tự).")).toBeInTheDocument();

      // Enter reason
      const textarea = screen.getByPlaceholderText("Nhập lý do thực hiện thao tác kiểm duyệt này...");
      fireEvent.change(textarea, { target: { value: "Nghi vấn lạm dụng voucher khuyến mãi" } });

      // Submit
      fireEvent.click(submitBtn);

      // Success notification
      await waitFor(() => {
        expect(
          screen.getByText("Đã Tạm khóa tài khoản active.user@example.com thành công."),
        ).toBeInTheDocument();
      });
    });

    it("handles 409 INVALID_STATE_TRANSITION gracefully", async () => {
      mockFetchHandler = vi.fn((input, init) => {
        const url = String(input);
        if (url.includes("/api/admin/users") && (!init?.method || init.method === "GET")) {
          return Promise.resolve(Response.json({ items: mockUsers, nextCursor: null }));
        }
        if (url.includes("/api/admin/users/10/status") && init?.method === "PATCH") {
          return Promise.resolve(
            Response.json({ error: "INVALID_STATE_TRANSITION" }, { status: 409 }),
          );
        }
        return Promise.reject(new Error(`Unexpected call: ${url}`));
      });

      renderWithAdminSession(<AdminUsers />);

      await waitFor(() => {
        expect(screen.getByText("active.user@example.com")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle("Cấm tài khoản active.user@example.com"));
      expect(screen.getByText("Cấm tài khoản?")).toBeInTheDocument();
      expect(
        screen.getByText(/sẽ chặn đăng nhập và từ chối các yêu cầu cho đến khi Admin mở khóa/),
      ).toBeInTheDocument();
      const textarea = screen.getByPlaceholderText("Nhập lý do thực hiện thao tác kiểm duyệt này...");
      fireEvent.change(textarea, { target: { value: "Cấm do vi phạm nghiêm trọng" } });
      fireEvent.click(screen.getByRole("button", { name: "Xác nhận cấm" }));

      await waitFor(() => {
        expect(
          screen.getByText("Chuyển đổi trạng thái không hợp lệ hoặc tài khoản đã ở trạng thái này."),
        ).toBeInTheDocument();
      });
    });

    it("renders empty state when filter matches no users", async () => {
      mockFetchHandler = vi.fn().mockResolvedValue(
        Response.json({
          items: [],
          nextCursor: null,
        }),
      );

      renderWithAdminSession(<AdminUsers />);

      await waitFor(() => {
        expect(screen.getByText("Không tìm thấy người dùng")).toBeInTheDocument();
      });
    });
  });

  describe("AdminBlacklist", () => {
    const mockBlacklist = [
      {
        id: 1,
        email: "bad@evil.org",
        reason: "Spam liên tục",
        isActive: true,
        lastActorId: 1,
        lastActorEmail: "admin@incom.local",
        createdAt: "2026-11-12T00:00:00.000Z",
        updatedAt: "2026-11-12T00:00:00.000Z",
      },
      {
        id: 2,
        email: "rehabilitated@normal.org",
        reason: "Đã khắc phục khiếu nại",
        isActive: false,
        lastActorId: 1,
        lastActorEmail: "admin@incom.local",
        createdAt: "2026-11-12T01:00:00.000Z",
        updatedAt: "2026-11-12T02:00:00.000Z",
      },
    ];

    it("renders blacklist entries and allows adding new entry with reason", async () => {
      mockFetchHandler = vi.fn((input, init) => {
        const url = String(input);
        if (url.includes("/api/admin/email-blacklist") && (!init?.method || init.method === "GET")) {
          return Promise.resolve(Response.json({ items: mockBlacklist, nextCursor: null }));
        }
        if (url.includes("/api/admin/email-blacklist") && init?.method === "POST") {
          const body = JSON.parse(String(init.body));
          expect(body).toEqual({
            email: "fraudster@fake.com",
            reason: "Hành vi gian lận thanh toán",
          });
          return Promise.resolve(
            Response.json(
              {
                entry: {
                  id: 3,
                  email: "fraudster@fake.com",
                  reason: "Hành vi gian lận thanh toán",
                  isActive: true,
                  lastActorId: 1,
                  lastActorEmail: "admin@incom.local",
                  createdAt: "2026-11-12T03:00:00.000Z",
                  updatedAt: "2026-11-12T03:00:00.000Z",
                },
              },
              { status: 201 },
            ),
          );
        }
        return Promise.reject(new Error(`Unexpected call: ${url}`));
      });

      renderWithAdminSession(<AdminBlacklist />);

      await waitFor(() => {
        expect(screen.getByText("bad@evil.org")).toBeInTheDocument();
        expect(screen.getByText("rehabilitated@normal.org")).toBeInTheDocument();
      });

      // Active entry has "Hủy chặn" button
      expect(screen.getByTitle("Hủy chặn email bad@evil.org")).toBeInTheDocument();
      // Inactive entry displays "Không khả dụng"
      expect(screen.getByText("Không khả dụng")).toBeInTheDocument();

      // Open Add dialog
      fireEvent.click(screen.getByRole("button", { name: "Thêm email chặn" }));
      expect(screen.getByText("Thêm email vào danh sách đen")).toBeInTheDocument();

      // Fill in details
      fireEvent.change(screen.getByPlaceholderText("spam@example.com"), {
        target: { value: "fraudster@fake.com" },
      });
      fireEvent.change(screen.getByPlaceholderText("Nhập lý do chặn email này..."), {
        target: { value: "Hành vi gian lận thanh toán" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Thêm vào danh sách" }));

      await waitFor(() => {
        expect(
          screen.getByText("Đã thêm fraudster@fake.com vào danh sách đen."),
        ).toBeInTheDocument();
      });
    });

    it("handles 409 EMAIL_BLACKLIST_ACTIVE in add dialog", async () => {
      mockFetchHandler = vi.fn((input, init) => {
        const url = String(input);
        if (url.includes("/api/admin/email-blacklist") && (!init?.method || init.method === "GET")) {
          return Promise.resolve(Response.json({ items: mockBlacklist, nextCursor: null }));
        }
        if (url.includes("/api/admin/email-blacklist") && init?.method === "POST") {
          return Promise.resolve(
            Response.json({ error: "EMAIL_BLACKLIST_ACTIVE" }, { status: 409 }),
          );
        }
        return Promise.reject(new Error(`Unexpected call: ${url}`));
      });

      renderWithAdminSession(<AdminBlacklist />);

      await waitFor(() => {
        expect(screen.getByText("bad@evil.org")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Thêm email chặn" }));
      fireEvent.change(screen.getByPlaceholderText("spam@example.com"), {
        target: { value: "bad@evil.org" },
      });
      fireEvent.change(screen.getByPlaceholderText("Nhập lý do chặn email này..."), {
        target: { value: "Lại spam tiếp" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Thêm vào danh sách" }));

      await waitFor(() => {
        expect(
          screen.getByText("Email này đã nằm trong danh sách đen và đang hoạt động."),
        ).toBeInTheDocument();
      });

      // Regression check: clicking X close button dismisses dialog even after duplicate error
      const closeBtn = screen.getByLabelText("Đóng hộp thoại");
      fireEvent.click(closeBtn);
      expect(screen.queryByText("Thêm email vào danh sách đen")).not.toBeInTheDocument();
    });

    it("deactivates blacklist entry with required reason", async () => {
      mockFetchHandler = vi.fn((input, init) => {
        const url = String(input);
        if (url.includes("/api/admin/email-blacklist") && (!init?.method || init.method === "GET")) {
          return Promise.resolve(Response.json({ items: mockBlacklist, nextCursor: null }));
        }
        if (url.includes("/api/admin/email-blacklist/1/deactivate") && init?.method === "POST") {
          const body = JSON.parse(String(init.body));
          expect(body).toEqual({ reason: "Người dùng đã xác minh chính chủ" });
          return Promise.resolve(
            Response.json({
              entry: {
                id: 1,
                email: "bad@evil.org",
                reason: "Người dùng đã xác minh chính chủ",
                isActive: false,
                lastActorId: 1,
                lastActorEmail: "admin@incom.local",
                createdAt: "2026-11-12T00:00:00.000Z",
                updatedAt: "2026-11-12T04:00:00.000Z",
              },
            }),
          );
        }
        return Promise.reject(new Error(`Unexpected call: ${url}`));
      });

      renderWithAdminSession(<AdminBlacklist />);

      await waitFor(() => {
        expect(screen.getByText("bad@evil.org")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle("Hủy chặn email bad@evil.org"));
      expect(screen.getByText("Hủy chặn email?")).toBeInTheDocument();

      const textarea = screen.getByPlaceholderText("Nhập lý do thực hiện thao tác kiểm duyệt này...");
      fireEvent.change(textarea, { target: { value: "Người dùng đã xác minh chính chủ" } });
      fireEvent.click(screen.getByRole("button", { name: "Xác nhận hủy chặn" }));

      await waitFor(() => {
        expect(screen.getByText("Đã hủy chặn email bad@evil.org.")).toBeInTheDocument();
      });
    });
  });

  describe("AdminAuditLogs", () => {
    const mockLogs = [
      {
        id: 50,
        actorId: 1,
        actorEmail: "admin@incom.local",
        action: "USER_STATUS_CHANGED",
        targetType: "USER",
        targetId: 10,
        reason: "Cảnh báo gian lận điểm",
        before: { accountStatus: "ACTIVE" },
        after: { accountStatus: "SUSPENDED" },
        createdAt: "2026-11-12T04:00:00.000Z",
      },
    ];

    it("renders read-only audit log entries with expandable before/after details", async () => {
      mockFetchHandler = vi.fn((input, init) => {
        const url = String(input);
        if (url.includes("/api/admin/audit-logs") && (!init?.method || init.method === "GET")) {
          return Promise.resolve(
            Response.json({
              items: mockLogs,
              nextCursor: null,
            }),
          );
        }
        return Promise.reject(new Error(`Unexpected call: ${url}`));
      });

      renderWithAdminSession(<AdminAuditLogs />);

      await waitFor(() => {
        expect(screen.getAllByText("Đổi trạng thái tài khoản").length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText("Cảnh báo gian lận điểm")).toBeInTheDocument();
        expect(screen.getByText("admin@incom.local")).toBeInTheDocument();
      });

      // Expand details
      const viewBtn = screen.getByRole("button", { name: /Xem/i });
      fireEvent.click(viewBtn);

      await waitFor(() => {
        expect(screen.getByText("Chi tiết thay đổi (Bản ghi kiểm toán #50)")).toBeInTheDocument();
        expect(screen.getByText(/"accountStatus": "ACTIVE"/)).toBeInTheDocument();
        expect(screen.getByText(/"accountStatus": "SUSPENDED"/)).toBeInTheDocument();
      });

      // Collapse details
      const hideBtn = screen.getByRole("button", { name: /Ẩn/i });
      fireEvent.click(hideBtn);

      expect(screen.queryByText("Chi tiết thay đổi (Bản ghi kiểm toán #50)")).not.toBeInTheDocument();
    });
  });

  describe("AdminMerchants", () => {
    const mockMerchants = [
      {
        id: 7,
        name: "Cà phê Gió Mùa",
        slug: "gio-mua-coffee",
        isActive: true,
      },
      {
        id: 8,
        name: "Gốm Mộc An",
        slug: "gom-moc-an",
        isActive: false,
      },
    ];

    it("renders merchants and allows audited deactivate and activate with reason", async () => {
      mockFetchHandler = vi.fn((input, init) => {
        const url = String(input);
        if (url.includes("/api/admin/merchants") && (!init?.method || init.method === "GET")) {
          return Promise.resolve(Response.json({ merchants: mockMerchants }));
        }
        if (url.includes("/api/admin/merchants/7/status") && init?.method === "PATCH") {
          const body = JSON.parse(String(init.body));
          expect(body).toEqual({
            isActive: false,
            reason: "Vi phạm quy chế hợp đồng đối tác",
          });
          return Promise.resolve(
            Response.json({
              merchant: {
                id: 7,
                name: "Cà phê Gió Mùa",
                slug: "gio-mua-coffee",
                isActive: false,
              },
            }),
          );
        }
        return Promise.reject(new Error(`Unexpected call: ${url}`));
      });

      renderWithAdminSession(<AdminMerchants />);

      await waitFor(() => {
        expect(screen.getByText("Cà phê Gió Mùa")).toBeInTheDocument();
        expect(screen.getByText("Gốm Mộc An")).toBeInTheDocument();
      });

      // Active merchant has "Tạm ngưng" button
      fireEvent.click(screen.getByTitle("Tạm ngưng Cà phê Gió Mùa"));
      expect(screen.getByText("Tạm ngưng hoạt động cửa hàng?")).toBeInTheDocument();

      const textarea = screen.getByPlaceholderText("Nhập lý do thực hiện thao tác kiểm duyệt này...");
      fireEvent.change(textarea, { target: { value: "Vi phạm quy chế hợp đồng đối tác" } });
      fireEvent.click(screen.getByRole("button", { name: "Xác nhận tạm ngưng" }));

      await waitFor(() => {
        expect(
          screen.getByText('Đã tạm ngưng cửa hàng "Cà phê Gió Mùa" thành công.'),
        ).toBeInTheDocument();
      });
    });
  });

  describe("AuthPages Moderation Error Feedback", () => {
    it("displays useful error feedback for suspended, banned, and blacklisted accounts during login", async () => {
      mockFetchHandler = vi.fn((input) => {
        const url = String(input);
        if (url.includes("/api/auth/login")) {
          return Promise.resolve(Response.json({ error: "ACCOUNT_SUSPENDED" }, { status: 403 }));
        }
        return Promise.resolve(Response.json({}));
      });

      render(
        <AuthSessionProvider>
          <MemoryRouter initialEntries={["/login"]}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
            </Routes>
          </MemoryRouter>
        </AuthSessionProvider>,
      );

      fireEvent.change(screen.getByPlaceholderText("ban@example.com"), {
        target: { value: "suspended@user.com" },
      });
      fireEvent.change(screen.getByPlaceholderText("Nhập mật khẩu"), {
        target: { value: "password123" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

      await waitFor(() => {
        expect(
          screen.getByText("Tài khoản đang bị tạm khóa. Vui lòng liên hệ quản trị viên."),
        ).toBeInTheDocument();
      });
    });

    it("shows a distinct login alert for banned accounts", async () => {
      mockFetchHandler = vi.fn((input) => {
        if (String(input).includes("/api/auth/login")) {
          return Promise.resolve(Response.json({ error: "ACCOUNT_BANNED" }, { status: 403 }));
        }
        return Promise.resolve(Response.json({}));
      });

      render(
        <AuthSessionProvider>
          <MemoryRouter initialEntries={["/login"]}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
            </Routes>
          </MemoryRouter>
        </AuthSessionProvider>,
      );

      fireEvent.change(screen.getByPlaceholderText("ban@example.com"), {
        target: { value: "banned@user.com" },
      });
      fireEvent.change(screen.getByPlaceholderText("Nhập mật khẩu"), {
        target: { value: "password123" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Tài khoản đã bị cấm khỏi hệ thống.");
      });
      expect(screen.queryByText("Tài khoản đang bị tạm khóa. Vui lòng liên hệ quản trị viên.")).toBeNull();
    });

    it("displays useful error feedback for blacklisted email during registration", async () => {
      mockFetchHandler = vi.fn((input) => {
        const url = String(input);
        if (url.includes("/api/auth/register/member")) {
          return Promise.resolve(Response.json({ error: "EMAIL_BLACKLISTED" }, { status: 403 }));
        }
        return Promise.resolve(Response.json({}));
      });

      render(
        <AuthSessionProvider>
          <MemoryRouter initialEntries={["/register"]}>
            <Routes>
              <Route path="/register" element={<RegisterPage />} />
            </Routes>
          </MemoryRouter>
        </AuthSessionProvider>,
      );

      fireEvent.change(screen.getByPlaceholderText("ban@example.com"), {
        target: { value: "blocked@spammer.com" },
      });
      fireEvent.change(screen.getByPlaceholderText("Tạo mật khẩu mạnh"), {
        target: { value: "password123456" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản Member" }));

      await waitFor(() => {
        expect(
          screen.getByText("Địa chỉ email đã bị chặn trong danh sách đen."),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Shared ErrorState translation", () => {
    it("translates moderation and protected error codes to actionable Vietnamese", () => {
      const { rerender } = render(<ErrorState message="ACCOUNT_SUSPENDED" />);
      expect(
        screen.getByText("Tài khoản đang bị tạm khóa. Vui lòng liên hệ quản trị viên."),
      ).toBeInTheDocument();

      rerender(<ErrorState message="ACCOUNT_BANNED" />);
      expect(screen.getByText("Tài khoản đã bị cấm khỏi hệ thống.")).toBeInTheDocument();

      rerender(<ErrorState message="EMAIL_BLACKLISTED" />);
      expect(
        screen.getByText("Địa chỉ email đã bị chặn trong danh sách đen."),
      ).toBeInTheDocument();

      rerender(<ErrorState message="MERCHANT_NOT_ACTIVE" />);
      expect(screen.getByText("Cửa hàng đã bị tạm ngưng hoạt động.")).toBeInTheDocument();
    });
  });
});
