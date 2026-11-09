import { env } from "../../config/env.js";
import { HttpError } from "../../lib/http-error.js";
import { ordersService } from "../orders/orders.service.js";
import { paymentsRepository } from "./payments.repository.js";
import { signVnpay } from "./vnpay-signature.js";

function vnpayDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}`;
}

export const paymentsService = {
  async createVnpayPayment(memberId: number, orderId: number, ipAddress: string) {
    if (env.paymentMode !== "vnpay") throw new HttpError(409, "VNPAY_NOT_ENABLED");
    const attempt = await paymentsRepository.createAttempt(memberId, orderId);
    if (attempt === null || attempt === "missing") throw new HttpError(404, "ORDER_NOT_FOUND");
    if (attempt === "already_paid") throw new HttpError(409, "ORDER_ALREADY_PAID");
    if (attempt === "amount_limit") throw new HttpError(400, "VNPAY_AMOUNT_LIMIT");
    if ("zeroTotal" in attempt) return { orderId, orderStatus: "PAID" as const };
    if (attempt.status === "FAILED") throw new HttpError(409, "PAYMENT_FAILED_CREATE_NEW_ORDER");
    if (attempt.status === "SUCCEEDED") throw new HttpError(409, "ORDER_ALREADY_PAID");

    const params: Record<string, string> = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: env.vnpay.tmnCode!,
      vnp_Amount: attempt.expectedAmount.toFixed(0),
      vnp_CurrCode: "VND",
      vnp_TxnRef: attempt.txnRef,
      vnp_OrderInfo: `Thanh toan don hang ${orderId}`,
      vnp_OrderType: "other",
      vnp_Locale: "vn",
      vnp_ReturnUrl: env.vnpay.returnUrl!,
      vnp_IpAddr: ipAddress || "127.0.0.1",
      vnp_CreateDate: vnpayDate(attempt.createdAt),
      vnp_IpnUrl: env.vnpay.ipnUrl!,
    };
    const url = new URL(env.vnpay.paymentUrl);
    for (const [key, value] of Object.entries(params).sort(([a], [b]) => a.localeCompare(b, "en"))) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set("vnp_SecureHash", signVnpay(params, env.vnpay.hashSecret!));
    return { orderId, txnRef: attempt.txnRef, paymentUrl: url.toString() };
  },

  async getStatus(memberId: number, orderId: number) {
    const status = await paymentsRepository.findStatus(memberId, orderId);
    if (!status) throw new HttpError(404, "ORDER_NOT_FOUND");
    return status;
  },

  async processIpn(params: URLSearchParams) {
    if (env.paymentMode !== "vnpay") return { code: "99", message: "VNPay is not enabled" };
    if (!env.vnpay.hashSecret || !env.vnpay.tmnCode) return { code: "99", message: "Configuration error" };
    const { verifyVnpay } = await import("./vnpay-signature.js");
    if (!verifyVnpay(params, env.vnpay.hashSecret)) return { code: "97", message: "Invalid signature" };
    const required = ["vnp_TxnRef", "vnp_TmnCode", "vnp_Amount", "vnp_ResponseCode", "vnp_TransactionStatus"];
    if (required.some((key) => !params.has(key))) return { code: "99", message: "Missing required fields" };
    return paymentsRepository.processIpn({
      txnRef: params.get("vnp_TxnRef")!,
      tmnCode: params.get("vnp_TmnCode")!,
      expectedTmnCode: env.vnpay.tmnCode,
      amount: params.get("vnp_Amount")!,
      responseCode: params.get("vnp_ResponseCode")!,
      transactionStatus: params.get("vnp_TransactionStatus")!,
      transactionNo: params.get("vnp_TransactionNo") ?? "",
    });
  },

  async getReturnLocation(txnRef: string | null) {
    if (!txnRef) return `${env.frontendOrigin}/`;
    const attempt = await paymentsRepository.findForReturn(txnRef);
    if (!attempt) return `${env.frontendOrigin}/`;
    return `${env.frontendOrigin}/member/${attempt.order.merchantId}/orders/${attempt.order.id}`;
  },

  payMock(memberId: number, orderId: number) {
    if (env.paymentMode === "vnpay") throw new HttpError(409, "USE_VNPAY_PAYMENT");
    return ordersService.payOrder(memberId, orderId);
  },
};
