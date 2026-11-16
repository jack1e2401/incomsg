// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockFetchHandler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

vi.mock("../../../apps/frontend/src/api/events-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../apps/frontend/src/api/events-client")>();
  return {
    ...actual,
    createEventsClient: (baseUrl = "http://localhost:3000", fetcher?: typeof fetch) => {
      return actual.createEventsClient(baseUrl, (input, init) => {
        if (mockFetchHandler) return mockFetchHandler(input, init);
        return (fetcher ?? fetch)(input, init);
      });
    },
  };
});

vi.mock("../../../apps/frontend/src/api/commerce-http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../apps/frontend/src/api/commerce-http")>();
  return {
    ...actual,
    createCommerceClient: (baseUrl = "http://localhost:3000", fetcher?: typeof fetch) => {
      return actual.createCommerceClient(baseUrl, (input, init) => {
        if (mockFetchHandler) return mockFetchHandler(input, init);
        return (fetcher ?? fetch)(input, init);
      });
    },
  };
});

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthSessionProvider } from "../../../apps/frontend/src/api/auth-session";
import { MerchantEventsPage } from "../../../apps/frontend/src/features/events/MerchantEventsPage";
import { PublicEventsPage } from "../../../apps/frontend/src/features/events/PublicEventsPage";
import { PublicEventDetailPage } from "../../../apps/frontend/src/features/events/PublicEventDetailPage";
import type { MerchantEventDto } from "../../../apps/frontend/src/api/events-types";

const draftEvent: MerchantEventDto = {
  id: 10,
  merchantId: 2,
  title: "Workshop Pha Chế",
  slug: "workshop-pha-che",
  description: "Giới thiệu hạt mới\nDùng thử miễn phí",
  bannerUrl: "/images/independent-cafe.jpg",
  startAt: "2026-12-01T02:00:00.000Z",
  endAt: "2026-12-01T04:00:00.000Z",
  locationName: "Quán Mộc Quận 1",
  locationAddress: "123 Lê Lợi",
  status: "DRAFT",
  publishedAt: null,
  createdAt: "2026-11-16T01:00:00.000Z",
  updatedAt: "2026-11-16T01:00:00.000Z",
};

const publishedEvent: MerchantEventDto = {
  ...draftEvent,
  id: 11,
  title: "Đêm Nhạc Acoustic",
  slug: "dem-nhac-acoustic",
  description: "Nhạc sống cuối tuần\n<script>alert(1)</script>",
  status: "PUBLISHED",
  publishedAt: "2026-11-16T02:00:00.000Z",
};

function renderMerchantEvents() {
  const sessionData = JSON.stringify({
    accessToken: "merchant-token",
    user: { id: 7, email: "owner@moc.local", role: "MERCHANT", isActive: true },
  });
  sessionStorage.setItem("loyalty.m2.session", sessionData);
  return render(
    <AuthSessionProvider>
      <MemoryRouter initialEntries={["/merchant/events"]}>
        <Routes>
          <Route path="/merchant/events" element={<MerchantEventsPage />} />
        </Routes>
      </MemoryRouter>
    </AuthSessionProvider>,
  );
}

describe("V4 Events UI", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders merchant events with badges, filters, create validation, publish and delete draft", async () => {
    const calls: { method: string; url: string; body?: unknown }[] = [];

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({
        method,
        url,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });

      if (url.includes("/api/merchant/me")) {
        return Response.json({ merchant: { id: 2, name: "Mộc Cafe", slug: "moc-cafe", isActive: true } });
      }
      if (url.includes("/api/merchant/events/10/publish") && method === "POST") {
        return Response.json({ event: { ...draftEvent, status: "PUBLISHED" } });
      }
      if (url.includes("/api/merchant/events/10") && method === "DELETE") {
        return Response.json({ deleted: true });
      }
      if (url.endsWith("/api/merchant/events") && method === "POST") {
        return Response.json({ event: draftEvent }, { status: 201 });
      }
      if (url.includes("/api/merchant/events") && method === "GET") {
        return Response.json({
          items: [draftEvent, publishedEvent],
          pagination: { page: 1, limit: 10, totalItems: 2, totalPages: 1 },
        });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMerchantEvents();

    await waitFor(() => {
      expect(screen.getByText("Workshop Pha Chế")).toBeInTheDocument();
      expect(screen.getByText("Đêm Nhạc Acoustic")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Nháp").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Đã xuất bản").length).toBeGreaterThanOrEqual(2);

    // Delete button appears only for DRAFT event (1 button)
    expect(screen.getAllByRole("button", { name: "Xóa" })).toHaveLength(1);

    // Filter by status
    fireEvent.change(screen.getByLabelText("Lọc theo trạng thái"), { target: { value: "DRAFT" } });
    await waitFor(() => {
      expect(calls.some((c) => c.url.includes("status=DRAFT"))).toBe(true);
    });

    // Open create modal and test schedule validation + valid submit
    fireEvent.click(screen.getByRole("button", { name: /Tạo sự kiện/i }));
    fireEvent.change(screen.getByLabelText(/Tiêu đề sự kiện/i), { target: { value: "Sự kiện mới" } });
    fireEvent.change(screen.getByLabelText(/Thời gian bắt đầu/i), { target: { value: "2026-12-05T10:00" } });
    fireEvent.change(screen.getByLabelText(/Thời gian kết thúc/i), { target: { value: "2026-12-05T09:00" } });
    fireEvent.change(screen.getByLabelText(/Tên địa điểm/i), { target: { value: "Quán Mộc" } });
    fireEvent.change(screen.getByLabelText(/Mô tả sự kiện/i), { target: { value: "Mô tả chi tiết" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo bản nháp" }));

    await waitFor(() => {
      expect(screen.getByText("Thời gian kết thúc phải sau thời gian bắt đầu.")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Thời gian kết thúc/i), { target: { value: "2026-12-05T12:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo bản nháp" }));

    await waitFor(() => {
      expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/api/merchant/events"))).toBe(true);
    });

    // Publish draft
    const publishBtn = await screen.findByRole("button", { name: "Xuất bản" });
    fireEvent.click(publishBtn);
    await waitFor(() => {
      expect(calls.some((c) => c.method === "POST" && c.url.includes("/api/merchant/events/10/publish"))).toBe(
        true,
      );
    });

    // Delete draft confirmation dialog
    const deleteBtn = await screen.findByRole("button", { name: "Xóa" });
    fireEvent.click(deleteBtn);
    await waitFor(() => {
      expect(screen.getByText("Xóa bản nháp sự kiện?")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Xóa bản nháp" }));
    await waitFor(() => {
      expect(calls.some((c) => c.method === "DELETE" && c.url.includes("/api/merchant/events/10"))).toBe(true);
    });
  });

  it("renders PublicEventsPage with store context, scope filter, and links", async () => {
    const requestedUrls: string[] = [];
    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      return Response.json({
        merchant: { id: 2, name: "Tiệm Cà Phê Mộc", slug: "moc-cafe" },
        items: [publishedEvent],
        pagination: { page: 1, limit: 12, totalItems: 1, totalPages: 1 },
      });
    });

    render(
      <MemoryRouter initialEntries={["/s/moc-cafe/events"]}>
        <Routes>
          <Route path="/s/:slug/events" element={<PublicEventsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Sự kiện tại Tiệm Cà Phê Mộc")).toBeInTheDocument();
      expect(screen.getByText("Đêm Nhạc Acoustic")).toBeInTheDocument();
    });

    const detailLink = screen.getByRole("link", { name: /Xem chi tiết/i });
    expect(detailLink).toHaveAttribute("href", "/s/moc-cafe/events/dem-nhac-acoustic");

    fireEvent.click(screen.getByRole("tab", { name: "Đã qua" }));
    await waitFor(() => {
      expect(requestedUrls.some((u) => u.includes("scope=past"))).toBe(true);
    });
  });

  it("renders PublicEventDetailPage with safe plain-text description and back navigation", async () => {
    mockFetchHandler = vi.fn().mockImplementation(async () => {
      return Response.json({
        merchant: { id: 2, name: "Tiệm Cà Phê Mộc", slug: "moc-cafe" },
        event: publishedEvent,
      });
    });

    const { container } = render(
      <MemoryRouter initialEntries={["/s/moc-cafe/events/dem-nhac-acoustic"]}>
        <Routes>
          <Route path="/s/:slug/events/:eventSlug" element={<PublicEventDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Đêm Nhạc Acoustic" })).toBeInTheDocument();
    });
    expect(screen.getByText(/Quán Mộc Quận 1/)).toBeInTheDocument();
    expect(screen.getByText(/<script>alert\(1\)<\/script>/)).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByRole("link", { name: /Tất cả sự kiện/i })).toHaveAttribute("href", "/s/moc-cafe/events");
    expect(screen.getByRole("link", { name: /Quay lại cửa hàng/i })).toHaveAttribute("href", "/s/moc-cafe");
  });
});
