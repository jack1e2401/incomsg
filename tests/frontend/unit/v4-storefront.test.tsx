// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let storefrontFetchHandler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
let commerceFetchHandler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
let milestone2FetchHandler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

vi.mock("../../../apps/frontend/src/api/storefront-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../apps/frontend/src/api/storefront-client")>();
  return {
    ...actual,
    createStorefrontClient: (baseUrl: string, fetcher?: typeof fetch) =>
      actual.createStorefrontClient(baseUrl, (input, init) => {
        if (storefrontFetchHandler) return storefrontFetchHandler(input, init);
        return (fetcher ?? fetch)(input, init);
      }),
  };
});

vi.mock("../../../apps/frontend/src/api/commerce-http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../apps/frontend/src/api/commerce-http")>();
  return {
    ...actual,
    createCommerceClient: (baseUrl: string, fetcher?: typeof fetch) =>
      actual.createCommerceClient(baseUrl, (input, init) => {
        if (commerceFetchHandler) return commerceFetchHandler(input, init);
        return (fetcher ?? fetch)(input, init);
      }),
  };
});

vi.mock("../../../apps/frontend/src/api/milestone2-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../apps/frontend/src/api/milestone2-client")>();
  return {
    ...actual,
    createMilestone2Client: (baseUrl: string, fetcher?: typeof fetch) =>
      actual.createMilestone2Client(baseUrl, (input, init) => {
        if (milestone2FetchHandler) return milestone2FetchHandler(input, init);
        return (fetcher ?? fetch)(input, init);
      }),
  };
});

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { AuthSessionProvider } from "../../../apps/frontend/src/api/auth-session";
import type { StorefrontConfig } from "../../../apps/frontend/src/api/storefront-types";
import { LoginPage, RegisterPage } from "../../../apps/frontend/src/features/auth/AuthPages";
import { MerchantStorefrontEditor } from "../../../apps/frontend/src/features/storefront/MerchantStorefrontEditor";
import { PublicStorefrontPage } from "../../../apps/frontend/src/features/storefront/PublicStorefrontPage";

function buildConfig(overrides: Partial<StorefrontConfig> = {}): StorefrontConfig {
  return {
    branding: {
      logoUrl: null,
      bannerUrl: null,
      primaryColor: "#335e3d",
      heroTitle: "Tiệm Cà Phê Mộc",
      heroDescription: "Hương vị nguyên bản mỗi ngày.",
      heroImageUrl: null,
      heroCtaText: "Mua ngay",
      heroCtaLink: "/s/ca-phe-moc",
      footerDescription: "Cảm ơn bạn đã ghé thăm.",
      contactEmail: "moc@example.com",
      contactPhone: "0901234567",
      address: "123 Lê Lợi, Q1",
      allowedLinks: [{ label: "Trang chủ", url: "/s/ca-phe-moc" }],
    },
    sections: [
      { key: "hero", enabled: true, order: 0, title: null, subtitle: null },
      { key: "featured_products", enabled: true, order: 1, title: "Món nổi bật", subtitle: null },
      { key: "categories", enabled: true, order: 2, title: "Danh mục", subtitle: null },
      { key: "upcoming_events", enabled: true, order: 3, title: "Sự kiện", subtitle: null },
      { key: "store_info", enabled: true, order: 4, title: "Liên hệ", subtitle: null },
      { key: "footer", enabled: true, order: 5, title: null, subtitle: null },
    ],
    featuredProductIds: [11],
    ...overrides,
  };
}

function LocationEcho() {
  const location = useLocation();
  return <div data-testid="location-echo">{`${location.pathname}${location.search}`}</div>;
}

describe("V4 Storefront UI & Auth returnTo/slug", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders PublicStorefrontPage sections in configured order and hides disabled sections", async () => {
    const config = buildConfig({
      sections: [
        { key: "featured_products", enabled: true, order: 0, title: "Món đặc biệt", subtitle: null },
        { key: "hero", enabled: true, order: 1, title: null, subtitle: null },
        { key: "categories", enabled: false, order: 2, title: "Danh mục ẩn", subtitle: null },
        { key: "upcoming_events", enabled: true, order: 3, title: "Sự kiện Mộc", subtitle: null },
        { key: "store_info", enabled: true, order: 4, title: "Thông tin Mộc", subtitle: null },
        { key: "footer", enabled: true, order: 5, title: null, subtitle: null },
      ],
    });

    storefrontFetchHandler = async (input) => {
      const url = String(input);
      if (url.includes("/api/public/stores/ca-phe-moc")) {
        return Response.json({
          merchant: { id: 5, name: "Cà Phê Mộc", slug: "ca-phe-moc" },
          version: {
            id: 1,
            version: 1,
            isPublished: true,
            source: "DEFAULT_INIT",
            sourceVersionId: null,
            note: null,
            publishedById: 1,
            publishedAt: "2026-11-16T00:00:00.000Z",
          },
          config,
          featuredProducts: [
            {
              id: 11,
              merchantId: 5,
              categoryId: null,
              category: null,
              sku: "CF-01",
              name: "Bạc Xỉu Đá",
              description: "Béo ngậy",
              imageUrl: null,
              kind: "SALE",
              status: "ACTIVE",
              price: "39000",
              inventory: { availableQuantity: 8 },
            },
          ],
          categories: [{ id: 1, merchantId: 5, name: "Cà phê", slug: "ca-phe", description: null, sortOrder: 0 }],
          upcomingEvents: [],
        });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    };

    render(
      <AuthSessionProvider>
        <MemoryRouter initialEntries={["/s/ca-phe-moc"]}>
          <Routes>
            <Route path="/s/:slug" element={<PublicStorefrontPage />} />
          </Routes>
        </MemoryRouter>
      </AuthSessionProvider>,
    );

    const featuredHeading = await screen.findByRole("heading", { name: "Món đặc biệt" });
    const heroHeading = screen.getByRole("heading", { name: "Tiệm Cà Phê Mộc" });
    expect(screen.getByText("Bạc Xỉu Đá")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Danh mục ẩn" })).not.toBeInTheDocument();
    expect(
      featuredHeading.compareDocumentPosition(heroHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("loads MerchantStorefrontEditor, saves draft, publishes, and rolls back", async () => {
    const sessionData = JSON.stringify({
      accessToken: "merchant-token",
      user: { id: 10, email: "owner@moc.local", role: "MERCHANT", isActive: true },
    });
    sessionStorage.setItem("loyalty.m2.session", sessionData);

    const initialConfig = buildConfig();
    let publishedVersion = 1;
    let draftSaveCount = 0;

    storefrontFetchHandler = async (input, init) => {
      const url = String(input);
      if (url.endsWith("/api/merchant/storefront") && (!init?.method || init.method === "GET")) {
        return Response.json({
          merchant: { id: 5, name: "Cà Phê Mộc", slug: "ca-phe-moc", isActive: true },
          draft: { config: initialConfig, updatedAt: "2026-11-16T00:00:00.000Z" },
          published: {
            id: 1,
            version: 1,
            isPublished: true,
            source: "DEFAULT_INIT",
            sourceVersionId: null,
            note: null,
            publishedById: 10,
            publishedAt: "2026-11-16T00:00:00.000Z",
          },
        });
      }
      if (url.endsWith("/api/merchant/storefront/versions")) {
        return Response.json({
          versions:
            publishedVersion === 1
              ? [
                  {
                    id: 1,
                    version: 1,
                    isPublished: true,
                    source: "DEFAULT_INIT",
                    sourceVersionId: null,
                    note: null,
                    publishedById: 10,
                    publishedAt: "2026-11-16T00:00:00.000Z",
                  },
                ]
              : [
                  {
                    id: 2,
                    version: 2,
                    isPublished: true,
                    source: "PUBLISH",
                    sourceVersionId: null,
                    note: "Mới",
                    publishedById: 10,
                    publishedAt: "2026-11-16T01:00:00.000Z",
                  },
                  {
                    id: 1,
                    version: 1,
                    isPublished: false,
                    source: "DEFAULT_INIT",
                    sourceVersionId: null,
                    note: null,
                    publishedById: 10,
                    publishedAt: "2026-11-16T00:00:00.000Z",
                  },
                ],
        });
      }
      if (url.endsWith("/api/merchant/storefront/draft") && init?.method === "PUT") {
        draftSaveCount += 1;
        return Response.json({
          draft: { config: JSON.parse(String(init.body)), updatedAt: "2026-11-16T00:30:00.000Z" },
        });
      }
      if (url.endsWith("/api/merchant/storefront/publish") && init?.method === "POST") {
        publishedVersion = 2;
        return Response.json(
          {
            published: {
              id: 2,
              version: 2,
              isPublished: true,
              source: "PUBLISH",
              sourceVersionId: null,
              note: "Mới",
              publishedById: 10,
              publishedAt: "2026-11-16T01:00:00.000Z",
            },
            draft: { config: initialConfig, updatedAt: "2026-11-16T00:30:00.000Z" },
          },
          { status: 201 },
        );
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    };

    commerceFetchHandler = async () =>
      Response.json({
        items: [
          {
            id: 11,
            merchantId: 5,
            categoryId: null,
            category: null,
            sku: "SKU-11",
            name: "Bạc Xỉu Đá",
            description: null,
            richDescription: null,
            imageUrl: null,
            images: [],
            lowStockThreshold: 5,
            isLowStock: false,
            kind: "SALE",
            status: "ACTIVE",
            price: "39000",
            inventory: { availableQuantity: 8 },
          },
        ],
        pagination: { page: 1, limit: 100, totalItems: 1, totalPages: 1 },
      });

    render(
      <AuthSessionProvider>
        <MemoryRouter initialEntries={["/merchant/storefront"]}>
          <Routes>
            <Route path="/merchant/storefront" element={<MerchantStorefrontEditor />} />
          </Routes>
        </MemoryRouter>
      </AuthSessionProvider>,
    );

    await screen.findByRole("heading", { name: "Giao diện cửa hàng" });
    fireEvent.click(screen.getByRole("button", { name: /Lưu bản nháp/i }));
    await screen.findByText("Đã lưu bản nháp thành công.");
    expect(draftSaveCount).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: /Xuất bản/i }));
    await screen.findByText("Đã xuất bản phiên bản v2.");
    expect(screen.getByRole("button", { name: /Khôi phục phiên bản này/i })).toBeInTheDocument();
  });

  it("honors safe relative returnTo on LoginPage and rejects protocol-relative //evil.com", async () => {
    milestone2FetchHandler = async () =>
      Response.json({
        accessToken: "member-jwt",
        user: { id: 3, email: "member@example.com", role: "MEMBER", isActive: true },
      });

    render(
      <AuthSessionProvider>
        <MemoryRouter initialEntries={["/login?returnTo=%2Fs%2Fca-phe-moc%2Fcart"]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/s/:slug/cart" element={<LocationEcho />} />
          </Routes>
        </MemoryRouter>
      </AuthSessionProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText("ban@example.com"), {
      target: { value: "member@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Nhập mật khẩu"), {
      target: { value: "member-password-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Đăng nhập/i }));

    await waitFor(() => {
      expect(screen.getByTestId("location-echo")).toHaveTextContent("/s/ca-phe-moc/cart");
    });

    cleanup();
    sessionStorage.clear();

    render(
      <AuthSessionProvider>
        <MemoryRouter initialEntries={["/login?returnTo=%2F%2Fevil.com"]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/member" element={<LocationEcho />} />
          </Routes>
        </MemoryRouter>
      </AuthSessionProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText("ban@example.com"), {
      target: { value: "member@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Nhập mật khẩu"), {
      target: { value: "member-password-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Đăng nhập/i }));

    await waitFor(() => {
      expect(screen.getByTestId("location-echo")).toHaveTextContent("/member");
    });
  });

  it("allows Merchant registration with optional slug on RegisterPage", async () => {
    let submittedBody: Record<string, unknown> | null = null;
    milestone2FetchHandler = async (_input, init) => {
      submittedBody = JSON.parse(String(init?.body));
      return Response.json(
        {
          user: { id: 20, email: "shop@example.com", role: "MERCHANT", isActive: false },
          application: {
            id: 9,
            applicantId: 20,
            storeName: "Tiệm Trà Mộc",
            slug: "tiem-tra-moc",
            status: "PENDING",
            reviewedById: null,
            reviewedAt: null,
          },
        },
        { status: 201 },
      );
    };

    render(
      <AuthSessionProvider>
        <MemoryRouter initialEntries={["/register"]}>
          <Routes>
            <Route path="/register" element={<RegisterPage />} />
          </Routes>
        </MemoryRouter>
      </AuthSessionProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Merchant/i }));
    fireEvent.change(screen.getByPlaceholderText("Tên cửa hàng của bạn"), {
      target: { value: "Tiệm Trà Mộc" },
    });
    fireEvent.change(screen.getByPlaceholderText("vd: ca-phe-moc"), {
      target: { value: "tiem-tra-moc" },
    });
    fireEvent.change(screen.getByPlaceholderText("ban@example.com"), {
      target: { value: "shop@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Tạo mật khẩu mạnh"), {
      target: { value: "a-very-strong-password-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Gửi hồ sơ Merchant/i }));

    await screen.findByText(/Đường dẫn dự kiến: \/s\/tiem-tra-moc/);
    expect(submittedBody).toEqual({
      email: "shop@example.com",
      password: "a-very-strong-password-123",
      storeName: "Tiệm Trà Mộc",
      slug: "tiem-tra-moc",
    });
  });
});
