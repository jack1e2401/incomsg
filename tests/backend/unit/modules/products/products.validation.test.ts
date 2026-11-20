import assert from "node:assert/strict";
import { test } from "node:test";
import {
  readCategoryInput,
  readCategoryPatch,
  slugifyVietnamese,
} from "../../../../../apps/backend/src/modules/commerce/products/categories.validation.js";
import {
  readImageUrl,
  readMerchantProductQuery,
  readProductInput,
  readProductPatch,
  readPublicProductQuery,
  readStoreSlug,
} from "../../../../../apps/backend/src/modules/commerce/products/products.validation.js";

const invalidInput = { statusCode: 400, code: "INVALID_INPUT" };

test("defaults to SALE when kind is omitted", () => {
  assert.deepEqual(readProductInput({ name: " Coffee ", price: "20000" }), {
    name: "Coffee",
    kind: "SALE",
    price: "20000",
    initialQuantity: 0,
  });
});

test("accepts an explicit SALE product with a positive price", () => {
  assert.deepEqual(readProductInput({ name: "Coffee", kind: "SALE", price: "20000" }), {
    name: "Coffee",
    kind: "SALE",
    price: "20000",
    initialQuantity: 0,
  });
});

test("accepts a REWARD product without a price", () => {
  const input = {
    name: " Ly sứ ",
    kind: "REWARD",
    description: "Một chiếc ly",
    imageUrl: "https://example.test/cup.jpg",
  };
  assert.deepEqual(readProductInput(input), { ...input, name: "Ly sứ", initialQuantity: 0 });
});

test("rejects an unsupported product kind", () => {
  assert.throws(() => readProductInput({ name: "Coffee", kind: "UNKNOWN", price: "20000" }), invalidInput);
});

test("rejects SALE products without a positive price", () => {
  for (const input of [{}, { price: "0" }, { price: "-1" }]) {
    assert.throws(() => readProductInput({ name: "Coffee", kind: "SALE", ...input }), invalidInput);
  }
  assert.throws(() => readProductInput({ name: "Coffee" }), invalidInput);
});

test("rejects any price field on REWARD products", () => {
  for (const price of ["0", "20000", null]) {
    assert.throws(() => readProductInput({ name: "Ly sứ", kind: "REWARD", price }), invalidInput);
  }
});

test("rejects kind in a product patch", () => {
  assert.throws(() => readProductPatch({ name: "Ly sứ", kind: "REWARD" }), invalidInput);
});

test("readImageUrl accepts http, https, /images/, and /uploads/ paths and rejects unsafe URLs", () => {
  assert.equal(readImageUrl(null), null);
  assert.equal(readImageUrl("https://cdn.example.com/a.jpg"), "https://cdn.example.com/a.jpg");
  assert.equal(readImageUrl("http://localhost:3000/img.png"), "http://localhost:3000/img.png");
  assert.equal(readImageUrl("/images/coffee.jpg"), "/images/coffee.jpg");
  assert.equal(readImageUrl("/uploads/merchant-1/pic.webp"), "/uploads/merchant-1/pic.webp");

  for (const bad of [
    "",
    "/images/",
    "/uploads/",
    "/uploads/../secret.txt",
    "/other/path.jpg",
    "//evil.example/img.jpg",
    "javascript:alert(1)",
    "data:image/png;base64,abc",
    "https://example.com/has space.jpg",
  ]) {
    assert.throws(() => readImageUrl(bad), invalidInput);
  }
});

test("accepts catalog V2 fields (sku, categoryId, lowStockThreshold, richDescription, images)", () => {
  const parsed = readProductInput({
    name: "Cà phê muối",
    price: "45000",
    sku: "  CF-MUOI-01  ",
    categoryId: 3,
    lowStockThreshold: 12,
    richDescription: "Hạt Arabica Cầu Đất\nRang vừa < 200 độ.",
    images: [
      { url: "/uploads/merchant-1/side.jpg", altText: "Góc nghiêng", sortOrder: 2 },
      { url: "/images/main.jpg", sortOrder: 0 },
    ],
  });

  assert.equal(parsed.sku, "CF-MUOI-01");
  assert.equal(parsed.categoryId, 3);
  assert.equal(parsed.lowStockThreshold, 12);
  assert.equal(parsed.imageUrl, "/images/main.jpg");
  assert.deepEqual(parsed.images, [
    { url: "/images/main.jpg", altText: null, sortOrder: 0 },
    { url: "/uploads/merchant-1/side.jpg", altText: "Góc nghiêng", sortOrder: 2 },
  ]);
});

test("rejects invalid sku, threshold, HTML in richDescription, and > 10 gallery images", () => {
  assert.throws(() => readProductInput({ name: "A", price: "1000", sku: "   " }), invalidInput);
  assert.throws(() => readProductInput({ name: "A", price: "1000", sku: "x".repeat(65) }), invalidInput);
  assert.throws(() => readProductInput({ name: "A", price: "1000", lowStockThreshold: -1 }), invalidInput);
  assert.throws(() => readProductInput({ name: "A", price: "1000", lowStockThreshold: 100_001 }), invalidInput);
  assert.throws(
    () => readProductInput({ name: "A", price: "1000", richDescription: "<script>alert(1)</script>" }),
    invalidInput,
  );
  assert.throws(
    () => readProductInput({ name: "A", price: "1000", richDescription: "<p>Hello</p>" }),
    invalidInput,
  );
  assert.throws(
    () => readProductInput({ name: "A", price: "1000", richDescription: "x".repeat(5001) }),
    invalidInput,
  );

  const elevenImages = Array.from({ length: 11 }, (_, idx) => ({ url: `/images/p-${idx}.jpg` }));
  assert.throws(() => readProductInput({ name: "A", price: "1000", images: elevenImages }), invalidInput);
});

test("patch with empty images array clears synced imageUrl", () => {
  const patch = readProductPatch({ images: [] });
  assert.deepEqual(patch, { images: [], imageUrl: null });
});

test("slugifyVietnamese transliterates Vietnamese characters cleanly", () => {
  assert.equal(slugifyVietnamese("Cà phê & Trà sữa"), "ca-phe-tra-sua");
  assert.equal(slugifyVietnamese("Đồ uống đá xay 100%"), "do-uong-da-xay-100");
});

test("validates category input and patch", () => {
  assert.deepEqual(readCategoryInput({ name: "  Đồ uống đặc biệt  " }), {
    name: "Đồ uống đặc biệt",
    slug: "do-uong-dac-biet",
    sortOrder: 0,
  });

  assert.deepEqual(
    readCategoryInput({ name: "Gốm sứ", slug: "gom-su", description: "  Thủ công  ", sortOrder: 5 }),
    { name: "Gốm sứ", slug: "gom-su", description: "Thủ công", sortOrder: 5 },
  );

  assert.throws(() => readCategoryInput({ name: "Gốm", slug: "Invalid Slug!" }), invalidInput);
  assert.throws(() => readCategoryInput({ name: "Gốm", description: "<b>XSS</b>" }), invalidInput);
  assert.throws(() => readCategoryPatch({}), invalidInput);
  assert.deepEqual(readCategoryPatch({ name: "Mới", sortOrder: 2 }), { name: "Mới", sortOrder: 2 });
});

test("validates merchant and public product list query parameters", () => {
  assert.deepEqual(readMerchantProductQuery({}), {
    sort: "newest",
    page: 1,
    limit: 20,
  });

  assert.deepEqual(
    readMerchantProductQuery({
      q: "  espresso ",
      categoryId: "4",
      status: "ACTIVE",
      kind: "SALE",
      lowStock: "true",
      sort: "price_asc",
      page: "2",
      limit: "50",
    }),
    {
      q: "espresso",
      categoryId: 4,
      status: "ACTIVE",
      kind: "SALE",
      lowStock: true,
      sort: "price_asc",
      page: 2,
      limit: 50,
    },
  );

  assert.throws(() => readMerchantProductQuery({ limit: "101" }), invalidInput);
  assert.throws(() => readMerchantProductQuery({ page: "0" }), invalidInput);
  assert.throws(() => readMerchantProductQuery({ sort: "random" }), invalidInput);
  assert.throws(() => readPublicProductQuery({ categoryId: "abc" }), invalidInput);
  assert.equal(readStoreSlug("  moc-studio "), "moc-studio");
  assert.throws(() => readStoreSlug(""), invalidInput);
});
