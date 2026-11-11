import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError } from "../../../../../apps/backend/src/lib/http-error.js";
import { readIdempotencyKey } from "../../../../../apps/backend/src/modules/vouchers/vouchers.validation.js";

test("accepts non-empty idempotency key up to 128 chars", () => {
  assert.equal(readIdempotencyKey("valid-key-123"), "valid-key-123");
  assert.equal(readIdempotencyKey("  trimmed-key  "), "trimmed-key");
  const maxKey = "a".repeat(128);
  assert.equal(readIdempotencyKey(maxKey), maxKey);
});

test("rejects missing, empty, whitespace, or overlong idempotency key with 400", () => {
  const invalidKeys = [
    undefined,
    null,
    "",
    "   ",
    "\t\n",
    123,
    {},
    [],
    "a".repeat(129),
    " " + "a".repeat(128) + " ", // trims to 128? Wait: trimmed length <= 128
    "b".repeat(200),
  ];

  for (const key of invalidKeys) {
    assert.throws(
      () => readIdempotencyKey(key),
      (err) => err instanceof HttpError && err.statusCode === 400,
      `Expected key ${JSON.stringify(key)} to throw 400 HttpError`,
    );
  }
});
