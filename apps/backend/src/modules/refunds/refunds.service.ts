import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../lib/http-error.js";
import { merchantService } from "../merchant/merchant.service.js";
import { ordersRepository } from "../orders/orders.repository.js";
import { reverseOrderChallenges } from "../challenges/challenges.engine.js";

import { reasonInput } from "./refunds.validation.js";
function paging(query: Record<string, unknown>) { const page = Math.max(1, Number(query.page) || 1); const limit = Math.min(100, Math.max(1, Number(query.limit) || 20)); return { page, limit }; }
function pageInfo(page: number, limit: number, totalItems: number) { return { page, limit, totalItems, totalPages: totalItems ? Math.ceil(totalItems / limit) : 0 }; }

export const refundsService = {
  async request(memberId: number, orderId: number, reasonValue: unknown) {
    const reason = reasonInput(reasonValue);
    const order = await prisma.order.findFirst({ where: { id: orderId, memberId }, include: { paymentAttempt: true } });
    if (!order) throw new HttpError(404, "ORDER_NOT_FOUND");
    if (order.paymentAttempt?.status === "SUCCEEDED") throw new HttpError(409, "VNPAY_REFUND_NOT_SUPPORTED");
    if (await prisma.refundRequest.findUnique({ where: { orderId }, select: { id: true } })) throw new HttpError(409, "REFUND_REQUEST_ALREADY_EXISTS");
    if (order.status !== "PAID") throw new HttpError(409, "ORDER_NOT_REFUNDABLE");
    try { return await prisma.refundRequest.create({ data: { orderId, memberId, merchantId: order.merchantId, reason } }); }
    catch (error) { if (typeof error === "object" && error && "code" in error && error.code === "P2002") throw new HttpError(409, "REFUND_REQUEST_ALREADY_EXISTS"); throw error; }
  },
  async getMember(memberId: number, orderId: number) {
    const order = await prisma.order.findFirst({ where: { id: orderId, memberId }, select: { id: true } }); if (!order) throw new HttpError(404, "ORDER_NOT_FOUND");
    return prisma.refundRequest.findUnique({ where: { orderId }, select: { id: true, orderId: true, reason: true, status: true, requestedAt: true, merchantDecisionReason: true, adminDecisionReason: true } });
  },
  async listMerchant(ownerId: number, query: Record<string, unknown>) {
    const merchant = await merchantService.getOwnStore(ownerId); const { page, limit } = paging(query); const where = { merchantId: merchant.id, ...(typeof query.status === "string" ? { status: query.status as never } : {}) };
    const [items, totalItems] = await Promise.all([prisma.refundRequest.findMany({ where, include: { order: true, member: { select: { id: true, email: true } } }, orderBy: [{ requestedAt: "desc" }, { id: "desc" }], skip: (page - 1) * limit, take: limit }), prisma.refundRequest.count({ where })]); return { items, pagination: pageInfo(page, limit, totalItems) };
  },
  async listAdmin(query: Record<string, unknown>) {
    const { page, limit } = paging(query); const where = typeof query.status === "string" ? { status: query.status as never } : {};
    const [items, totalItems] = await Promise.all([prisma.refundRequest.findMany({ where, include: { order: true, merchant: { select: { id: true, name: true, slug: true } }, member: { select: { id: true, email: true } } }, orderBy: [{ requestedAt: "desc" }, { id: "desc" }], skip: (page - 1) * limit, take: limit }), prisma.refundRequest.count({ where })]); return { items, pagination: pageInfo(page, limit, totalItems) };
  },
  async detail(id: number, merchantId?: number) {
    const request = await prisma.refundRequest.findFirst({ where: { id, ...(merchantId ? { merchantId } : {}) }, include: { order: true, merchant: { select: { id: true, name: true, slug: true } }, member: { select: { id: true, email: true } } } });
    if (!request) throw new HttpError(404, "REFUND_REQUEST_NOT_FOUND");
    const preview = await ordersRepository.getRefundPreview(request.merchantId, request.orderId);
    return { refundRequest: request, order: request.order, merchant: request.merchant, member: request.member, preview };
  },
  async merchantApprove(ownerId: number, id: number) {
    const merchant = await merchantService.getOwnStore(ownerId); const now = new Date(); const result = await prisma.refundRequest.updateMany({ where: { id, merchantId: merchant.id, status: "PENDING_MERCHANT" }, data: { status: "PENDING_ADMIN", merchantReviewedById: ownerId, merchantReviewedAt: now } });
    if (!result.count) throw new HttpError(409, "REFUND_REQUEST_NOT_PENDING_MERCHANT"); return prisma.refundRequest.findUniqueOrThrow({ where: { id } });
  },
  async reject(id: number, reviewerId: number, reasonValue: unknown, stage: "merchant" | "admin", merchantId?: number) {
    const reason = reasonInput(reasonValue); const status = stage === "merchant" ? "PENDING_MERCHANT" : "PENDING_ADMIN"; const now = new Date();
    const result = await prisma.refundRequest.updateMany({ where: { id, status, ...(merchantId ? { merchantId } : {}) }, data: stage === "merchant" ? { status: "REJECTED", merchantReviewedById: reviewerId, merchantReviewedAt: now, merchantDecisionReason: reason } : { status: "REJECTED", adminReviewedById: reviewerId, adminReviewedAt: now, adminDecisionReason: reason } });
    if (!result.count) throw new HttpError(409, "REFUND_REQUEST_NOT_PENDING"); return prisma.refundRequest.findUniqueOrThrow({ where: { id } });
  },
  async adminApprove(adminId: number, id: number) {
    const request = await prisma.refundRequest.findUnique({ where: { id }, include: { order: true } });
    if (!request) throw new HttpError(404, "REFUND_REQUEST_NOT_FOUND"); if (request.status !== "PENDING_ADMIN") throw new HttpError(409, "REFUND_REQUEST_NOT_PENDING_ADMIN");
    let challengeReversals = 0;
    const result = await ordersRepository.refundOrder(request.merchantId, adminId, request.orderId, request.reason, async (tx) => {
      challengeReversals = await reverseOrderChallenges(tx, request.orderId, adminId);
      const updated = await tx.refundRequest.updateMany({ where: { id, status: "PENDING_ADMIN" }, data: { status: "COMPLETED", adminReviewedById: adminId, adminReviewedAt: new Date() } });
      if (updated.count !== 1) throw new HttpError(409, "REFUND_REQUEST_NOT_PENDING_ADMIN");
      return challengeReversals;
    });
    const refundRequest = await prisma.refundRequest.findUniqueOrThrow({ where: { id } });
    return { refundRequest, ...result, challengeReversals };
  },
};
