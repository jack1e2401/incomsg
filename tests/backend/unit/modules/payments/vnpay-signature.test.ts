import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalVnpayData, signVnpay, verifyVnpay } from "../../../../../apps/backend/src/modules/payments/vnpay-signature.js";

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

test("matches an independently computed HMAC vector using PHP urlencode semantics", () => {
  const sample = {
    vnp_Amount: "1806000",
    vnp_Command: "pay",
    vnp_CreateDate: "20210801153333",
    vnp_CurrCode: "VND",
    vnp_IpAddr: "127.0.0.1",
    vnp_Locale: "vn",
    vnp_OrderInfo: "Thanh toan don hang :5",
    vnp_OrderType: "other",
    vnp_ReturnUrl: "https://domainmerchant.vn/ReturnUrl",
    vnp_TmnCode: "DEMOV210",
    vnp_TxnRef: "5",
    vnp_Version: "2.1.0",
  };
  assert.equal(canonicalVnpayData(sample), "vnp_Amount=1806000&vnp_Command=pay&vnp_CreateDate=20210801153333&vnp_CurrCode=VND&vnp_IpAddr=127.0.0.1&vnp_Locale=vn&vnp_OrderInfo=Thanh+toan+don+hang+%3A5&vnp_OrderType=other&vnp_ReturnUrl=https%3A%2F%2Fdomainmerchant.vn%2FReturnUrl&vnp_TmnCode=DEMOV210&vnp_TxnRef=5&vnp_Version=2.1.0");
  assert.equal(signVnpay(sample, secret), "314d083eeafc800752f69d24e018488db308be15d0107c96e91292e1740b553a28c051e8da2685a931b6c41915f9901639adf138ab83c7b36b2e3cc7c1d33a04");
  assert.equal(canonicalVnpayData({ vnp_Special: "~ + café" }), "vnp_Special=%7E+%2B+caf%C3%A9");
});
