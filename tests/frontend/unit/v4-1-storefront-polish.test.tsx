// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let storefrontFetchHandler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
let commerceFetchHandler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
let analyticsFetchHandler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

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

vi.mock("../../../apps/frontend/src/api/analytics-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../apps/frontend/src/api/analytics-client")>();
  return {
    ...actual,
    createAnalyticsClient: (baseUrl: string, fetcher?: typeof fetch) =>
      actual.createAnalyticsClient(baseUrl, (input, init) => {
        if (analyticsFetchHandler) return analyticsFetchHandler(input, init);
        return (fetcher ?? fetch)(input, init);
      }),
  };
});

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { AuthSessionProvider } from "../../../apps/frontend/src/api/auth-session";
import { MemberVouchers } from "../../../apps/frontend/src/features/member/BackendMemberPages";
import { PublicProductDetail } from "../../../apps/frontend/src/features/member/PublicProductDetail";
import { LegacyMemberRedirect } from "../../../apps/frontend/src/features/storefront/LegacyMemberRedirect";
import { PublicStorefrontPage } from "../../../apps/frontend/src/features/storefront/PublicStorefrontPage";
import { StorefrontProductsPage } from "../../../apps/frontend/src/features/storefront/StorefrontProductsPage";
import { StorefrontProfilePage } from "../../../apps/frontend/src/features/storefront/StorefrontProfilePage";
import { StorefrontAuthGate, StorefrontShellLayout } from "../../../apps/frontend/src/features/storefront/StorefrontShellLayout";

function LocationEcho() {
  const location = useLocation();
  return <div data-testid="location-echo">{`${location.pathname}${location.search}`}</div>;
}

const sampleStorefront = {
  merchant: { id: 5, name: "Tiệm Cà Phê Mộc", slug: "ca-phe-moc" },
  version: {
    id: 1,
    version: 1,
    isPublished: true,
    source: "PUBLISH",
    sourceVersionId: null,
    note: null,
    publishedById: 1,
    publishedAt: "2026-11-16T00:00:00.000Z",
  },
  config: {
    branding: {
      logoUrl: null,
      bannerUrl: null,
      primaryColor: "#335e3d",
      heroTitle: "Hương vị cà phê nguyên bản",
      heroDescription: "Rang mộc mỗi sáng.",
      heroImageUrl: null,
      heroCtaText: "Khám phá thực đơn",
      heroCtaLink: "/s/ca-phe-moc",
      footerDescription: "Cà Phê Mộc",
      contactEmail: "moc@example.com",
      contactPhone: "0901234567",
      address: "123 Lê Lợi",
      allowedLinks: [{ label: "Trang chủ", url: "/s/ca-phe-moc" }],
    },
    sections: [
      { key: "hero", enabled: true, order: 0, title: null, subtitle: null },
      { key: "featured_products", enabled: true, order: 1, title: "Món nổi bật", subtitle: null },
      { key: "categories", enabled: true, order: 2, title: "Danh mục", subtitle: null },
      { key: "upcoming_events", enabled: true, order: 3, title: "Sự kiện", subtitle: null },
      { key: "store_info", enabled: true, order: 4, title: "Thông tin", subtitle: null },
      { key: "footer", enabled: true, order: 5, title: null, subtitle: null },
    ],
    featuredProductIds: [11],
  },
  featuredProducts: [
    {
      id: 11,
      merchantId: 5,
      categoryId: 1,
      category: { id: 1, name: "Cà phê", slug: "ca-phe" },
      sku: "CF-01",
      name: "Cold Brew Cam Sả",
      description: "Thanh mát",
      imageUrl: null,
      kind: "SALE",
      status: "ACTIVE",
      price: "49000",
      inventory: { availableQuantity: 8 },
    },
  ],
  categories: [
    { id: 1, merchantId: 5, name: "Cà phê", slug: "ca-phe", description: null, sortOrder: 0 },
    { id: 2, merchantId: 5, name: "Bánh ngọt", slug: "banh-ngot", description: null, sortOrder: 1 },
  ],
  upcomingEvents: [],
};

describe("V4.1 Storefront UI Polish & Routing", () => {
  beforeEach(() => {
    sessionStorage.clear();
    analyticsFetchHandler = async () =>
      Response.json({ membership: { id: 1, merchantId: 5, memberId: 2, tier: "UNRANKED", createdAt: "" }, created: false });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps the same unified Mini-App header and 5-tab bottom navigation across Storefront Home, Products, Vouchers, and Profile", async () => {
    sessionStorage.setItem(
      "loyalty.m2.session",
      JSON.stringify({
        accessToken: "member-jwt",
        user: { id: 2, email: "member@moc.local", role: "MEMBER", isActive: true },
      }),
    );

    storefrontFetchHandler = async () => Response.json(sampleStorefront);
    commerceFetchHandler = async (input) => {
      const url = String(input);
      if (url.includes("/api/public/stores/ca-phe-moc/products")) {
        return Response.json({
          items: [
            {
              ...sampleStorefront.featuredProducts[0],
              richDescription: null,
              images: [],
              lowStockThreshold: 5,
              isLowStock: false,
            },
          ],
          categories: sampleStorefront.categories,
          pagination: { page: 1, limit: 12, totalItems: 1, totalPages: 1 },
        });
      }
      if (url.includes("/api/merchants/5/vouchers")) {
        return Response.json({ definitions: [] });
      }
      if (url.includes("/api/member/merchants/5/vouchers")) {
        return Response.json({ vouchers: [] });
      }
      if (url.includes("/api/member/merchants/5/wallet")) {
        return Response.json({
          wallet: {
            merchantId: 5,
            availablePoints: 13,
            lifetimeEarnedPoints: 13,
            exactBalance: "13",
            fractionalCarry: "0",
            pointDebt: "0",
            netLifetimeEarned: "13",
            tier: "BRONZE",
            policy: { merchantId: 5, vndPerPoint: 10000, isActive: true, tiers: [] },
            transactions: [],
          },
        });
      }
      return Response.json({ error: "Unhandled" }, { status: 404 });
    };

    render(
      <AuthSessionProvider>
        <MemoryRouter initialEntries={["/s/ca-phe-moc"]}>
          <Routes>
            <Route path="/s/:slug" element={<StorefrontShellLayout />}>
              <Route index element={<PublicStorefrontPage />} />
              <Route path="products" element={<StorefrontProductsPage />} />
              <Route path="profile" element={<StorefrontProfilePage />} />
              <Route element={<StorefrontAuthGate />}>
                <Route path="vouchers" element={<MemberVouchers />} />
              </Route>
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthSessionProvider>,
    );

    await screen.findByRole("heading", { name: "Hương vị cà phê nguyên bản" });
    const bottomNav = screen.getByRole("navigation", { name: "Điều hướng Mini App" });
    expect(bottomNav).toHaveTextContent("Trang chủ");
    expect(bottomNav).toHaveTextContent("Sản phẩm");
    expect(bottomNav).toHaveTextContent("Ưu đãi");
    expect(bottomNav).toHaveTextContent("Ví điểm");
    expect(bottomNav).toHaveTextContent("Cá nhân");

    // Verify 2-column mobile product grid class exists
    const grid = document.querySelector("#featured-products .grid-cols-2");
    expect(grid).not.toBeNull();

    // Switch to Ưu đãi tab -> stays inside exact same bottom nav shell
    fireEvent.click(screen.getAllByRole("link", { name: "Ưu đãi" })[0]!);
    await screen.findByRole("heading", { name: "Voucher & Ưu đãi" });
    expect(screen.getByRole("navigation", { name: "Điều hướng Mini App" })).toBeInTheDocument();

    // Switch to Cá nhân tab -> renders profile wrapper without legacy links
    fireEvent.click(screen.getAllByRole("link", { name: "Cá nhân" })[0]!);
    await screen.findByText("member@moc.local");
    expect(screen.getByRole("link", { name: /Đơn hàng của tôi/i })).toHaveAttribute("href", "/s/ca-phe-moc/orders");
  });

  it("redirects legacy /member/:merchantId routes safely to /s/:slug/*", async () => {
    commerceFetchHandler = async () =>
      Response.json({
        merchants: [{ id: 5, name: "Tiệm Cà Phê Mộc", slug: "ca-phe-moc" }],
      });

    render(
      <AuthSessionProvider>
        <MemoryRouter initialEntries={["/member/5/product/11?from=old"]}>
          <Routes>
            <Route path="/member/:merchantId/*" element={<LegacyMemberRedirect />} />
            <Route path="/s/:slug/*" element={<LocationEcho />} />
          </Routes>
        </MemoryRouter>
      </AuthSessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("location-echo")).toHaveTextContent("/s/ca-phe-moc/products/11?from=old");
    });
  });

  it("keeps Product Detail inside /s/:slug namespace and never links to /member/", async () => {
    sessionStorage.setItem(
      "loyalty.m2.session",
      JSON.stringify({
        accessToken: "member-jwt",
        user: { id: 2, email: "member@moc.local", role: "MEMBER", isActive: true },
      }),
    );

    storefrontFetchHandler = async () => Response.json(sampleStorefront);
    commerceFetchHandler = async () =>
      Response.json({
        product: {
          ...sampleStorefront.featuredProducts[0],
          richDescription: "Chi tiết hạt cà phê",
          images: [],
          lowStockThreshold: 5,
          isLowStock: false,
        },
      });

    render(
      <AuthSessionProvider>
        <MemoryRouter initialEntries={["/s/ca-phe-moc/products/11?categoryId=1"]}>
          <Routes>
            <Route path="/s/:slug" element={<StorefrontShellLayout />}>
              <Route path="products/:productId" element={<PublicProductDetail />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthSessionProvider>,
    );

    await screen.findByRole("heading", { name: "Cold Brew Cam Sả" });
    expect(screen.getByRole("link", { name: /Quay lại danh sách sản phẩm/i })).toHaveAttribute(
      "href",
      "/s/ca-phe-moc/products?categoryId=1",
    );

    fireEvent.click(screen.getByRole("button", { name: /Thêm vào giỏ/i }));
    const viewCartLink = await screen.findByRole("link", { name: "Xem giỏ hàng" });
    expect(viewCartLink).toHaveAttribute("href", "/s/ca-phe-moc/cart");
  });
});
