import { Prisma } from "../../generated/prisma/client.js";
import type { InventoryMovementType, InventoryOwnerType } from "../../generated/prisma/enums.js";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../lib/http-error.js";
import { withTransactionRetry } from "../loyalty/loyalty.transaction.js";
import { moveInventory, readInventoryBalance, toInventorySummary } from "./inventory.persistence.js";

const historyLimit = 100;

export type InventoryItemKind = "SALE_PRODUCT" | "REWARD_PRODUCT" | "DISCOUNT_VOUCHER";

function movementKind(kind: InventoryItemKind, direction: "in" | "out", returnToStock: boolean): InventoryMovementType {
  if (direction === "out") return "MANUAL_OUT";
  return returnToStock && kind !== "DISCOUNT_VOUCHER" ? "RETURN_IN" : "MANUAL_IN";
}

function ownerFor(kind: InventoryItemKind, merchantId: number, id: number) {
  return kind === "DISCOUNT_VOUCHER"
    ? { merchantId, ownerType: kind as InventoryOwnerType, voucherDefinitionId: id }
    : { merchantId, ownerType: kind as InventoryOwnerType, productId: id };
}

export const inventoryRepository = {
  async getInventory(merchantId: number, kind: InventoryItemKind, id: number) {
    const owner = ownerFor(kind, merchantId, id);
    const balance = await prisma.inventoryBalance.findFirst({ where: { ...owner } });
    if (!balance) return null;
    const movements = await prisma.inventoryMovement.findMany({
      where: { balanceId: balance.id },
      include: { actor: { select: { email: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: historyLimit,
    });
    return {
      inventory: toInventorySummary(balance),
      movements: movements.map((movement) => ({
        id: movement.id,
        movementType: movement.movementType,
        quantityDelta: movement.quantityDelta,
        onHandBefore: movement.onHandBefore,
        onHandAfter: movement.onHandAfter,
        reservedBefore: movement.reservedBefore,
        reservedAfter: movement.reservedAfter,
        orderId: movement.orderId,
        memberVoucherId: movement.memberVoucherId,
        reason: movement.reason,
        actorId: movement.actorId,
        actorEmail: movement.actor?.email ?? null,
        createdAt: movement.createdAt.toISOString(),
      })),
    };
  },

  async adjust(input: {
    merchantId: number;
    actorId: number;
    kind: InventoryItemKind;
    id: number;
    direction: "in" | "out";
    quantity: number;
    reason: string;
    requestKey: string;
    returnToStock: boolean;
  }) {
    return withTransactionRetry(() => prisma.$transaction(async (tx) => {
      const existingRequest = await tx.inventoryMovement.findUnique({
        where: { merchantId_requestKey: { merchantId: input.merchantId, requestKey: input.requestKey } },
      });
      const type = movementKind(input.kind, input.direction, input.returnToStock);
      if (existingRequest) {
        const requestedDelta = input.direction === "in" ? input.quantity : -input.quantity;
        const sameOwner = input.kind === "DISCOUNT_VOUCHER"
          ? existingRequest.voucherDefinitionId === input.id
          : existingRequest.productId === input.id;
        if (!sameOwner || existingRequest.movementType !== type || existingRequest.quantityDelta !== requestedDelta || existingRequest.reason !== input.reason) {
          throw new HttpError(409, "IDEMPOTENCY_KEY_CONFLICT");
        }
        const balance = await readInventoryBalance(tx, ownerFor(input.kind, input.merchantId, input.id));
        return { inventory: toInventorySummary(balance), replayed: true };
      }

      const owner = ownerFor(input.kind, input.merchantId, input.id);
      const modelOwner = input.kind === "DISCOUNT_VOUCHER"
        ? await tx.voucherDefinition.findFirst({ where: { id: input.id, merchantId: input.merchantId, type: "DISCOUNT" }, select: { id: true } })
        : await tx.product.findFirst({
            where: { id: input.id, merchantId: input.merchantId, kind: input.kind === "REWARD_PRODUCT" ? "REWARD" : "SALE" },
            select: { id: true },
          });
      if (!modelOwner) throw new HttpError(404, "INVENTORY_ITEM_NOT_FOUND");

      await moveInventory(tx, {
        ...owner,
        movementType: type,
        quantity: input.quantity,
        reason: input.reason,
        eventRef: `stock-${input.merchantId}-${input.requestKey}`,
        requestKey: input.requestKey,
        actorId: input.actorId,
      });

      if (input.kind === "REWARD_PRODUCT" && input.direction === "in") {
        await reserveLegacyRewardClaims(tx, {
          merchantId: input.merchantId,
          productId: input.id,
          actorId: input.actorId,
        });
      }
      const balance = await readInventoryBalance(tx, owner);
      return { inventory: toInventorySummary(balance), replayed: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  },
};

async function reserveLegacyRewardClaims(tx: Prisma.TransactionClient, input: { merchantId: number; productId: number; actorId: number }) {
  const pending = await tx.memberVoucher.findMany({
    where: {
      membership: { merchantId: input.merchantId },
      rewardProductIdSnapshot: input.productId,
      rewardInventoryReserved: false,
      status: "PENDING_FULFILLMENT",
    },
    orderBy: [{ redeemedAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  for (const claim of pending) {
    const balance = await readInventoryBalance(tx, {
      merchantId: input.merchantId,
      ownerType: "REWARD_PRODUCT",
      productId: input.productId,
    });
    if (balance.onHandQuantity - balance.reservedQuantity < 1) break;
    await moveInventory(tx, {
      merchantId: input.merchantId,
      ownerType: "REWARD_PRODUCT",
      productId: input.productId,
      movementType: "REWARD_LEGACY_RESERVE",
      quantity: 1,
      reason: `Reserved for legacy reward claim #${claim.id}`,
      eventRef: `legacy-reward-reserve-${claim.id}`,
      memberVoucherId: claim.id,
      actorId: input.actorId,
    });
    await tx.memberVoucher.updateMany({
      where: { id: claim.id, rewardInventoryReserved: false, status: "PENDING_FULFILLMENT" },
      data: { rewardInventoryReserved: true },
    });
  }
}
