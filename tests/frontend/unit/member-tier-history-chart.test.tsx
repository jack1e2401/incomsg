// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { WalletDto, WalletTransactionDto } from "../../../apps/frontend/src/api/commerce-types";
import { MemberLifetimeTierChart } from "../../../apps/frontend/src/features/member/MemberLifetimeTierChart";
import { buildLifetimeTierHistory } from "../../../apps/frontend/src/features/member/lifetime-tier-history";

function transaction(
  id: number,
  type: WalletTransactionDto["type"],
  delta: string,
  createdAt: string,
): WalletTransactionDto {
  return {
    id,
    type,
    delta,
    balanceAfter: "0",
    availablePointsAfter: 0,
    fractionalCarryAfter: "0",
    pointDebtAfter: "0",
    reason: type,
    orderId: id,
    memberVoucherId: null,
    createdAt,
  };
}

function wallet(transactions: WalletTransactionDto[], netLifetimeEarned: string): WalletDto {
  return {
    merchantId: 7,
    availablePoints: 0,
    exactBalance: "0.2",
    fractionalCarry: "0.2",
    pointDebt: "0",
    netLifetimeEarned,
    lifetimeEarnedPoints: 0,
    tier: "BRONZE",
    policy: {
      merchantId: 7,
      vndPerPoint: 10000,
      isActive: true,
      tiers: [
        { level: "BRONZE", minLifetimePoints: 0, multiplier: "1.00" },
        { level: "SILVER", minLifetimePoints: 1, multiplier: "1.10" },
        { level: "GOLD", minLifetimePoints: 5, multiplier: "1.25" },
        { level: "PLATINUM", minLifetimePoints: 10, multiplier: "1.50" },
      ],
    },
    transactions,
  };
}

describe("Member lifetime tier history", () => {
  afterEach(() => cleanup());
  it("plots exact earn and reversal totals in time order while ignoring redemptions", () => {
    const newestFirst = [
      transaction(4, "EARN_REVERSAL", "-0.6", "2026-11-12T13:00:00.000Z"),
      transaction(3, "REDEEM_DISCOUNT", "-1", "2026-11-12T12:00:00.000Z"),
      transaction(2, "EARN", "0.6", "2026-11-12T11:00:00.000Z"),
      transaction(1, "EARN", "0.6", "2026-11-12T10:00:00.000Z"),
    ];

    const history = buildLifetimeTierHistory(newestFirst, "0.6");

    expect(history.points.map((point) => point.total)).toEqual(["0", "0.6", "1.2", "0.6"]);
    expect(history.points.map((point) => point.transactionId)).toEqual([null, 1, 2, 4]);
    expect(history.isConsistent).toBe(true);
  });

  it("shows current tier thresholds and exact event totals on the chart", () => {
    const report = wallet(
      [
        transaction(2, "EARN", "0.6", "2026-11-12T11:00:00.000Z"),
        transaction(1, "EARN", "0.6", "2026-11-12T10:00:00.000Z"),
      ],
      "1.2",
    );

    render(<MemberLifetimeTierChart wallet={report} />);

    expect(screen.getByRole("img", { name: /Biến động điểm lifetime/ })).toBeTruthy();
    expect(screen.getByText(/Ngưỡng tier theo chính sách hiện tại/)).toBeTruthy();
    expect(screen.getByText(/SILVER/)).toBeTruthy();
    expect(screen.getByLabelText("Lịch sử điểm lifetime").textContent).toContain("1.2");
  });

  it("uses muted tier-name colors for current-policy bands and keeps the plot swipeable", () => {
    const report = wallet(
      [
        transaction(2, "EARN", "52.5", "2026-11-12T11:00:00.000Z"),
        transaction(1, "EARN", "120", "2026-11-12T10:00:00.000Z"),
      ],
      "172.5",
    );
    report.policy!.tiers = [
      { level: "BRONZE", minLifetimePoints: 0, multiplier: "1.00" },
      { level: "SILVER", minLifetimePoints: 30, multiplier: "1.10" },
      { level: "GOLD", minLifetimePoints: 100, multiplier: "1.25" },
      { level: "PLATINUM", minLifetimePoints: 250, multiplier: "1.50" },
    ];

    render(<MemberLifetimeTierChart wallet={report} />);

    const chart = screen.getByRole("img", { name: /Biến động điểm lifetime/ });
    const bands = Array.from(chart.querySelectorAll("[data-tier-band]"));
    expect(bands.map((band) => band.getAttribute("data-tier-band"))).toEqual([
      "BRONZE",
      "SILVER",
      "GOLD",
      "PLATINUM",
    ]);
    expect(new Set(bands.map((band) => band.getAttribute("fill"))).size).toBe(4);
    expect(chart.closest("div.overflow-x-auto")?.className).toContain("touch-pan-x");
    expect(screen.getByLabelText("Lịch sử điểm lifetime").textContent).toContain("172.5");
  });

  it("keeps small lifetime changes readable when the next tier threshold is far away", () => {
    const report = wallet(
      [
        transaction(3, "EARN_REVERSAL", "-0.6", "2026-11-12T12:00:00.000Z"),
        transaction(2, "EARN", "0.6", "2026-11-12T11:00:00.000Z"),
        transaction(1, "EARN", "0.6", "2026-11-12T10:00:00.000Z"),
      ],
      "0.6",
    );
    report.policy!.tiers = [
      { level: "BRONZE", minLifetimePoints: 0, multiplier: "1.00" },
      { level: "SILVER", minLifetimePoints: 100, multiplier: "1.10" },
      { level: "GOLD", minLifetimePoints: 500, multiplier: "1.25" },
      { level: "PLATINUM", minLifetimePoints: 1000, multiplier: "1.50" },
    ];

    render(<MemberLifetimeTierChart wallet={report} />);

    const eventMarkers = screen.getByRole("img", { name: /Biến động điểm lifetime/ }).querySelectorAll("circle");
    const yPositions = Array.from(eventMarkers, (marker) => Number(marker.getAttribute("cy")));
    expect(Math.max(...yPositions) - Math.min(...yPositions)).toBeGreaterThan(40);

    const expectedDate = new Date("2026-11-12T10:00:00.000Z").toLocaleDateString("vi-VN");
    const dateLabels = Array.from(screen.getByRole("img").querySelectorAll("text"))
      .filter((label) => label.textContent === expectedDate);
    expect(dateLabels).toHaveLength(1);
  });

  it("does not draw a chart when the ledger does not reconcile with the wallet", () => {
    render(
      <MemberLifetimeTierChart
        wallet={wallet([transaction(1, "EARN", "0.6", "2026-11-12T10:00:00.000Z")], "0.8")}
      />,
    );

    expect(screen.getByRole("status").textContent).toContain("chưa khớp");
    expect(screen.queryByRole("img", { name: /Biến động điểm lifetime/ })).toBeNull();
  });
});
