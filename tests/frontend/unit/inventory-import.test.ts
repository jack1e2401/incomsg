import { describe, expect, it } from "vitest";
import { parseInventoryImportRows } from "../../../apps/frontend/src/features/merchant/inventory-import";
import type { ProductDto } from "../../../apps/frontend/src/api/commerce-types";

const products: ProductDto[] = [
  {
    id: 12,
    merchantId: 4,
    name: "Trà xanh",
    description: null,
    imageUrl: null,
    kind: "SALE",
    price: "25000",
    status: "ACTIVE",
    inventory: { availableQuantity: 8, onHandQuantity: 8, reservedQuantity: 0 },
  },
  {
    id: 13,
    merchantId: 4,
    name: "Túi quà",
    description: null,
    imageUrl: null,
    kind: "REWARD",
    price: "0",
    status: "ACTIVE",
    inventory: { availableQuantity: 2, onHandQuantity: 2, reservedQuantity: 0 },
  },
];

describe("inventory Excel import parser", () => {
  it("maps product IDs and positive integer stock-in quantities", () => {
    const result = parseInventoryImportRows(
      [["Mã sản phẩm", "Số lượng nhập"], [12, 5], ["13", "2"]],
      products,
    );

    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { rowNumber: 2, productId: 12, productName: "Trà xanh", quantity: 5 },
      { rowNumber: 3, productId: 13, productName: "Túi quà", quantity: 2 },
    ]);
  });

  it("rejects missing columns, unknown products, duplicate IDs, and invalid quantities", () => {
    const missingColumns = parseInventoryImportRows([["Tên", "Số lượng"], ["Trà xanh", 2]], products);
    expect(missingColumns.errors).toContain("Thiếu cột mã sản phẩm (ID sản phẩm).");

    const result = parseInventoryImportRows(
      [["Product ID", "Quantity"], [12, 0], [99, 1], [12, 3], [13, 1.5]],
      products,
    );
    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([
      "Dòng 2: Số lượng phải là số nguyên dương.",
      "Dòng 3: Không tìm thấy sản phẩm #99 trong cửa hàng.",
      "Dòng 4: Mã sản phẩm #12 bị lặp.",
      "Dòng 5: Số lượng phải là số nguyên dương.",
    ]);
  });

  it("requires at least one import row", () => {
    const result = parseInventoryImportRows([["ID sản phẩm", "Số lượng"]], products);
    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual(["File không có dòng sản phẩm cần nhập."]);
  });
});
