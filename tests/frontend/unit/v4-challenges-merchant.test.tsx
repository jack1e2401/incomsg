// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthSessionProvider } from "../../../apps/frontend/src/api/auth-session";
import { MerchantChallengesPage } from "../../../apps/frontend/src/features/merchant/challenges/MerchantChallengesPage";
import { MerchantChallengeDetailPage } from "../../../apps/frontend/src/features/merchant/challenges/MerchantChallengeDetailPage";
import { MerchantChallengeEditorPage } from "../../../apps/frontend/src/features/merchant/challenges/MerchantChallengeEditorPage";
import { challengeGrantStatusLabel, challengeRewardStateLabel, challengeStatusLabel, challengeTypeLabel } from "../../../apps/frontend/src/features/merchant/challenges/challenge-labels";

const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), get: vi.fn(), update: vi.fn(), activate: vi.fn(), pause: vi.fn(), archive: vi.fn(), remove: vi.fn() }));
vi.mock("../../../apps/frontend/src/api/challenges-client", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../../apps/frontend/src/api/challenges-client")>()), createChallengesClient: () => ({ listMerchantChallenges: mocks.list, createMerchantChallenge: mocks.create, getMerchantChallenge: mocks.get, updateMerchantChallenge: mocks.update, activateMerchantChallenge: mocks.activate, pauseMerchantChallenge: mocks.pause, archiveMerchantChallenge: mocks.archive, deleteMerchantChallenge: mocks.remove }) }));
const challenge = { id: 6, merchantId: 3, title: "Đơn đầu tiên", description: "Mô tả", type: "ORDER_COUNT" as const, status: "ACTIVE" as const, effectiveStatus: "ACTIVE" as const, targetValue: "3", rewardPoints: "20.0000000000", budgetTotal: "100.0000000000", budgetSpent: "20.0000000000", budgetRemaining: "80.0000000000", startsAt: "2026-11-01T00:00:00Z", endsAt: "2026-12-01T00:00:00Z", isFeatured: true, milestones: [{ position: 1, thresholdValue: "1", title: "Mốc 1", description: "" }, { position: 2, thresholdValue: "2", title: "Mốc 2", description: "" }, { position: 3, thresholdValue: "3", title: "Mốc 3", description: "" }], hasProgress: true, lockedFields: true, inProgressCount: 5, completedCount: 2, waitingBudgetCount: 1, createdAt: "", updatedAt: "" };
function renderMerchant(path = "/merchant/challenges") { const session = JSON.stringify({ accessToken: "merchant-token", user: { id: 2, email: "merchant@test.local", role: "MERCHANT", isActive: true } }); sessionStorage.setItem("loyalty.m2.session", session); sessionStorage.setItem("loyalty.auth.session", session); return render(<AuthSessionProvider><MemoryRouter initialEntries={[path]}><Routes><Route path="/merchant/challenges" element={<MerchantChallengesPage />} /><Route path="/merchant/challenges/new" element={<MerchantChallengeEditorPage />} /><Route path="/merchant/challenges/:challengeId/edit" element={<MerchantChallengeEditorPage />} /><Route path="/merchant/challenges/:challengeId" element={<MerchantChallengeDetailPage />} /></Routes></MemoryRouter></AuthSessionProvider>); }
describe("merchant challenge CMS", () => {
 beforeEach(() => { sessionStorage.clear(); mocks.list.mockResolvedValue({ items: [challenge], pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 } }); mocks.create.mockResolvedValue({ challenge }); mocks.update.mockResolvedValue({ challenge }); mocks.get.mockResolvedValue({ challenge, participants: { items: [{ progressId: 9, membershipId: 4, memberId: 8, memberEmail: "member@test.local", currentValue: "2", targetValue: "3", rewardState: "IN_PROGRESS", rewardCycle: 1, completedAt: null, updatedAt: "" }], pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 } }, recentGrants: [] }); });
 afterEach(() => { cleanup(); vi.clearAllMocks(); });
 it("localizes every challenge type, status, and reward state", () => {
  expect(["ORDER_COUNT", "DAILY_CHECKIN", "SPEND_TOTAL"].map((value) => challengeTypeLabel(value as never))).toEqual(["Số đơn hàng", "Điểm danh hằng ngày", "Tổng chi tiêu"]);
  expect(["DRAFT", "ACTIVE", "PAUSED", "ENDED", "ARCHIVED"].map((value) => challengeStatusLabel(value as never))).toEqual(["Bản nháp", "Đang hoạt động", "Tạm dừng", "Đã kết thúc", "Đã lưu trữ"]);
  expect(["IN_PROGRESS", "WAITING_BUDGET", "REWARDED"].map((value) => challengeRewardStateLabel(value as never))).toEqual(["Đang thực hiện", "Chờ ngân sách", "Đã nhận thưởng"]);
  expect(["GRANTED", "REVERSED"].map((value) => challengeGrantStatusLabel(value as never))).toEqual(["Đã phát", "Đã thu hồi"]);
 });
 it("renders localized campaign cards and a compact action menu without a wide table", async () => {
  const { container } = renderMerchant();
  await screen.findByText("Đơn đầu tiên");
  expect(screen.getByRole("option", { name: "Số đơn hàng" })).toBeInTheDocument();
  expect(screen.getAllByText("Số đơn hàng").length).toBeGreaterThanOrEqual(2);
  expect(screen.getAllByText("Đang hoạt động").length).toBeGreaterThanOrEqual(2);
  expect(screen.getByRole("link", { name: "Xem chi tiết nhiệm vụ Đơn đầu tiên" })).toHaveAttribute("href", "/merchant/challenges/6");
  expect(container.querySelector("table")).not.toBeInTheDocument();
  expect(container.querySelector(".min-w-\\[1050px\\]")).not.toBeInTheDocument();
  fireEvent.pointerDown(screen.getByRole("button", { name: "Thao tác nhiệm vụ Đơn đầu tiên" }), { button: 0, ctrlKey: false, pointerType: "mouse" });
  fireEvent.click(await screen.findByRole("menuitem", { name: "Tạm dừng" }));
  await waitFor(() => expect(mocks.pause).toHaveBeenCalledWith(6, "merchant-token"));
 });
 it("shows a translated message when a challenge cannot be activated", async () => {
  mocks.list.mockResolvedValueOnce({ items: [{ ...challenge, status: "DRAFT" as const, effectiveStatus: "DRAFT" as const }], pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 } });
  mocks.activate.mockRejectedValueOnce(new Error("INVALID_CHALLENGE_CONFIGURATION"));
  renderMerchant();
  await screen.findByText("Đơn đầu tiên");
  fireEvent.pointerDown(screen.getByRole("button", { name: "Thao tác nhiệm vụ Đơn đầu tiên" }), { button: 0, ctrlKey: false, pointerType: "mouse" });
  fireEvent.click(await screen.findByRole("menuitem", { name: "Kích hoạt" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Cấu hình nhiệm vụ chưa hợp lệ hoặc ngân sách thấp hơn điểm thưởng.");
  expect(screen.queryByText("INVALID_CHALLENGE_CONFIGURATION")).not.toBeInTheDocument();
 });
 it("validates the date range on the editor page without opening a dialog", async () => {
  renderMerchant("/merchant/challenges/new");
  expect(await screen.findByRole("heading", { name: "Tạo nhiệm vụ" })).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  expect(await screen.findByText("Vui lòng nhập tên nhiệm vụ.")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Tiêu đề"), { target: { value: "Challenge" } });
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  fireEvent.change(screen.getByLabelText("Mục tiêu"), { target: { value: "0" } });
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  expect(await screen.findByText("Mục tiêu và điểm thưởng phải lớn hơn 0.")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Mục tiêu"), { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  fireEvent.change(screen.getByLabelText("Ngày bắt đầu"), { target: { value: "2026-12-01T00:00" } });
  fireEvent.change(screen.getByLabelText("Ngày kết thúc"), { target: { value: "2026-11-01T00:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  expect(await screen.findByText("Ngày kết thúc phải lớn hơn ngày bắt đầu.")).toBeInTheDocument();
  expect(mocks.create).not.toHaveBeenCalled();
 });
 it("saves a new challenge as a draft after reviewing the five editor steps", async () => {
  const saved = { ...challenge, status: "DRAFT" as const, effectiveStatus: "DRAFT" as const };
  mocks.create.mockResolvedValueOnce({ challenge: saved });
  renderMerchant("/merchant/challenges/new");
  await screen.findByRole("heading", { name: "Tạo nhiệm vụ" });
  fireEvent.change(screen.getByLabelText("Tiêu đề"), { target: { value: "Challenge mới" } });
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  fireEvent.change(screen.getByLabelText("Ngày bắt đầu"), { target: { value: "2026-11-01T00:00" } });
  fireEvent.change(screen.getByLabelText("Ngày kết thúc"), { target: { value: "2026-12-01T00:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  expect(await screen.findByText("Rà soát nhiệm vụ")).toBeInTheDocument();
  expect(screen.getAllByText("Hành trình tiến độ").length).toBeGreaterThanOrEqual(1);
  fireEvent.click(screen.getByRole("button", { name: "Lưu bản nháp" }));
  await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ title: "Challenge mới", status: "DRAFT" }), "merchant-token"));
  expect((await screen.findAllByText("member@test.local")).length).toBeGreaterThanOrEqual(1);
 });
 it("shows a localized responsive campaign detail and edit route", async () => {
  mocks.get.mockResolvedValueOnce({
   challenge,
   participants: { items: [{ progressId: 9, membershipId: 4, memberId: 8, memberEmail: "member@test.local", currentValue: "2", targetValue: "3", rewardState: "IN_PROGRESS", rewardCycle: 1, completedAt: null, updatedAt: "" }], pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 } },
   recentGrants: [
    { id: 10, progressId: 9, memberId: 8, memberEmail: "member@test.local", cycle: 1, status: "GRANTED", pointsGranted: "20", earnTransactionId: 3, reversalTransactionId: null, grantedAt: "2026-11-17T10:00:00Z", reversedAt: null },
    { id: 11, progressId: 9, memberId: 8, memberEmail: "member@test.local", cycle: 1, status: "REVERSED", pointsGranted: "20", earnTransactionId: 3, reversalTransactionId: 4, grantedAt: "2026-11-17T10:00:00Z", reversedAt: "2026-11-18T10:00:00Z" },
   ],
  });
  const { container } = renderMerchant("/merchant/challenges/6");
  expect(await screen.findByRole("heading", { name: "Đơn đầu tiên" })).toBeInTheDocument();
  expect(screen.getByText("Số đơn hàng")).toBeInTheDocument();
  expect(screen.getByText("Đang hoạt động")).toBeInTheDocument();
  expect(screen.getAllByText("Đang thực hiện").length).toBeGreaterThanOrEqual(2);
  expect(screen.getByText("Đã phát")).toBeInTheDocument();
  expect(screen.getByText("Đã thu hồi")).toBeInTheDocument();
  expect(screen.getByText("Điểm thưởng ròng đã cấp")).toBeInTheDocument();
  expect(screen.queryByText("Tổng điểm đã phát")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Chỉnh sửa nhiệm vụ" })).toHaveAttribute("href", "/merchant/challenges/6/edit");
  expect(container.querySelector(".min-w-\\[700px\\]")).not.toBeInTheDocument();
  expect(container.querySelector(".overflow-x-auto")).not.toBeInTheDocument();
 });
 it("loads locked challenge fields on the edit route", async () => { renderMerchant("/merchant/challenges/6/edit"); await screen.findByRole("heading", { name: "Chỉnh sửa nhiệm vụ" }); fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" })); await waitFor(() => expect(screen.getByLabelText("Loại nhiệm vụ")).toBeDisabled()); expect(screen.getByLabelText("Mục tiêu")).toBeDisabled(); expect((screen.getByLabelText("Điểm thưởng cuối nhiệm vụ") as HTMLInputElement).value).toBe("20"); });
 it("sends only editable fields when saving a locked challenge", async () => {
  renderMerchant("/merchant/challenges/6/edit");
  await screen.findByRole("heading", { name: "Chỉnh sửa nhiệm vụ" });
  fireEvent.change(screen.getByLabelText("Tiêu đề"), { target: { value: "Tên đã cập nhật" } });
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(6, expect.objectContaining({ title: "Tên đã cập nhật", budgetTotal: "100" }), "merchant-token"));
  const patch = mocks.update.mock.calls[0][1];
  expect(patch).not.toHaveProperty("type");
  expect(patch).not.toHaveProperty("targetValue");
  expect(patch).not.toHaveProperty("rewardPoints");
  expect(patch).not.toHaveProperty("startsAt");
 });
 it("prevents reducing a campaign budget below points already issued", async () => {
  renderMerchant("/merchant/challenges/6/edit");
  await screen.findByRole("heading", { name: "Chỉnh sửa nhiệm vụ" });
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  fireEvent.change(screen.getByLabelText("Ngân sách tổng (điểm)"), { target: { value: "10" } });
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  expect(await screen.findByText("Ngân sách không được thấp hơn số điểm ngân sách đã sử dụng.")).toBeInTheDocument();
  expect(mocks.update).not.toHaveBeenCalled();
 });
 it("configures, previews, validates, and saves milestone stages in step 4", async () => {
  renderMerchant("/merchant/challenges/new");
  await screen.findByRole("heading", { name: "Tạo nhiệm vụ" });
  fireEvent.change(screen.getByLabelText("Tiêu đề"), { target: { value: "Hành trình mới" } });
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  fireEvent.change(screen.getByLabelText("Mục tiêu"), { target: { value: "10" } });
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  fireEvent.change(screen.getByLabelText("Ngày bắt đầu"), { target: { value: "2026-11-01T00:00" } });
  fireEvent.change(screen.getByLabelText("Ngày kết thúc"), { target: { value: "2026-12-01T00:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));

  expect(await screen.findByRole("heading", { name: "Các mốc tiến độ" })).toBeInTheDocument();
  expect(screen.getAllByLabelText(/Ngưỡng mốc/)).toHaveLength(5);
  expect(screen.getByLabelText("Ngưỡng mốc 5")).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Ngưỡng mốc 1"), { target: { value: "3" } });
  fireEvent.change(screen.getByLabelText("Tiêu đề mốc 1"), { target: { value: "Mốc ghé đầu" } });
  fireEvent.change(screen.getByLabelText("Mô tả mốc 1"), { target: { value: "Bắt đầu tích lũy" } });
  expect(screen.getAllByText("Mốc ghé đầu")).toHaveLength(2);

  fireEvent.click(screen.getByRole("button", { name: "Thêm mốc" }));
  expect(screen.getAllByLabelText(/Ngưỡng mốc/)).toHaveLength(6);
  fireEvent.click(screen.getByRole("button", { name: "Xóa mốc Mốc 6" }));
  expect(screen.getAllByLabelText(/Ngưỡng mốc/)).toHaveLength(5);

  fireEvent.change(screen.getByLabelText("Ngưỡng mốc 2"), { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  expect(await screen.findByText("Các ngưỡng mốc phải tăng dần, không trùng nhau.")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Ngưỡng mốc 2"), { target: { value: "4" } });
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  expect(await screen.findByText("Rà soát nhiệm vụ")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Lưu bản nháp" }));
  await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
    title: "Hành trình mới",
    milestones: [
      { thresholdValue: "3", title: "Mốc ghé đầu", description: "Bắt đầu tích lũy" },
      { thresholdValue: "4", title: "Mốc 2", description: "" },
      { thresholdValue: "6", title: "Mốc 3", description: "" },
      { thresholdValue: "8", title: "Mốc 4", description: "" },
      { thresholdValue: "10", title: "Mốc 5", description: "" },
    ],
  }), "merchant-token"));
 });
 it("resets milestone defaults when the merchant changes campaign type", async () => {
  renderMerchant("/merchant/challenges/new");
  await screen.findByRole("heading", { name: "Tạo nhiệm vụ" });
  fireEvent.change(screen.getByLabelText("Tiêu đề"), { target: { value: "Chi tiêu mỗi ngày" } });
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  fireEvent.change(screen.getByLabelText("Mục tiêu"), { target: { value: "100" } });
  fireEvent.change(screen.getByLabelText("Loại nhiệm vụ"), { target: { value: "SPEND_TOTAL" } });
  expect(await screen.findByText(/Đã tạo lại các mốc/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  fireEvent.change(screen.getByLabelText("Ngày bắt đầu"), { target: { value: "2026-11-01T00:00" } });
  fireEvent.change(screen.getByLabelText("Ngày kết thúc"), { target: { value: "2026-12-01T00:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  expect(await screen.findByRole("heading", { name: "Các mốc tiến độ" })).toBeInTheDocument();
  expect(screen.getAllByLabelText(/Ngưỡng mốc/).map((input) => (input as HTMLInputElement).value)).toEqual(["25", "50", "75", "100"]);
 });
});
