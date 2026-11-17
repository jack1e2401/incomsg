// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";

const { publicChallenges, memberChallenges, checkIn, publicDetail, memberDetail, publicVouchers, memberVouchers, wallet } = vi.hoisted(() => ({
  publicChallenges: vi.fn(), memberChallenges: vi.fn(), checkIn: vi.fn(), publicDetail: vi.fn(), memberDetail: vi.fn(),
  publicVouchers: vi.fn(), memberVouchers: vi.fn(), wallet: vi.fn(),
}));
vi.mock("../../../apps/frontend/src/api/challenges-client", () => ({ createChallengesClient: () => ({
  listPublicStoreChallenges: publicChallenges, listMemberStoreChallenges: memberChallenges, checkInStore: checkIn,
  getPublicStoreChallenge: publicDetail, getMemberStoreChallenge: memberDetail,
}) }));
vi.mock("../../../apps/frontend/src/api/commerce-http", () => ({ createCommerceClient: () => ({
  listPublicVoucherDefinitions: publicVouchers, listMemberVouchers: memberVouchers, getMemberWallet: wallet,
  redeemVoucher: vi.fn(),
}) }));

import { AuthSessionProvider } from "../../../apps/frontend/src/api/auth-session";
import { ChallengeHeroCard } from "../../../apps/frontend/src/features/challenges/ChallengeHeroCard";
import { ChallengesPage } from "../../../apps/frontend/src/features/challenges/ChallengesPage";
import { ChallengeDetailPage } from "../../../apps/frontend/src/features/challenges/ChallengeDetailPage";
import { ChallengeMilestonePath } from "../../../apps/frontend/src/features/challenges/ChallengeMilestonePath";
import { MemberVouchers } from "../../../apps/frontend/src/features/member/MemberLoyaltyPages";

const challenge = { id: 9, merchantId: 5, title: "Mua cà phê", description: "Mua đủ đơn", type: "ORDER_COUNT" as const, effectiveStatus: "ACTIVE" as const, targetValue: "3", rewardPoints: "150", startsAt: "2026-11-01T00:00:00Z", endsAt: "2026-12-01T00:00:00Z", isFeatured: true, milestones: [] };
const progress = { currentValue: "2", targetValue: "3", remainingValue: "1", percent: 67, rewardState: "IN_PROGRESS" as const, rewardCycle: 1, completedAt: null, grantedAt: null };
function tree(path: string, element: React.ReactNode, session?: object) {
  if (session) sessionStorage.setItem("loyalty.m2.session", JSON.stringify(session));
  return render(<AuthSessionProvider><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/s/:slug" element={<Context />}><Route index element={element} /><Route path="challenges" element={element} /><Route path="challenges/:challengeId" element={element} /><Route path="vouchers" element={element} /></Route>
    <Route path="/login" element={<div>login</div>} />
  </Routes></MemoryRouter></AuthSessionProvider>);
}
function Context() { return <Outlet context={{ merchantId: 5, basePath: "/s/coffee", cart: {} as never }} />; }
const member = { accessToken: "member-token", user: { id: 1, email: "member@test.local", role: "MEMBER", isActive: true } };
const memberList = { merchant: { id: 5, name: "Coffee", slug: "coffee" }, checkedInToday: false, todayDateKey: "2026-11-17", heroChallenge: { ...challenge, progress }, challenges: [{ ...challenge, progress }] };

describe("V4 member challenges and public discovery", () => {
  beforeEach(() => {
    sessionStorage.clear();
    publicChallenges.mockResolvedValue({ merchant: memberList.merchant, heroChallenge: challenge, challenges: [challenge] });
    memberChallenges.mockResolvedValue(memberList);
    checkIn.mockResolvedValue({ checkedIn: true, alreadyCheckedInToday: false, dateKey: "2026-11-17", updatedChallenges: [] });
    publicDetail.mockResolvedValue({ merchant: memberList.merchant, challenge });
    memberDetail.mockResolvedValue({ merchant: memberList.merchant, checkedInToday: false, todayDateKey: "2026-11-17", challenge: { ...challenge, progress }, recentEntries: [] });
    publicVouchers.mockResolvedValue({ definitions: [{ id: 2, title: "Quà", type: "REWARD", rewardDescription: "Ly nước", pointsCost: 100, discountAmount: null, availableQuantity: 5 }] });
    memberVouchers.mockResolvedValue({ vouchers: [] }); wallet.mockResolvedValue({ wallet: { availablePoints: 500, netLifetimeEarned: 1840 } });
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("renders labeled milestone nodes instead of a generic progress bar", () => {
    render(<ChallengeMilestonePath challenge={challenge} progress={progress} />);

    const milestones = screen.getByRole("list", { name: "Các mốc nhiệm vụ" });
    expect(within(milestones).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("2/3 đơn hàng")).toBeInTheDocument();
    expect(screen.getByText("3 đơn").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("uses merchant configured milestone copy and thresholds on the client journey", () => {
    const configuredChallenge = {
      ...challenge,
      milestones: [
        { position: 1, thresholdValue: "1", title: "Khởi động", description: "Hoàn tất đơn đầu tiên" },
        { position: 2, thresholdValue: "2", title: "Thân quen", description: "Quay lại thêm một lần" },
        { position: 3, thresholdValue: "3", title: "Bạn của quán", description: "Nhận điểm thưởng cuối" },
      ],
    };
    render(<ChallengeMilestonePath challenge={configuredChallenge} progress={progress} />);

    const milestones = screen.getByRole("list", { name: "Các mốc nhiệm vụ" });
    expect(within(milestones).getByText("Khởi động")).toBeInTheDocument();
    expect(within(milestones).getByText("Hoàn tất đơn đầu tiên")).toBeInTheDocument();
    expect(within(milestones).getByText("Bạn của quán").closest("li")).toHaveAttribute("aria-current", "step");
    expect(within(milestones).getByText("3 đơn")).toBeInTheDocument();
  });

  it("shows pending reward and rewarded final node states", () => {
    const dailyChallenge = { ...challenge, type: "DAILY_CHECKIN" as const, targetValue: "2" };
    const completedProgress = { ...progress, currentValue: "2", targetValue: "2", percent: 100 };

    const { rerender } = render(
      <ChallengeMilestonePath
        challenge={dailyChallenge}
        progress={{ ...completedProgress, rewardState: "WAITING_BUDGET" }}
      />,
    );
    expect(screen.getByText("Mục tiêu hoàn thành, đang chờ ngân sách.")).toBeInTheDocument();
    expect(screen.getByText("2 ngày").closest("li")).toHaveAttribute("data-state", "reward-pending");

    rerender(
      <ChallengeMilestonePath
        challenge={dailyChallenge}
        progress={{ ...completedProgress, rewardState: "REWARDED" }}
      />,
    );
    expect(screen.getByText("Đã nhận phần thưởng.")).toBeInTheDocument();
    expect(screen.getByText("2 ngày").closest("li")).toHaveAttribute("data-state", "rewarded");
  });

  it("shows goal and login CTA to guests without progress, and member progress when authenticated", async () => {
    tree("/s/coffee", <ChallengeHeroCard slug="coffee" storeBase="/s/coffee" />);
    expect(await screen.findByText("Mua 3 đơn hàng")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Đăng nhập để bắt đầu" })).toHaveAttribute("href", expect.stringContaining("returnTo"));
    expect(screen.queryByText("0/3")).not.toBeInTheDocument();
    cleanup();
    tree("/s/coffee", <ChallengeHeroCard slug="coffee" storeBase="/s/coffee" />, member);
    expect(await screen.findByText("2/3 đơn hàng")).toBeInTheDocument();
    expect(memberChallenges).toHaveBeenCalledWith("coffee", "member-token");
  });

  it("shows the milestone path on member home, list, and detail while keeping guests progress-free", async () => {
    tree("/s/coffee", <ChallengeHeroCard slug="coffee" storeBase="/s/coffee" />, member);
    const homePath = await screen.findByRole("list", { name: "Các mốc nhiệm vụ" });
    expect(within(homePath).getByText("2 đơn")).toBeInTheDocument();

    cleanup();
    tree("/s/coffee/challenges", <ChallengesPage />, member);
    const listPaths = await screen.findAllByRole("list", { name: "Các mốc nhiệm vụ" });
    expect(listPaths).toHaveLength(1);
    expect(within(listPaths[0]).getByText("2 đơn")).toBeInTheDocument();

    cleanup();
    sessionStorage.clear();
    tree("/s/coffee/challenges", <ChallengesPage />);
    await screen.findByText("Mua cà phê");
    expect(screen.queryByRole("list", { name: "Các mốc nhiệm vụ" })).not.toBeInTheDocument();

    cleanup();
    tree("/s/coffee/challenges/9", <ChallengeDetailPage />, member);
    const detailPath = await screen.findByRole("list", { name: "Các mốc nhiệm vụ" });
    expect(within(detailPath).getByText("2 đơn")).toBeInTheDocument();
  });

  it("shows the store scoped points summary on member challenge detail", async () => {
    memberDetail.mockResolvedValueOnce({
      merchant: memberList.merchant,
      checkedInToday: false,
      todayDateKey: "2026-11-17",
      challenge: { ...challenge, progress },
      recentEntries: [{ id: 88, activityType: "ORDER_PAID", deltaValue: "2", orderId: 77, occurredAt: "2026-11-16T10:00:00Z" }],
    });
    tree("/s/coffee/challenges/9", <ChallengeDetailPage />, member);

    expect(await screen.findByRole("heading", { name: "Mua cà phê" })).toBeInTheDocument();
    expect(screen.getByText(/Kết thúc/)).toBeInTheDocument();
    expect(screen.getByText(/Còn \d+ ngày/)).toBeInTheDocument();
    expect(await screen.findByText("Điểm khả dụng")).toBeInTheDocument();
    expect(screen.getByText("Tổng tích lũy")).toBeInTheDocument();
    expect(screen.getByText("1.840")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hoạt động gần đây" })).toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.getByText("Chi tiết chương trình")).toBeInTheDocument();
    expect(screen.queryByText("Bảng xếp hạng")).not.toBeInTheDocument();
    expect(wallet).toHaveBeenCalledWith(5, "member-token");
  });

  it("keeps the prior detail path until refreshed progress arrives, then animates the confirmed reward", async () => {
    const before = { merchant: memberList.merchant, checkedInToday: false, todayDateKey: "2026-11-17", challenge: { ...challenge, type: "DAILY_CHECKIN" as const, progress: { ...progress, currentValue: "2", targetValue: "3", remainingValue: "1" } }, recentEntries: [] };
    const after = { ...before, checkedInToday: true, challenge: { ...before.challenge, progress: { ...progress, currentValue: "3", targetValue: "3", remainingValue: "0", percent: 100, rewardState: "REWARDED" as const } } };
    let resolveRefresh: ((value: typeof after) => void) | undefined;
    memberDetail.mockResolvedValueOnce(before).mockImplementationOnce(() => new Promise((resolve) => { resolveRefresh = resolve; }));
    tree("/s/coffee/challenges/9", <ChallengeDetailPage />, member);

    expect(await screen.findByText("2/3 ngày")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Điểm danh hôm nay" }));
    await waitFor(() => expect(memberDetail).toHaveBeenCalledTimes(2));
    expect(screen.getByText("2/3 ngày")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Các mốc nhiệm vụ" })).toBeInTheDocument();

    resolveRefresh?.(after);
    expect(await screen.findByText("3/3 ngày")).toBeInTheDocument();
    expect(screen.getByText("3 ngày").closest("li")).toHaveAttribute("data-state", "rewarded");
    await waitFor(() => expect(screen.getByText("3 ngày").closest("li")).toHaveAttribute("data-animating", "true"));
  });

  it("does not animate a rewarded state loaded on the initial request", async () => {
    memberDetail.mockResolvedValueOnce({
      merchant: memberList.merchant,
      checkedInToday: true,
      todayDateKey: "2026-11-17",
      challenge: { ...challenge, type: "DAILY_CHECKIN", targetValue: "2", progress: { ...progress, currentValue: "2", targetValue: "2", remainingValue: "0", percent: 100, rewardState: "REWARDED" } },
      recentEntries: [],
    });
    tree("/s/coffee/challenges/9", <ChallengeDetailPage />, member);
    expect(await screen.findByText("2/2 ngày")).toBeInTheDocument();
    expect(screen.getByText("2 ngày").closest("li")).toHaveAttribute("data-state", "rewarded");
    expect(screen.getByText("2 ngày").closest("li")).toHaveAttribute("data-animating", "false");
  });

  it("filters challenges through status tabs and handles daily check-in", async () => {
    tree("/s/coffee/challenges", <ChallengesPage />, member);
    expect(await screen.findByText("Mua cà phê")).toBeInTheDocument();
    const tablist = screen.getByRole("tablist", { name: "Trạng thái nhiệm vụ" });
    expect(tablist).toHaveClass("flex-nowrap");
    const statusTabs = within(tablist).getAllByRole("tab");
    expect(statusTabs).toHaveLength(3);
    for (const statusTab of statusTabs) {
      expect(statusTab).toHaveClass("shrink-0", "whitespace-nowrap", "px-3", "text-xs");
    }
    expect(screen.getByRole("tab", { name: "Đang thực hiện" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: "Đã hoàn thành" }));
    expect(screen.getByRole("tab", { name: "Đã hoàn thành" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Chưa có nhiệm vụ")).toBeInTheDocument();
    cleanup();
    memberDetail.mockResolvedValueOnce({ ...memberList, challenge: { ...challenge, type: "DAILY_CHECKIN", progress }, recentEntries: [] });
    tree("/s/coffee/challenges/9", <ChallengeDetailPage />, member);
    fireEvent.click(await screen.findByRole("button", { name: "Điểm danh hôm nay" }));
    await waitFor(() => expect(checkIn).toHaveBeenCalledWith("coffee", "member-token"));
  });

  it("lets guests browse public vouchers and sends redeem intent to login", async () => {
    tree("/s/coffee/vouchers", <MemberVouchers />);
    expect(await screen.findByText("Quà")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Đổi quà “Quà”" }));
    expect(await screen.findByText("login")).toBeInTheDocument();
    expect(publicVouchers).toHaveBeenCalledWith(5);
    expect(memberVouchers).not.toHaveBeenCalled();
    expect(wallet).not.toHaveBeenCalled();
  });
});
