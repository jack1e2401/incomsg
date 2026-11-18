// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const mocks = vi.hoisted(() => ({ get: vi.fn(), adjust: vi.fn() }));
vi.mock("../../../apps/frontend/src/api/commerce-http", () => ({ createCommerceClient: () => ({ getVoucherInventory: mocks.get, adjustVoucherInventory: mocks.adjust }) }));
vi.mock("../../../apps/frontend/src/features/merchant/merchant-page-support", () => ({ useToken: () => "merchant-token" }));
import { MerchantInventoryPage } from "../../../apps/frontend/src/features/merchant/MerchantInventoryPage";

afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("shows voucher history in a separate screen and filters loaded movements", async () => {
  mocks.get.mockResolvedValue({ inventory: { onHandQuantity: 5, reservedQuantity: 0, availableQuantity: 5 }, movements: [
    { id: 1, movementType: "INITIAL_STOCK", quantityDelta: 5, onHandBefore: 0, onHandAfter: 5, reservedBefore: 0, reservedAfter: 0, reason: "Khởi tạo", actorEmail: "owner@example.test", createdAt: "2026-11-17T00:00:00Z" },
    { id: 2, movementType: "MANUAL_OUT", quantityDelta: -1, onHandBefore: 6, onHandAfter: 5, reservedBefore: 0, reservedAfter: 0, reason: "Sai sót", actorEmail: null, createdAt: "2026-11-18T00:00:00Z" },
  ] });
  render(<MemoryRouter initialEntries={["/merchant/inventory/voucher/4?tab=history"]}><Routes><Route path="/merchant/inventory/:kind/:id" element={<MerchantInventoryPage />} /></Routes></MemoryRouter>);
  expect(await screen.findByText("Khởi tạo")).toBeInTheDocument();
  expect(screen.getByText(/100 giao dịch gần nhất/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Tìm lịch sử"), { target: { value: "sai sót" } });
  expect(screen.getByText("Sai sót")).toBeInTheDocument();
  expect(screen.queryByText("Khởi tạo")).not.toBeInTheDocument();
  expect(mocks.adjust).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: /Quay lại voucher/ })).toHaveAttribute("href", "/merchant/vouchers");
});

it("uses the same idempotency key when an uncertain adjustment is retried", async () => {
  mocks.get.mockResolvedValue({ inventory: { onHandQuantity: 5, reservedQuantity: 0, availableQuantity: 5 }, movements: [] });
  mocks.adjust.mockRejectedValueOnce(new Error("Mất kết nối")).mockResolvedValueOnce({ inventory: { onHandQuantity: 7, reservedQuantity: 0, availableQuantity: 7 } });
  render(<MemoryRouter initialEntries={["/merchant/inventory/voucher/4"]}><Routes><Route path="/merchant/inventory/:kind/:id" element={<MerchantInventoryPage />} /></Routes></MemoryRouter>);
  await screen.findByLabelText("Số lượng");
  fireEvent.change(screen.getByLabelText("Số lượng"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Ghi chú"), { target: { value: "Bổ sung" } });
  fireEvent.click(screen.getByRole("button", { name: "Tăng lượt phát hành" }));
  expect(await screen.findByText("Mất kết nối")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Tăng lượt phát hành" }));
  await waitFor(() => expect(mocks.adjust).toHaveBeenCalledTimes(2));
  expect(mocks.adjust.mock.calls[0][4]).toBe(mocks.adjust.mock.calls[1][4]);
  expect(await screen.findByText("Đã cập nhật lượt phát hành.")).toBeInTheDocument();
});
