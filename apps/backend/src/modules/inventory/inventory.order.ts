import { Prisma } from "../../generated/prisma/client.js";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { withTransactionRetry } from "../loyalty/loyalty.transaction.js";
import { moveInventory, readInventoryBalance } from "./inventory.persistence.js";

type OrderInventoryLine = { productId: number; quantity: number };

function quantitiesByProduct(items: OrderInventoryLine[]) {
  const quantities = new Map<number, number>();
  for (const item of items) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  return quantities;
}

export async function reserveOrderInventory(
  tx: Prisma.TransactionClient,
  input: { merchantId: number; orderId: number; memberId: number; items: OrderInventoryLine[] },
) {
  for (const [productId, quantity] of quantitiesByProduct(input.items)) {
    try {
      await moveInventory(tx, {
        merchantId: input.merchantId,
        ownerType: "SALE_PRODUCT",
        productId,
        movementType: "ORDER_RESERVE",
        quantity,
        reason: `Reserved for order #${input.orderId}`,
        eventRef: `order-reserve-${input.orderId}-${productId}`,
        orderId: input.orderId,
        actorId: input.memberId,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Insufficient available inventory") {
        throw new HttpError(409, "INSUFFICIENT_PRODUCT_STOCK");
      }
      throw error;
    }
  }
}

export async function consumeOrderInventory(tx: Prisma.TransactionClient, order: {
  id: number; merchantId: number; items: OrderInventoryLine[]; stockReservedAt: Date | null; stockReleasedAt: Date | null;
}) {
  if (!order.items.length) return;
  if (!order.stockReservedAt || order.stockReleasedAt) throw new HttpError(409, "ORDER_STOCK_RESERVATION_MISSING");
  for (const [productId, quantity] of quantitiesByProduct(order.items)) {
    await moveInventory(tx, {
      merchantId: order.merchantId,
      ownerType: "SALE_PRODUCT",
      productId,
      movementType: "SALE_OUT",
      quantity,
      reason: `Sale completed for order #${order.id}`,
      eventRef: `order-sale-${order.id}-${productId}`,
      orderId: order.id,
    });
  }
}

export async function releaseOrderInventory(tx: Prisma.TransactionClient, order: {
  id: number; merchantId: number; items: OrderInventoryLine[]; stockReservedAt: Date | null; stockReleasedAt: Date | null;
}, actorId: number | null, reason: string) {
  if (!order.stockReservedAt || order.stockReleasedAt) return;
  for (const [productId, quantity] of quantitiesByProduct(order.items)) {
    await moveInventory(tx, {
      merchantId: order.merchantId,
      ownerType: "SALE_PRODUCT",
      productId,
      movementType: "ORDER_RELEASE",
      quantity,
      reason,
      eventRef: `order-release-${order.id}-${productId}`,
      orderId: order.id,
      actorId,
    });
  }
  await tx.order.updateMany({
    where: { id: order.id, stockReleasedAt: null },
    data: { stockReleasedAt: new Date() },
  });
}

export async function releaseExpiredMockOrders(batchSize = 100) {
  const now = new Date();
  const candidates = await prisma.order.findMany({
    where: { status: "PENDING", paymentAttempt: null, stockReleasedAt: null, stockReservedUntil: { lte: now } },
    select: { id: true },
    orderBy: [{ stockReservedUntil: "asc" }, { id: "asc" }],
    take: batchSize,
  });
  let released = 0;
  for (const { id } of candidates) {
    const didRelease = await withTransactionRetry(() => prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id, status: "PENDING", paymentAttempt: null, stockReleasedAt: null, stockReservedUntil: { lte: now } },
        include: { items: true },
      });
      if (!order) return false;
      await releaseOrderInventory(tx, order, null, "Order stock reservation expired after five minutes");
      await tx.order.updateMany({ where: { id, status: "PENDING" }, data: { status: "CANCELLED" } });
      await tx.orderVoucherReservation.deleteMany({ where: { orderId: id } });
      return true;
    }, { isolationLevel: "Serializable" }));
    if (didRelease) released += 1;
  }
  return { released };
}
