import assert from "node:assert/strict";
import { test } from "node:test";
import { signVnpay, verifyVnpay } from "./vnpay-signature.js";

const secret = "test-secret-for-vnpay-signature";
const entries = { vnp_Amount: "1000000", vnp_OrderInfo: "Thanh toan don hang 1", vnp_TxnRef: "order-1" };

test("VNPay signature is stable regardless of input key order", () => {
  assert.equal(signVnpay(entries, secret), signVnpay({ vnp_TxnRef: "order-1", vnp_Amount: "1000000", vnp_OrderInfo: "Thanh toan don hang 1" }, secret));
});

test("VNPay signature detects changed or missing callback fields", () => {
  const signature = signVnpay(entries, secret);
  const signed = new URLSearchParams({ ...entries, vnp_SecureHash: signature });
  assert.equal(verifyVnpay(signed, secret), true);
  signed.set("vnp_Amount", "1000001");
  assert.equal(verifyVnpay(signed, secret), false);
  assert.equal(verifyVnpay(new URLSearchParams(entries), secret), false);
});

test("VNPay signature rejects malformed hash and duplicate query parameters", () => {
  const duplicate = new URLSearchParams({ ...entries, vnp_SecureHash: signVnpay(entries, secret) });
  duplicate.append("vnp_Amount", "1000000");
  assert.equal(verifyVnpay(duplicate, secret), false);
  assert.equal(verifyVnpay(new URLSearchParams({ ...entries, vnp_SecureHash: "not-a-hash" }), secret), false);
});
