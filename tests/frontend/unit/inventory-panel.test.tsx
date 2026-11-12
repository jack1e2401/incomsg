// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { InventoryPanel, type InventoryMovement, type InventoryPanelProps } from "../../../apps/frontend/src/features/merchant/InventoryPanel";

const movements: InventoryMovement[] = [{
  id: 1,
  movementType: "STOCK_IN",
  quantityDelta: 4,
  onHandBefore: 6,
  onHandAfter: 10,
  reservedBefore: 1,
  reservedAfter: 1,
  reason: "Nhập hàng mới",
  actorId: 7,
  actorEmail: "merchant@example.com",
  createdAt: "2026-11-12T10:00:00.000Z",
}];

function props(overrides: Partial<InventoryPanelProps> = {}): InventoryPanelProps {
  return {
    balance: { onHandQuantity: 6, reservedQuantity: 1, availableQuantity: 5 },
    movements,
    onAdjust: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("Merchant inventory panel", () => {
  afterEach(() => cleanup());

  it("shows authoritative balances and movement history with the actor", () => {
    render(<InventoryPanel {...props()} />);
    expect(screen.getByText("6")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText("Nhập hàng mới")).toBeTruthy();
    expect(screen.getByText(/Thực hiện bởi merchant@example\.com/)).toBeTruthy();
    expect(screen.getByText("Tồn: 6 → 10")).toBeTruthy();
    expect(screen.getByText("Đã giữ: 1 → 1")).toBeTruthy();
  });

  it("requires a positive integer quantity and a note before adjusting", async () => {
    const onAdjust = vi.fn().mockResolvedValue(undefined);
    render(<InventoryPanel {...props({ onAdjust })} />);
    fireEvent.change(screen.getByLabelText("Số lượng"), { target: { value: "1.5" } });
    fireEvent.change(screen.getByLabelText("Ghi chú"), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Nhập kho" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(onAdjust).not.toHaveBeenCalled();
  });

  it("shows success only after the backend confirms stock-in", async () => {
    let resolveAdjustment!: () => void;
    const onAdjust = vi.fn(() => new Promise<void>((resolve) => { resolveAdjustment = resolve; }));
    render(<InventoryPanel {...props({ onAdjust })} />);
    fireEvent.change(screen.getByLabelText("Số lượng"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Ghi chú"), { target: { value: "Hàng khách trả" } });
    fireEvent.click(screen.getByRole("button", { name: "Nhập kho" }));
    expect(onAdjust).toHaveBeenCalledWith({ direction: "in", quantity: 2, reason: "Hàng khách trả" });
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Đang lưu…" })).toHaveLength(2);
    resolveAdjustment();
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/cập nhật/i));
  });

  it("shows callback errors and clears loading without claiming success", async () => {
    const onAdjust = vi.fn().mockRejectedValue(new Error("Không đủ tồn kho"));
    render(<InventoryPanel {...props({ onAdjust })} />);
    fireEvent.change(screen.getByLabelText("Số lượng"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Ghi chú"), { target: { value: "Điều chỉnh" } });
    fireEvent.click(screen.getByRole("button", { name: "Xuất kho" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Không đủ tồn kho");
    expect(screen.queryByRole("status")).toBeNull();
    expect((screen.getByRole("button", { name: "Xuất kho" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
