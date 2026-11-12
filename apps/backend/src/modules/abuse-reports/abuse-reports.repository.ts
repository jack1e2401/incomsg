import type { Prisma } from "../../generated/prisma/client.js";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import type { CreateAbuseReportInput } from "./abuse-reports.validation.js";

async function withSerializableRetry<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: "Serializable" });
    } catch (error) {
      const retryable = typeof error === "object" && error !== null && "code" in error &&
        (error.code === "P2034" || error.code === "P2002");
      if (!retryable || attempt >= 3) throw error;
    }
  }
}

export const abuseReportsRepository = {
  create(reporterId: number, input: CreateAbuseReportInput) {
    return withSerializableRetry(async (tx) => {
      const merchant = await tx.merchant.findUnique({ where: { ownerId: reporterId }, select: { id: true } });
      if (!merchant) throw new HttpError(404, "MERCHANT_NOT_FOUND");
      const membership = await tx.merchantMembership.findUnique({
        where: { memberId_merchantId: { memberId: input.memberId, merchantId: merchant.id } },
        select: { id: true },
      });
      if (!membership) throw new HttpError(404, "MEMBER_NOT_FOUND");
      if (input.orderId !== undefined) {
        const order = await tx.order.findFirst({
          where: { id: input.orderId, merchantId: merchant.id, memberId: input.memberId },
          select: { id: true },
        });
        if (!order) throw new HttpError(404, "ORDER_NOT_FOUND");
      }
      const report = await tx.merchantAbuseReport.create({
        data: { merchantId: merchant.id, reporterId, memberId: input.memberId, orderId: input.orderId, reason: input.reason },
        select: { id: true, merchantId: true, reporterId: true, memberId: true, orderId: true, reason: true, createdAt: true },
      });
      return { report };
    });
  },
};
