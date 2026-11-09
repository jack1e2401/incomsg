import { createHmac, timingSafeEqual } from "node:crypto";

function formEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, "+");
}

export function canonicalVnpayData(params: Record<string, string>): string {
  return Object.entries(params)
    .filter(([key]) => key !== "vnp_SecureHash" && key !== "vnp_SecureHashType" && key.startsWith("vnp_"))
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([key, value]) => `${formEncode(key)}=${formEncode(value)}`)
    .join("&");
}

export function signVnpay(params: Record<string, string>, secret: string): string {
  return createHmac("sha512", secret).update(canonicalVnpayData(params), "utf8").digest("hex");
}

export function verifyVnpay(params: URLSearchParams, secret: string): boolean {
  const signature = params.get("vnp_SecureHash");
  if (!signature || !/^[a-f\d]{128}$/i.test(signature)) return false;
  const values: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    if (key === "vnp_SecureHash" || key === "vnp_SecureHashType") continue;
    if (Object.hasOwn(values, key)) return false;
    values[key] = value;
  }
  const expected = Buffer.from(signVnpay(values, secret), "hex");
  const received = Buffer.from(signature, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}
