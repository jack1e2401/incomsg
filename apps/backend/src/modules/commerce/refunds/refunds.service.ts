import { prisma } from "../../../lib/prisma.js";
import { HttpError } from "../../../lib/http-error.js";
import { merchantService } from "../../merchants/profile/merchant.service.js";
import { ordersRepository } from "../orders/orders.repository.js";
import { completeMockRefund } from "./refunds.complete.js";
import { toOrderDto } from "../orders/orders.serialization.js";
import { withTransactionRetry } from "../../../lib/prisma-transaction.js";
import { RefundRequestStatus } from "../../../generated/prisma/enums.js";

import { reasonInput } from "./refunds.validation.js";
const pendingStatuses: RefundRequestStatus[] = ["PENDING_MERCHANT", "PENDING_ADMIN"];
function statusFilter(status: unknown) {
  if (status === undefined || status === "") return {};
  if (typeof status !== "string" || !Object.hasOwn(RefundRequestStatus, status)) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return { status: status === "PENDING_MERCHANT" ? { in: pendingStatuses } : status as RefundRequestStatus };
}

function paging(query: Record<string, unknown>) { const page = Math.max(1, Number(query.page) || 1); const limit = Math.min(100, Math.max(1, Number(query.limit) || 20)); return { page, limit }; }
function pageInfo(page: number, limit: number, totalItems: number) { return { page, limit, totalItems, totalPages: totalItems ? Math.ceil(totalItems / limit) : 0 }; }

export const refundsService = {
  async request(memberId: number, orderId: number, reasonValue: unknown) {
    const reason = reasonInput(reasonValue);
    const order = await prisma.order.findFirst({ where: { id: orderId, memberId }, include: { paymentAttempt: true, refund: true } });
    if (!order) throw new HttpError(404, "ORDER_NOT_FOUND");
    if (order.paymentAttempt?.status === "SUCCEEDED") throw new HttpError(409, "VNPAY_REFUND_NOT_SUPPORTED");
    if (await prisma.refundRequest.findUnique({ where: { orderId }, select: { id: true } })) throw new HttpError(409, "REFUND_REQUEST_ALREADY_EXISTS");
    if (order.status !== "PAID" || order.refund) throw new HttpError(409, "ORDER_NOT_REFUNDABLE");
    try { return await prisma.refundRequest.create({ data: { orderId, memberId, merchantId: order.merchantId, reason } }); }
    catch (error) { if (typeof error === "object" && error && "code" in error && error.code === "P2002") throw new HttpError(409, "REFUND_REQUEST_ALREADY_EXISTS"); throw error; }
  },
  async getMember(memberId: number, orderId: number) {
    const order = await prisma.order.findFirst({ where: { id: orderId, memberId }, select: { id: true } }); if (!order) throw new HttpError(404, "ORDER_NOT_FOUND");
    const request = await prisma.refundRequest.findUnique({ where: { orderId }, select: { id: true, orderId: true, reason: true, status: true, requestedAt: true, merchantDecisionReason: true, adminDecisionReason: true } });
    if (!request || request.status === "REJECTED") return request;
    return { ...request, merchantDecisionReason: null, adminDecisionReason: null };
  },
  async listMerchant(ownerId: number, query: Record<string, unknown>) {
    const merchant = await merchantService.getOwnStore(ownerId); const { page, limit } = paging(query); const where = { merchantId: merchant.id, ...statusFilter(query.status) };
    const [rows, totalItems] = await Promise.all([prisma.refundRequest.findMany({ where, include: { order: { select: { total: true, status: true } }, member: { select: { id: true, email: true } } }, orderBy: [{ requestedAt: "desc" }, { id: "desc" }], skip: (page - 1) * limit, take: limit }), prisma.refundRequest.count({ where })]);
    const items = rows.map(({ order, member, ...row }) => ({ ...row, orderTotalVnd: order.total.toFixed(0), orderStatus: order.status, memberEmail: member.email }));
    return { items, pagination: pageInfo(page, limit, totalItems) };
  },
  async listAdmin(query: Record<string, unknown>) {
    const { page, limit } = paging(query); const where = statusFilter(query.status);
    const [rows, totalItems] = await Promise.all([prisma.refundRequest.findMany({ where, include: { order: { select: { total: true, status: true } }, merchant: { select: { id: true, name: true, slug: true } }, member: { select: { id: true, email: true } } }, orderBy: [{ requestedAt: "desc" }, { id: "desc" }], skip: (page - 1) * limit, take: limit }), prisma.refundRequest.count({ where })]);
    const items = rows.map(({ order, merchant, member, ...row }) => ({ ...row, orderTotalVnd: order.total.toFixed(0), orderStatus: order.status, memberEmail: member.email, merchantName: merchant.name, merchantSlug: merchant.slug }));
    return { items, pagination: pageInfo(page, limit, totalItems) };
  },
  async detail(id: number, merchantId?: number) {
    const request = await prisma.refundRequest.findFirst({ where: { id, merchantId }, include: { order: { include: { items: true, paymentAttempt: true, refund: true, refundRequest: true, pointTransactions: true } }, merchant: { select: { id: true, name: true, slug: true } }, member: { select: { id: true, email: true } } } });
    if (!request) throw new HttpError(404, "REFUND_REQUEST_NOT_FOUND");
    const preview = await ordersRepository.getRefundPreview(request.merchantId, request.orderId);
    const { order, merchant, member, ...refundRequest } = request;
    const settlement = order.refund ? {
      status: order.refund.status,
      amountVnd: order.refund.amountVnd.toFixed(0),
      completedAt: order.refund.completedAt?.toISOString() ?? null,
    } : null;
    return { refundRequest, order: toOrderDto(order), merchant, member, preview, settlement };
  },
  async merchantApprove(ownerId: number, id: number, noteValue?: unknown) {
    const note = noteValue === undefined ? undefined : reasonInput(noteValue);
    const merchant = await merchantService.getOwnStore(ownerId);
    return withTransactionRetry(() => prisma.$transaction(async (tx) => {
      const request = await tx.refundRequest.findFirst({ where: { id, merchantId: merchant.id } });
      if (!request) throw new HttpError(404, "REFUND_REQUEST_NOT_FOUND");
      const replay = request.status === "COMPLETED";
      if (!replay) {
        const updated = await tx.refundRequest.updateMany({
          where: { id, merchantId: merchant.id, status: { in: pendingStatuses } },
          data: {
            status: "COMPLETED",
            merchantReviewedById: ownerId,
            merchantReviewedAt: new Date(),
            merchantDecisionReason: note,
          },
        });
        if (!updated.count) throw new HttpError(409, "REFUND_REQUEST_NOT_PENDING");
      }
      const result = await completeMockRefund(tx, {
        merchantId: merchant.id, ownerId, orderId: request.orderId, reason: request.reason, replay,
      });
      const refundRequest = replay ? request : await tx.refundRequest.findUniqueOrThrow({ where: { id } });
      return { ...result, refundRequest };
    }, { isolationLevel: "Serializable" }));
  },
  async merchantReject(ownerId: number, id: number, reasonValue: unknown) {
    const reason = reasonInput(reasonValue);
    const merchant = await merchantService.getOwnStore(ownerId);
    return withTransactionRetry(() => prisma.$transaction(async (tx) => {
      const updated = await tx.refundRequest.updateMany({
        where: { id, merchantId: merchant.id, status: { in: pendingStatuses } },
        data: {
          status: "REJECTED",
          merchantReviewedById: ownerId,
          merchantReviewedAt: new Date(),
          merchantDecisionReason: reason,
        },
      });
      const request = await tx.refundRequest.findFirst({ where: { id, merchantId: merchant.id } });
      if (!request) throw new HttpError(404, "REFUND_REQUEST_NOT_FOUND");
      if (!updated.count) throw new HttpError(409, "REFUND_REQUEST_NOT_PENDING");
      return request;
    }));
  },
};
