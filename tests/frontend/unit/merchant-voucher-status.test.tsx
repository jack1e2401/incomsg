// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { VoucherDefinitionDto } from "../../../apps/frontend/src/api/commerce-types";
import { MerchantVoucherTableRow } from "../../../apps/frontend/src/features/merchant/MerchantVoucherTableRow";

const definition: VoucherDefinitionDto = {
  id: 4,
  merchantId: 2,
  type: "DISCOUNT",
  title: "Giảm 20.000đ",
  pointsCost: 200,
  discountAmount: "20000",
  rewardDescription: null,
  rewardProductId: null,
  isActive: true,
  availableQuantity: 12,
  issuedQuantity: 20,
};

describe("merchant voucher status action", () => {
  afterEach(cleanup);

  it("exposes the status action and waits for confirmation before toggling", async () => {
    const onToggle = vi.fn().mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <table>
          <tbody>
            <MerchantVoucherTableRow
              definition={definition}
              token="merchant-token"
              statusBusy={false}
              onToggle={onToggle}
              onDefinitionChange={vi.fn()}
            />
          </tbody>
        </table>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Tắt voucher Giảm 20.000đ" }));
    expect(screen.getByText("Tắt voucher?")).toBeInTheDocument();
    expect(onToggle).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Tắt voucher" }));
    await waitFor(() => expect(onToggle).toHaveBeenCalledOnce());
  });
});
