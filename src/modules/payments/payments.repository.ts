import { randomUUID } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { withTransactionRetry } from "../loyalty/loyalty.transaction.js";
import { loyaltyRepository } from "../loyalty/loyalty.repository.js";

const maxVnpayAmount = 999_999_999_999n;

export const paymentsRepository = {
  async createAttempt(memberId: number, orderId: number) {
    const existing = await prisma.paymentAttempt.findUnique({ where: { orderId }, include: { order: true } });
    if (existing) return existing.order.memberId === memberId ? existing : null;
    const order = await prisma.order.findFirst({ where: { id: orderId, memberId } });
    if (!order) return null;
    if (order.status !== "PENDING") return "already_paid" as const;
    if (order.total.isZero()) {
      const paid = await withTransactionRetry(() => prisma.$transaction(
        (tx) => loyaltyRepository.completePaidOrder(tx, orderId, memberId),
        { isolationLevel: "Serializable" },
      ));
      return paid === "missing" || paid === "already_paid" ? paid : { zeroTotal: true, order: paid } as const;
    }
    const amount = BigInt(order.total.toFixed(0)) * 100n;
    if (amount > maxVnpayAmount) return "amount_limit" as const;
    try {
      return await prisma.paymentAttempt.create({
        data: { orderId, txnRef: randomUUID().replaceAll("-", ""), expectedAmount: new Prisma.Decimal(amount.toString()) },
        include: { order: true },
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        const raced = await prisma.paymentAttempt.findUnique({ where: { orderId }, include: { order: true } });
        if (raced?.order.memberId === memberId) return raced;
      }
      throw error;
    }
  },

  async findStatus(memberId: number, orderId: number) {
    const order = await prisma.order.findFirst({ where: { id: orderId, memberId }, select: { id: true, status: true } });
    if (!order) return null;
    const attempt = await prisma.paymentAttempt.findUnique({ where: { orderId }, select: { status: true } });
    return { orderStatus: order.status, paymentStatus: attempt?.status ?? null };
  },

  async findForReturn(txnRef: string) {
    return prisma.paymentAttempt.findUnique({ where: { txnRef }, include: { order: { select: { id: true, merchantId: true } } } });
  },

  async processIpn(input: {
    txnRef: string;
    tmnCode: string;
    expectedTmnCode: string;
    amount: string;
    responseCode: string;
    transactionStatus: string;
    transactionNo: string;
  }): Promise<{ code: string; message: string }> {
    if (input.transactionNo && !/^\d{1,15}$/.test(input.transactionNo)) return { code: "99", message: "Invalid transaction number" };
    const attempt = await prisma.paymentAttempt.findUnique({ where: { txnRef: input.txnRef }, include: { order: true } });
    if (!attempt) return { code: "01", message: "Order not found" };
    if (input.tmnCode !== input.expectedTmnCode) return { code: "04", message: "Invalid merchant" };
    if (!/^\d{1,12}$/.test(input.amount) || attempt.expectedAmount.toFixed(0) !== input.amount) {
      return { code: "04", message: "Invalid amount" };
    }
    if (attempt.status !== "CREATED") return { code: "02", message: "Order already confirmed" };
    if (input.transactionStatus === "01") return { code: "00", message: "Transaction is incomplete" };
    const successful = input.responseCode === "00" && input.transactionStatus === "00";
    const terminalFailure = input.responseCode !== "00" || ["02", "04", "07"].includes(input.transactionStatus);
    if (!successful && !terminalFailure) return { code: "00", message: "Transaction result is pending" };

    try {
      return await withTransactionRetry(() => prisma.$transaction(async (tx) => {
        const claimed = await tx.paymentAttempt.updateMany({
          where: { id: attempt.id, status: "CREATED" },
          data: {
            status: successful ? "SUCCEEDED" : "FAILED",
            transactionNo: input.transactionNo || null,
            confirmedAt: new Date(),
          },
        });
        if (claimed.count !== 1) return { code: "02", message: "Order already confirmed" };
        if (input.responseCode !== "00" || input.transactionStatus !== "00") {
          return { code: "00", message: "Confirm Success" };
        }
        const paid = await loyaltyRepository.completePaidOrder(tx, attempt.orderId, attempt.order.memberId);
        if (paid === "missing") return { code: "01", message: "Order not found" };
        if (paid === "already_paid") return { code: "02", message: "Order already confirmed" };
        return { code: "00", message: "Confirm Success" };
      }, { isolationLevel: "Serializable" }));
    } catch {
      return { code: "99", message: "Unknown error" };
    }
  },
};
