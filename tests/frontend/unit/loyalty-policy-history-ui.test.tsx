// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MerchantLoyaltyHistory } from "../../../apps/frontend/src/features/merchant/MerchantLoyaltyHistory";
import { OrderLoyaltyPolicySnapshot } from "../../../apps/frontend/src/features/orders/OrderLoyaltyPolicySnapshot";
import type { MerchantLoyaltyPolicyVersionDto, AppliedLoyaltyPolicySnapshot } from "../../../apps/frontend/src/api/commerce-types";

const tiers: MerchantLoyaltyPolicyVersionDto["tiers"] = [
  { level: "BRONZE", minLifetimePoints: 0, multiplier: "1.00" },
  { level: "SILVER", minLifetimePoints: 100, multiplier: "1.10" },
  { level: "GOLD", minLifetimePoints: 500, multiplier: "1.25" },
  { level: "PLATINUM", minLifetimePoints: 1000, multiplier: "1.50" },
];

describe("loyalty policy history UI", () => {
  afterEach(() => cleanup());

  it("shows published versions with publisher, rate, thresholds, and multipliers", () => {
    render(
      <MerchantLoyaltyHistory
        versions={[
          {
            id: 42,
            version: 3,
            vndPerPoint: 10000,
            isActive: true,
            tiers,
            publishedAt: "2026-11-12T09:30:00.000Z",
            publishedById: 7,
            publishedByEmail: "owner@test.local",
            source: "MERCHANT_PUBLISH",
            isCurrent: true,
          },
        ]}
      />,
    );

    expect(screen.getByText(/Phiên bản 3/)).toBeTruthy();
    expect(screen.getByText(/10.000 VND/)).toBeTruthy();
    expect(screen.getByText(/owner@test.local/)).toBeTruthy();
    expect(screen.getByText(/SILVER/)).toBeTruthy();
    expect(screen.getByText(/100/)).toBeTruthy();
    expect(screen.getByText(/1.10/)).toBeTruthy();
  });

  it("shows the policy snapshot applied to an order", () => {
    render(
      <OrderLoyaltyPolicySnapshot
        policy={{
          policyVersionId: 42,
          version: 3,
          publishedAt: "2026-11-12T09:30:00.000Z",
          vndPerPoint: 10000,
          isActive: false,
          tierLevel: "GOLD",
          multiplier: "1.25",
          tiers,
          capturedAt: "2026-11-12T09:30:00.000Z",
        } satisfies AppliedLoyaltyPolicySnapshot}
      />,
    );

    expect(screen.getByText(/Chính sách áp dụng · phiên bản 3/)).toBeTruthy();
    expect(screen.getAllByText(/GOLD/)).toHaveLength(2);
    expect(screen.getAllByText(/1.25/)).toHaveLength(2);
    expect(screen.getByText(/10.000 VND/)).toBeTruthy();
    expect(screen.getByText(/PLATINUM/)).toBeTruthy();
  });

  it("marks orders without a policy snapshot as legacy and unavailable", () => {
    render(<OrderLoyaltyPolicySnapshot policy={null} />);

    expect(screen.getByText(/Đơn hàng cũ/)).toBeTruthy();
    expect(screen.getByText(/không có bản chụp chính sách loyalty/)).toBeTruthy();
    expect(screen.queryByText(/phiên bản hiện tại/i)).toBeNull();
  });
});
