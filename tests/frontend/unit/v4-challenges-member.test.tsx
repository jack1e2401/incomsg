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

const challenge = { id: 9, merchantId: 5, title: "Mua cà phê", description: "Mua đủ đơn", type: "ORDER_COUNT" as const, effectiveStatus: "ACTIVE" as const, targetValue: "3", rewardPoints: "150", startsAt: "2026-11-01T00:00:00Z", endsAt: "2026-12-01T00:00:00Z", isFeatured: true };
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
    memberVouchers.mockResolvedValue({ vouchers: [] }); wallet.mockResolvedValue({ wallet: { availablePoints: 500 } });
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

  it("filters challenges through status tabs and handles daily check-in", async () => {
    tree("/s/coffee/challenges", <ChallengesPage />, member);
    expect(await screen.findByText("Mua cà phê")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Đã hoàn thành" }));
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
