import assert from "node:assert/strict";
import { test } from "node:test";
import { readProductInput, readProductPatch } from "../../../../../apps/backend/src/modules/products/products.validation.js";

const invalidInput = { statusCode: 400, code: "INVALID_INPUT" };

test("defaults to SALE when kind is omitted", () => {
  assert.deepEqual(readProductInput({ name: " Coffee ", price: "20000" }), {
    name: "Coffee", kind: "SALE", price: "20000",
    initialQuantity: 0,
  });
});

test("accepts an explicit SALE product with a positive price", () => {
  assert.deepEqual(readProductInput({ name: "Coffee", kind: "SALE", price: "20000" }), {
    name: "Coffee", kind: "SALE", price: "20000",
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
