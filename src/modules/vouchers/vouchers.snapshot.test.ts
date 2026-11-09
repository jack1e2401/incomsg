import assert from "node:assert/strict";
import { test } from "node:test";
import { snapshotVoucherTerms } from "./vouchers.snapshot.js";

test("issued voucher terms copy and preserve the current definition values", () => {
  assert.deepEqual(snapshotVoucherTerms({
    type: "DISCOUNT", title: "Giảm 20k", pointsCost: 200, discountAmount: "20000", rewardDescription: null,
  }), {
    snapshotType: "DISCOUNT", snapshotTitle: "Giảm 20k", snapshotPointsCost: 200, snapshotDiscountAmount: "20000", snapshotRewardDescription: null,
  });
});
