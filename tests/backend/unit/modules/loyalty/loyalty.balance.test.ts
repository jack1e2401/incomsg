import assert from "node:assert/strict";
import { test } from "node:test";
import { points } from "../../../../../apps/backend/src/modules/loyalty/loyalty.calculation.js";
import { describeBalance, describeWallet } from "../../../../../apps/backend/src/modules/loyalty/loyalty.balance.js";

test("two fractional credits accumulate into an integer and carry", () => {
  assert.deepEqual(describeBalance(points("0.6").plus("0.6")), {
    exactBalance: "1.2", availablePoints: 1, fractionalCarry: "0.2", pointDebt: "0",
  });
});

test("a debit preserves carry and earning settles debt before spendable points", () => {
  const afterDebit = points("1.2").minus("1");
  assert.equal(describeBalance(afterDebit).fractionalCarry, "0.2");
  const debt = describeBalance(afterDebit.minus("0.6"));
  assert.deepEqual(debt, { exactBalance: "-0.4", availablePoints: 0, fractionalCarry: "0", pointDebt: "0.4" });
  assert.equal(describeBalance(points(debt.exactBalance).plus("1.4")).availablePoints, 1);
});

test("wallet projections preserve all twelve decimals near the legacy capacity limit", () => {
  const wallet = describeWallet({ exactBalance: points("2147483646.999999999999"), netLifetimeEarned: points("2147483646.999999999999") });
  assert.equal(wallet.fractionalCarry, "0.999999999999");
  assert.equal(wallet.netLifetimeEarned, "2147483646.999999999999");
  assert.equal(wallet.lifetimeEarnedPoints, 2147483646);
  assert.equal(describeBalance(points("0")).fractionalCarry, "0");
});
