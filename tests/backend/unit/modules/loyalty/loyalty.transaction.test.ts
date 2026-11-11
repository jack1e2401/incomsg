import assert from "node:assert/strict";
import { test } from "node:test";
import { withTransactionRetry } from "../../../../../apps/backend/src/modules/loyalty/loyalty.transaction.js";

test("retries a serialization conflict and returns the committed attempt", async () => {
  let calls = 0;
  const result = await withTransactionRetry(async () => {
    calls += 1;
    if (calls === 1) throw Object.assign(new Error("serialization conflict"), { code: "P2034" });
    return "paid";
  });
  assert.equal(result, "paid");
  assert.equal(calls, 2);
});

test("does not retry non-conflict errors", async () => {
  let calls = 0;
  await assert.rejects(withTransactionRetry(async () => {
    calls += 1;
    throw Object.assign(new Error("invalid order"), { code: "P2003" });
  }));
  assert.equal(calls, 1);
});

test("stops after three attempts for repeated transaction conflicts", async () => {
  let calls = 0;
  await assert.rejects(withTransactionRetry(async () => {
    calls += 1;
    throw Object.assign(new Error("serialization conflict"), { code: "P2034" });
  }));
  assert.equal(calls, 3);
});
