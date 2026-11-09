import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError } from "../../lib/http-error.js";
import { readDefinitionInput } from "./vouchers.validation.js";

test("accepts valid discount and reward definitions with distinct fields", () => {
  assert.deepEqual(readDefinitionInput({ type: "DISCOUNT", title: " Giảm 20k ", pointsCost: 200, discountAmount: "20000" }), {
    type: "DISCOUNT", title: "Giảm 20k", pointsCost: 200, discountAmount: "20000", rewardDescription: null,
  });
  assert.deepEqual(readDefinitionInput({ type: "REWARD", title: "Ly sứ", pointsCost: 500, rewardDescription: "Một chiếc ly" }), {
    type: "REWARD", title: "Ly sứ", pointsCost: 500, discountAmount: null, rewardDescription: "Một chiếc ly",
  });
});

test("rejects invalid or mixed voucher definition fields", () => {
  for (const input of [
    { type: "DISCOUNT", title: "Sai", pointsCost: 0, discountAmount: "100" },
    { type: "DISCOUNT", title: "Sai", pointsCost: 1, discountAmount: "-1" },
    { type: "DISCOUNT", title: "Sai", pointsCost: 1, discountAmount: "1.5" },
    { type: "DISCOUNT", title: "Sai", pointsCost: 1, discountAmount: "100", rewardDescription: "quà" },
    { type: "REWARD", title: "Sai", pointsCost: 1, rewardDescription: "" },
    { type: "NOPE", title: "Sai", pointsCost: 1 },
    { type: "REWARD", pointsCost: 10, rewardDescription: "Quà" },
  ]) assert.throws(() => readDefinitionInput(input), (error) => error instanceof HttpError && error.statusCode === 400);
});
