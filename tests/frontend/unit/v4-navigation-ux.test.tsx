// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
const { storeClient, analyticsClient, commerceClient } = vi.hoisted(() => ({ storeClient: { getPublicStorefront: vi.fn(), getPreview: vi.fn() }, analyticsClient: { ensureStoreMembershipBySlug: vi.fn() }, commerceClient: { getOwnMerchant: vi.fn() } }));
vi.mock("../../../apps/frontend/src/api/storefront-client", async (load) => ({ ...(await load<typeof import("../../../apps/frontend/src/api/storefront-client")>()), createStorefrontClient: () => storeClient }));
vi.mock("../../../apps/frontend/src/api/analytics-client", () => ({ createAnalyticsClient: () => analyticsClient }));
vi.mock("../../../apps/frontend/src/api/commerce-http", async (load) => ({ ...(await load<typeof import("../../../apps/frontend/src/api/commerce-http")>()), createCommerceClient: () => commerceClient }));
import { Breadcrumbs } from "../../../apps/frontend/src/components/ui/Breadcrumbs";
import { RewardsHubLayout } from "../../../apps/frontend/src/features/storefront/RewardsHubLayout";
import { StorefrontShellLayout } from "../../../apps/frontend/src/features/storefront/StorefrontShellLayout";
import { BackendConsoleLayout } from "../../../apps/frontend/src/layouts/BackendConsoleLayout";
import { AuthSessionProvider } from "../../../apps/frontend/src/api/auth-session";

function Parent() { return <Outlet context={{ basePath: "/s/moc", slug: "moc", merchantId: 1, accent: "#335e3d", storefront: { merchant: { name: "Cà Phê Mộc" } }, cart: {} }} />; }

describe("V4 navigation UX", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); sessionStorage.clear(); });

  it.each(["challenges", "vouchers", "rewards"])("highlights Săn thưởng on both navs at /%s", async (route) => {
    storeClient.getPublicStorefront.mockResolvedValue({ merchant: { id: 5, name: "Cà Phê Mộc", slug: "moc" }, config: { branding: { primaryColor: "#335e3d", logoUrl: null } }, featuredProducts: [], categories: [], upcomingEvents: [] });
    render(<AuthSessionProvider><MemoryRouter initialEntries={[`/s/moc/${route}`]}><Routes><Route path="/s/:slug" element={<StorefrontShellLayout />}><Route path="challenges" element={<span>Nhiệm vụ</span>} /><Route path="vouchers" element={<span>Ưu đãi</span>} /><Route path="rewards" element={<span>Đổi quà</span>} /></Route></Routes></MemoryRouter></AuthSessionProvider>);
    const tabs = await screen.findAllByRole("link", { name: "Săn thưởng" });
    expect(tabs).toHaveLength(2);
    tabs.forEach((tab) => expect(tab.className).toContain("bg-[#e8f1e2]"));
    expect(screen.getAllByRole("link", { name: "Trang chủ" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Sản phẩm" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Ví điểm" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Cá nhân" })).toHaveLength(2);
  });

  it("keeps rewards subnavigation URL driven and highlights the active route", () => {
    sessionStorage.setItem("loyalty.m2.session", JSON.stringify({ accessToken: "token", user: { id: 1, email: "member@example.com", role: "MEMBER", isActive: true } }));
    render(<AuthSessionProvider><MemoryRouter initialEntries={["/s/moc/rewards"]}><Routes><Route path="/s/:slug" element={<Parent />}><Route element={<RewardsHubLayout />}><Route path="rewards" element={<p>catalog</p>} /></Route></Route></Routes></MemoryRouter></AuthSessionProvider>);
    expect(screen.getByRole("link", { name: "Nhiệm vụ" })).toHaveAttribute("href", "/s/moc/challenges");
    expect(screen.getByRole("link", { name: "Ưu đãi" })).toHaveAttribute("href", "/s/moc/vouchers");
    expect(screen.getByRole("link", { name: "Đổi quà" })).toHaveAttribute("aria-current", "page");
  });

  it("renders desktop breadcrumbs and a shop scoped mobile back link", () => {
    render(<MemoryRouter initialEntries={["/s/moc/products/12"]}><Routes><Route path="/s/:slug/*" element={<Breadcrumbs basePath="/s/moc" merchantName="Cà Phê Mộc" />} /></Routes></MemoryRouter>);
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cà Phê Mộc" })).toHaveAttribute("href", "/s/moc");
    expect(screen.getByRole("link", { name: "Quay lại Sản phẩm" })).toHaveAttribute("href", "/s/moc/products");
    expect(document.body.innerHTML).not.toContain("/member");
  });

  it("keeps Marketing expanded on deep merchant routes with separate Events and Challenges links", async () => {
    sessionStorage.setItem("loyalty.m2.session", JSON.stringify({ accessToken: "token", user: { id: 2, email: "merchant@example.com", role: "MERCHANT", isActive: true } }));
    commerceClient.getOwnMerchant.mockResolvedValue({ merchant: { id: 5, isActive: true } });
    render(<AuthSessionProvider><MemoryRouter initialEntries={["/merchant/challenges/12"]}><Routes><Route path="/merchant" element={<BackendConsoleLayout role="merchant" />}><Route path="challenges/:challengeId" element={<p>Chi tiết nhiệm vụ</p>} /></Route></Routes></MemoryRouter></AuthSessionProvider>);
    expect(await within(screen.getByRole("main")).findByText("Chi tiết nhiệm vụ")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: /Marketing/ })).toHaveAttribute("aria-expanded", "true"));
    const navigation = screen.getByRole("navigation", { name: "Điều hướng chính" });
    expect(within(navigation).getByRole("link", { name: "Sự kiện" })).toHaveAttribute("href", "/merchant/events");
    expect(within(navigation).getByRole("link", { name: "Nhiệm vụ" })).toHaveAttribute("href", "/merchant/challenges");
    expect(navigation).toHaveClass("merchant-sidebar-scroll");
  });

  it("shows an accessible breadcrumb inside the Merchant console", async () => {
    sessionStorage.setItem("loyalty.m2.session", JSON.stringify({ accessToken: "token", user: { id: 2, email: "merchant@example.com", role: "MERCHANT", isActive: true } }));
    commerceClient.getOwnMerchant.mockResolvedValue({ merchant: { id: 5, isActive: true } });
    render(<AuthSessionProvider><MemoryRouter initialEntries={["/merchant/challenges/12"]}><Routes><Route path="/merchant" element={<BackendConsoleLayout role="merchant" />}><Route path="challenges/:challengeId" element={<p>Chi tiết nhiệm vụ</p>} /></Route></Routes></MemoryRouter></AuthSessionProvider>);
    const breadcrumb = await screen.findByRole("navigation", { name: "Breadcrumb" });
    expect(breadcrumb).toHaveTextContent("Tổng quan");
    expect(breadcrumb).toHaveTextContent("Nhiệm vụ");
  });

  it("does not add Merchant breadcrumb UI to the Admin console", () => {
    render(<AuthSessionProvider><MemoryRouter initialEntries={["/admin"]}><Routes><Route path="/admin" element={<BackendConsoleLayout role="admin" />}><Route index element={<p>Admin home</p>} /></Route></Routes></MemoryRouter></AuthSessionProvider>);
    expect(screen.getByText("Admin home")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).not.toBeInTheDocument();
  });

  it.each([
    ["/merchant/challenges/new", "Tạo nhiệm vụ"],
    ["/merchant/challenges/12/edit", "Chỉnh sửa nhiệm vụ"],
    ["/merchant/challenges/12", "Chi tiết nhiệm vụ"],
  ])("shows the correct console title for %s", async (path, expectedTitle) => {
    sessionStorage.setItem("loyalty.m2.session", JSON.stringify({ accessToken: "token", user: { id: 2, email: "merchant@example.com", role: "MERCHANT", isActive: true } }));
    commerceClient.getOwnMerchant.mockResolvedValue({ merchant: { id: 5, isActive: true } });
    render(<AuthSessionProvider><MemoryRouter initialEntries={[path]}><Routes><Route path="/merchant" element={<BackendConsoleLayout role="merchant" />}><Route path="challenges/new" element={<p>Editor page</p>} /><Route path="challenges/:challengeId/edit" element={<p>Editor page</p>} /><Route path="challenges/:challengeId" element={<p>Detail page</p>} /></Route></Routes></MemoryRouter></AuthSessionProvider>);
    await screen.findByText(/(Editor|Detail) page/);
    expect(screen.getByRole("banner")).toHaveTextContent(expectedTitle);
  });

  it("resets merchant content to the top after navigating to a new management page", async () => {
    sessionStorage.setItem("loyalty.m2.session", JSON.stringify({ accessToken: "token", user: { id: 2, email: "merchant@example.com", role: "MERCHANT", isActive: true } }));
    commerceClient.getOwnMerchant.mockResolvedValue({ merchant: { id: 5, isActive: true } });
    render(<AuthSessionProvider><MemoryRouter initialEntries={["/merchant/challenges/12"]}><Routes><Route path="/merchant" element={<BackendConsoleLayout role="merchant" />}><Route path="challenges" element={<p>Danh sách nhiệm vụ</p>} /><Route path="challenges/:challengeId" element={<p>Chi tiết nhiệm vụ</p>} /></Route></Routes></MemoryRouter></AuthSessionProvider>);
    expect(await within(screen.getByRole("main")).findByText("Chi tiết nhiệm vụ")).toBeInTheDocument();
    document.documentElement.scrollTop = 480;
    fireEvent.click(within(screen.getByRole("navigation", { name: "Điều hướng chính" })).getByRole("link", { name: "Nhiệm vụ" }));
    expect(await screen.findByText("Danh sách nhiệm vụ")).toBeInTheDocument();
    expect(document.documentElement.scrollTop).toBe(0);
  });
});
