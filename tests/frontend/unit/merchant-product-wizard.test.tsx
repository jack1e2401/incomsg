// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProductDto } from "../../../apps/frontend/src/api/commerce-types";
import { MerchantProductWizard } from "../../../apps/frontend/src/features/merchant/MerchantProductWizard";

const api = vi.hoisted(() => ({ createProduct: vi.fn(), updateProduct: vi.fn() }));
vi.mock("../../../apps/frontend/src/api/commerce-http", () => ({
  createCommerceClient: () => api,
  translateApiError: (message: string) => message,
}));

const product: ProductDto = {
  id: 588, merchantId: 7, name: "Bánh mì", kind: "SALE", price: "42000",
  status: "ACTIVE", description: "Nướng mỗi ngày", richDescription: "Bảo quản nơi khô ráo",
  sku: "BN-03", categoryId: null, imageUrl: null, lowStockThreshold: 5,
  category: null, images: [], isLowStock: false, inventory: { availableQuantity: 10 },
};

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Merchant product wizard review", () => {
  it("does not submit when Continue changes into the final save button", async () => {
    const user = userEvent.setup();
    api.updateProduct.mockResolvedValue({ product });
    const onSaved = vi.fn();
    render(<MerchantProductWizard product={product} categories={[]} token="test-token" onCancel={vi.fn()} onSaved={onSaved} />);
    fireEvent.submit(screen.getByLabelText("Tên sản phẩm").closest("form")!);
    expect(screen.getByLabelText("Mô tả ngắn")).toBeInTheDocument();
    expect(api.updateProduct).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(screen.getByText("Kiểm tra thông tin")).toBeInTheDocument();
    expect(api.updateProduct).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    expect(api.updateProduct).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith(product, false);
  });

  it("opens review from the step navigation with all entered descriptions and no save", () => {
    const onSaved = vi.fn();
    render(<MerchantProductWizard product={product} categories={[]} token="test-token" onCancel={vi.fn()} onSaved={onSaved} />);
    fireEvent.click(screen.getByText("Kiểm tra", { exact: true }));
    expect(screen.getByText("Kiểm tra thông tin")).toBeInTheDocument();
    expect(screen.getByText("Nướng mỗi ngày")).toBeInTheDocument();
    expect(screen.getByText("Bảo quản nơi khô ráo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Thông tin", { exact: true }));
    expect(screen.getByLabelText("Tên sản phẩm")).toHaveValue("Bánh mì");
  });

  it("blocks jumping to review when required product data is missing", () => {
    render(<MerchantProductWizard product={null} categories={[]} token="test-token" onCancel={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByText("Kiểm tra", { exact: true }));
    expect(screen.getByText("Nhập tên sản phẩm để tiếp tục.")).toBeInTheDocument();
    expect(screen.getByLabelText("Tên sản phẩm")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tạo sản phẩm" })).not.toBeInTheDocument();
  });
});
