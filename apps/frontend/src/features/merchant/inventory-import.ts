import type { ProductDto } from "../../api/commerce-types";

export type InventoryImportRow = {
  rowNumber: number;
  productId: number;
  productName: string;
  quantity: number;
};

export type InventoryImportParseResult = {
  rows: InventoryImportRow[];
  errors: string[];
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function positiveInteger(value: unknown): number | null {
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (typeof value !== "string" || !/^\s*\d+\s*$/.test(value)) return null;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 2_147_483_647 ? parsed : null;
}

export function parseInventoryImportRows(
  sheet: unknown[][],
  products: ProductDto[],
): InventoryImportParseResult {
  const headers = sheet[0] ?? [];
  const normalized = headers.map(normalizeHeader);
  const productColumn = normalized.findIndex((header) =>
    ["product id", "id san pham", "ma san pham"].includes(header),
  );
  const quantityColumn = normalized.findIndex((header) =>
    ["quantity", "so luong", "so luong nhap"].includes(header),
  );
  const errors: string[] = [];
  if (productColumn < 0) errors.push("Thiếu cột mã sản phẩm (ID sản phẩm).");
  if (quantityColumn < 0) errors.push("Thiếu cột số lượng nhập.");
  if (errors.length) return { rows: [], errors };

  const productsById = new Map(products.map((product) => [product.id, product]));
  const seenIds = new Set<number>();
  const rows: InventoryImportRow[] = [];

  for (let index = 1; index < sheet.length; index += 1) {
    const cells = sheet[index] ?? [];
    if (cells.every((cell) => String(cell ?? "").trim() === "")) continue;
    const rowNumber = index + 1;
    const productId = positiveInteger(cells[productColumn]);
    const quantity = positiveInteger(cells[quantityColumn]);
    if (!productId) {
      errors.push(`Dòng ${rowNumber}: Mã sản phẩm phải là số nguyên dương.`);
      continue;
    }
    const product = productsById.get(productId);
    if (!product) {
      errors.push(`Dòng ${rowNumber}: Không tìm thấy sản phẩm #${productId} trong cửa hàng.`);
      continue;
    }
    if (seenIds.has(productId)) {
      errors.push(`Dòng ${rowNumber}: Mã sản phẩm #${productId} bị lặp.`);
      continue;
    }
    seenIds.add(productId);
    if (!quantity) {
      errors.push(`Dòng ${rowNumber}: Số lượng phải là số nguyên dương.`);
      continue;
    }
    rows.push({ rowNumber, productId, productName: product.name, quantity });
  }
  if (!rows.length && !errors.length) errors.push("File không có dòng sản phẩm cần nhập.");
  return { rows: errors.length ? [] : rows, errors };
}
