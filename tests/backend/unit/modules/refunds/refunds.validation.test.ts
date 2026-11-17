import assert from "node:assert/strict";
import test from "node:test";
import { reasonInput } from "../../../../../apps/backend/src/modules/refunds/refunds.validation.js";
import { HttpError } from "../../../../../apps/backend/src/lib/http-error.js";

test("refund request reason is trimmed and length limited", () => {
  assert.equal(reasonInput("  Sai sản phẩm  "), "Sai sản phẩm");
  assert.throws(() => reasonInput("   "), HttpError);
  assert.throws(() => reasonInput("x".repeat(256)), HttpError);
});
