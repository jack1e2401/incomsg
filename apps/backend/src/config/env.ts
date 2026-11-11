import "dotenv/config";

const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const paymentMode = process.env.PAYMENT_MODE ?? "mock";
if (paymentMode !== "mock" && paymentMode !== "vnpay") {
  throw new Error("PAYMENT_MODE must be mock or vnpay");
}

const vnpay = {
  paymentUrl: process.env.VNPAY_PAYMENT_URL ?? "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
  tmnCode: process.env.VNPAY_TMN_CODE,
  hashSecret: process.env.VNPAY_HASH_SECRET,
  returnUrl: process.env.VNPAY_RETURN_URL,
};
if (paymentMode === "vnpay") {
  if (!vnpay.tmnCode || !/^[A-Za-z0-9]{8}$/.test(vnpay.tmnCode)) throw new Error("VNPAY_TMN_CODE must contain 8 alphanumeric characters");
  if (!vnpay.hashSecret || Buffer.byteLength(vnpay.hashSecret, "utf8") < 16) throw new Error("VNPAY_HASH_SECRET must contain at least 16 bytes");
  if (!vnpay.returnUrl) throw new Error("VNPAY_RETURN_URL is required when PAYMENT_MODE=vnpay");
  const returnUrl = new URL(vnpay.returnUrl);
  if (returnUrl.protocol !== "https:") throw new Error("VNPAY_RETURN_URL must use HTTPS");
  const paymentUrl = new URL(vnpay.paymentUrl);
  if (paymentUrl.protocol !== "https:" || paymentUrl.hostname !== "sandbox.vnpayment.vn") {
    throw new Error("VNPAY_PAYMENT_URL must be the VNPay Sandbox HTTPS endpoint");
  }
}

export const env = {
  port,
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  paymentMode,
  vnpay,
};

if (!env.jwtSecret || Buffer.byteLength(env.jwtSecret, "utf8") < 32) {
  throw new Error("JWT_SECRET must be configured with at least 32 bytes");
}
