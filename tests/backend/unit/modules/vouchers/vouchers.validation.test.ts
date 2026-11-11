import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError } from "../../../../../apps/backend/src/lib/http-error.js";
import { readDefinitionInput } from "../../../../../apps/backend/src/modules/vouchers/vouchers.validation.js";

test("accepts valid discount and reward definitions with distinct fields", () => {
  assert.deepEqual(readDefinitionInput({ type: "DISCOUNT", title: " Giảm 20k ", pointsCost: 200, discountAmount: "20000" }), {
    type: "DISCOUNT", title: "Giảm 20k", pointsCost: 200, discountAmount: "20000", rewardDescription: null, rewardProductId: null,
  });
  assert.deepEqual(readDefinitionInput({ type: "REWARD", title: "Ly sứ", pointsCost: 500, rewardProductId: 12 }), {
    type: "REWARD", title: "Ly sứ", pointsCost: 500, discountAmount: null, rewardDescription: null, rewardProductId: 12,
  });
});

test("rejects invalid or mixed voucher definition fields", () => {
  for (const input of [
    { type: "DISCOUNT", title: "Sai", pointsCost: 0, discountAmount: "100" },
    { type: "DISCOUNT", title: "Sai", pointsCost: 1, discountAmount: "-1" },
    { type: "DISCOUNT", title: "Sai", pointsCost: 1, discountAmount: "1.5" },
    { type: "DISCOUNT", title: "Sai", pointsCost: 1, discountAmount: "100", rewardDescription: "quà" },
    { type: "DISCOUNT", title: "Sai", pointsCost: 1, discountAmount: "100", rewardProductId: 12 },
    { type: "REWARD", title: "Sai", pointsCost: 1, rewardDescription: "Không có sản phẩm" },
    { type: "REWARD", title: "Sai", pointsCost: 1, rewardProductId: 12, rewardDescription: "Tên do FE gửi" },
    { type: "REWARD", title: "Sai", pointsCost: 1, rewardProductId: 0 },
    { type: "REWARD", title: "Sai", pointsCost: 1, rewardDescription: "" },
    { type: "NOPE", title: "Sai", pointsCost: 1 },
    { type: "REWARD", pointsCost: 10, rewardDescription: "Quà" },
  ]) assert.throws(() => readDefinitionInput(input), (error) => error instanceof HttpError && error.statusCode === 400);
});
