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

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { AuthSessionProvider } from "../../../apps/frontend/src/api/auth-session";
import { MerchantProducts } from "../../../apps/frontend/src/features/merchant/MerchantProductsPage";
import { PublicProductDetail } from "../../../apps/frontend/src/features/member/PublicProductDetail";
import type { ProductCategoryDto, ProductDto } from "../../../apps/frontend/src/api/contracts/catalog";

function LocationEcho() {
  const location = useLocation();
  return <div data-testid="location-echo">{`${location.pathname}${location.search}`}</div>;
}

const sampleCategory: ProductCategoryDto = {
  id: 3,
  merchantId: 7,
  name: "Cà phê",
  slug: "ca-phe",
  description: "Đồ uống pha máy",
  sortOrder: 0,
};

const sampleProduct: ProductDto = {
  id: 15,
  merchantId: 7,
  categoryId: 3,
  category: { id: 3, name: "Cà phê", slug: "ca-phe" },
  sku: "CF-MUOI-01",
  name: "Cà phê muối",
  description: "Vị mặn dịu và béo nhẹ.",
  richDescription: "Chiết xuất từ hạt Arabica.\nPhục vụ lạnh hoặc nóng.",
  imageUrl: "/images/cf-1.jpg",
  images: [
    { id: 101, url: "/images/cf-1.jpg", altText: "Ly cà phê chính", sortOrder: 0 },
    { id: 102, url: "/uploads/merchant-7/cf-2.jpg", altText: "Góc nhìn trên", sortOrder: 1 },
  ],
  lowStockThreshold: 5,
  isLowStock: true,
  kind: "SALE",
  price: "45000",
  status: "ACTIVE",
  inventory: { availableQuantity: 3, onHandQuantity: 4, reservedQuantity: 1 },
};

function signInSession(role: "MERCHANT" | "MEMBER") {
  const sessionData = JSON.stringify({
    accessToken: role === "MERCHANT" ? "merchant-jwt" : "member-jwt",
    user: {
      id: role === "MERCHANT" ? 2 : 9,
      email: role === "MERCHANT" ? "merchant@test.local" : "member@test.local",
      role,
      isActive: true,
    },
  });
  sessionStorage.setItem("loyalty.m2.session", sessionData);
}

describe("Workstream B — Product Catalog V2 UI", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders paginated products with SKU, category, low-stock badge, filters, and category CRUD", async () => {
    signInSession("MERCHANT");
    const calls: { url: string; method: string; body?: unknown }[] = [];
    let categories: ProductCategoryDto[] = [sampleCategory];

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method, body });

      if (url.endsWith("/api/merchant/categories") && method === "GET") {
        return Response.json({ categories });
      }
      if (url.endsWith("/api/merchant/categories") && method === "POST") {
        const created: ProductCategoryDto = {
          id: 4,
          merchantId: 7,
          name: body.name,
          slug: "tra-sua",
          description: body.description ?? null,
          sortOrder: body.sortOrder ?? 0,
        };
        categories = [...categories, created];
        return Response.json({ category: created }, { status: 201 });
      }
      if (url.endsWith("/api/merchant/categories/4") && method === "DELETE") {
        categories = categories.filter((c) => c.id !== 4);
        return Response.json({ deleted: true });
      }
      if (url.includes("/api/merchant/products/") && url.includes("/stock/movements")) {
        return Response.json({
          inventory: { onHandQuantity: 4, reservedQuantity: 1, availableQuantity: 3 },
          movements: [],
        });
      }
      if (url.includes("/api/merchant/products") && method === "GET") {
        return Response.json({
          items: [sampleProduct],
          pagination: { page: 1, limit: 20, totalItems: 25, totalPages: 2 },
        });
      }
      if (url.endsWith("/api/merchant/products") && method === "POST") {
        return Response.json(
          {
            product: {
              ...sampleProduct,
              id: 22,
              name: body.name,
              sku: body.sku ?? null,
              isLowStock: false,
            },
          },
          { status: 201 },
        );
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    render(
      <AuthSessionProvider>
        <MemoryRouter initialEntries={["/merchant/products"]}>
          <Routes>
            <Route path="/merchant/products" element={<MerchantProducts />} />
          </Routes>
        </MemoryRouter>
      </AuthSessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Cà phê muối")).toBeInTheDocument();
      expect(screen.getByText("SKU: CF-MUOI-01")).toBeInTheDocument();
      expect(screen.getByText("Sắp hết hàng (≤ 5)")).toBeInTheDocument();
      expect(screen.getByText("Trang 1 / 2 · 25 sản phẩm")).toBeInTheDocument();
    });

    // Toggle Category Manager and create + delete a category
    fireEvent.click(screen.getByRole("button", { name: /quản lý danh mục/i }));
    await waitFor(() => {
      expect(screen.getByText("Danh mục sản phẩm")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /thêm danh mục/i }));
    fireEvent.change(screen.getByLabelText("Tên danh mục"), { target: { value: "Trà sữa" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo danh mục" }));

    await waitFor(() => {
      expect(screen.getAllByText("Trà sữa").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "Xóa danh mục Trà sữa" }));
    await waitFor(() => {
      expect(screen.queryAllByText("Trà sữa")).toHaveLength(0);
    });

    // Apply search + lowStock filter
    fireEvent.change(screen.getByLabelText("Tìm kiếm sản phẩm"), { target: { value: "CF-MUOI" } });
    fireEvent.submit(screen.getByLabelText("Tìm kiếm sản phẩm").closest("form")!);
    fireEvent.click(screen.getByLabelText("Sắp hết hàng"));

    await waitFor(() => {
      expect(
        calls.some((call) => call.url.includes("/api/merchant/products?q=CF-MUOI&lowStock=true")),
      ).toBe(true);
    });

    // Create product with V2 fields + gallery
    fireEvent.click(screen.getByRole("button", { name: "Thêm sản phẩm" }));
    fireEvent.change(screen.getByLabelText("Tên sản phẩm"), { target: { value: "Matcha Latte" } });
    fireEvent.change(screen.getByLabelText("Mã SKU"), { target: { value: "MAT-01" } });
    fireEvent.change(screen.getByLabelText("Giá (VND)"), { target: { value: "55000" } });
    fireEvent.change(screen.getByLabelText("Ngưỡng cảnh báo tồn kho thấp"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("Mô tả chi tiết (plain text)"), {
      target: { value: "Bột Uji Matcha" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Thêm ảnh" }));
    fireEvent.change(screen.getByLabelText("URL ảnh 1"), {
      target: { value: "/uploads/merchant-7/matcha.jpg" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu sản phẩm" }));

    await waitFor(() => {
      const postCall = calls.find((c) => c.url.endsWith("/api/merchant/products") && c.method === "POST");
      expect(postCall).toBeDefined();
      expect(postCall?.body).toMatchObject({
        name: "Matcha Latte",
        sku: "MAT-01",
        price: "55000",
        lowStockThreshold: 8,
        richDescription: "Bột Uji Matcha",
        imageUrl: "/uploads/merchant-7/matcha.jpg",
        images: [{ url: "/uploads/merchant-7/matcha.jpg", altText: null, sortOrder: 0 }],
      });
    });
  });

  it("renders PublicProductDetail with gallery switcher and redirects guest to /login?returnTo=...", async () => {
    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/public/stores/moc-studio/products/15")) {
        return Response.json({ product: sampleProduct });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    render(
      <AuthSessionProvider>
        <MemoryRouter initialEntries={["/s/moc-studio/products/15"]}>
          <Routes>
            <Route path="/s/:slug/products/:productId" element={<PublicProductDetail />} />
            <Route path="/login" element={<LocationEcho />} />
          </Routes>
        </MemoryRouter>
      </AuthSessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Cà phê muối" })).toBeInTheDocument();
      expect(screen.getByText("SKU: CF-MUOI-01")).toBeInTheDocument();
      expect(screen.getByText(/Chiết xuất từ hạt Arabica/)).toBeInTheDocument();
    });

    // Switch gallery image
    const mainImg = screen.getByAltText("Ly cà phê chính") as HTMLImageElement;
    expect(mainImg.src).toContain("/images/cf-1.jpg");
    fireEvent.click(screen.getByRole("button", { name: "Xem ảnh 2" }));
    expect((screen.getByAltText("Góc nhìn trên") as HTMLImageElement).src).toContain(
      "/uploads/merchant-7/cf-2.jpg",
    );

    // Guest Add to Cart redirects to /login?returnTo=...
    fireEvent.click(screen.getByRole("button", { name: /thêm vào giỏ/i }));
    await waitFor(() => {
      expect(screen.getByTestId("location-echo")).toHaveTextContent(
        "/login?returnTo=%2Fs%2Fmoc-studio%2Fproducts%2F15",
      );
    });
  });

  it("allows authenticated Member to add selected quantity to store cart on PublicProductDetail", async () => {
    signInSession("MEMBER");
    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/public/stores/moc-studio/products/15")) {
        return Response.json({ product: sampleProduct });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    render(
      <AuthSessionProvider>
        <MemoryRouter initialEntries={["/s/moc-studio/products/15"]}>
          <Routes>
            <Route path="/s/:slug/products/:productId" element={<PublicProductDetail />} />
          </Routes>
        </MemoryRouter>
      </AuthSessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Cà phê muối" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Số lượng mua"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: /thêm vào giỏ/i }));

    await waitFor(() => {
      expect(screen.getByText("Đã thêm 2 sản phẩm vào giỏ hàng.")).toBeInTheDocument();
    });

    const saved = JSON.parse(sessionStorage.getItem("loyalty.member.cart.9.7") ?? "[]");
    expect(saved).toHaveLength(1);
    expect(saved[0].quantity).toBe(2);
    expect(saved[0].product.id).toBe(15);
  });
});
