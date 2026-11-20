import type { Order, Prisma } from "../../../generated/prisma/client.js";
import { HttpError } from "../../../lib/http-error.js";

export async function consumeOrderVoucher(
  tx: Prisma.TransactionClient,
  order: Pick<Order, "id" | "memberId" | "merchantId" | "voucherId"> & {
    voucher: Prisma.MemberVoucherGetPayload<{ include: { membership: true } }> | null;
  },
) {
  if (order.voucherId !== null) {
    const voucher = order.voucher;
    if (!voucher || voucher.snapshotType !== "DISCOUNT" || voucher.membership.memberId !== order.memberId ||
      voucher.membership.merchantId !== order.merchantId) throw new HttpError(409, "VOUCHER_NOT_AVAILABLE");
    const used = await tx.memberVoucher.updateMany({
      where: { id: voucher.id, status: "AVAILABLE" }, data: { status: "USED", usedAt: new Date() },
    });
    if (used.count !== 1) throw new HttpError(409, "VOUCHER_NOT_AVAILABLE");
    await tx.orderVoucherReservation.deleteMany({ where: { orderId: order.id } });
  }
}

export async function restoreOrderVoucher(tx: Prisma.TransactionClient, voucherId: number | null) {
  if (voucherId !== null) {
    await tx.memberVoucher.updateMany({
      where: { id: voucherId, status: "USED" },
      data: { status: "AVAILABLE", usedAt: null },
    });
  }
}
