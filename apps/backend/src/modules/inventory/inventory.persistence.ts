import { Prisma } from "../../generated/prisma/client.js";
import type { InventoryMovementType, InventoryOwnerType } from "../../generated/prisma/enums.js";
import { HttpError } from "../../lib/http-error.js";
import { applyInventoryMovement } from "./inventory.domain.js";

type InventoryTx = Prisma.TransactionClient;

export type InventoryOwner = {
  merchantId: number;
  ownerType: InventoryOwnerType;
  productId?: number;
  voucherDefinitionId?: number;
};

export type MoveInventoryInput = InventoryOwner & {
  movementType: InventoryMovementType;
  quantity: number;
  reason: string;
  eventRef: string;
  actorId?: number | null;
  orderId?: number | null;
  memberVoucherId?: number | null;
  requestKey?: string | null;
};

export async function readInventoryBalance(tx: InventoryTx, owner: InventoryOwner) {
  const selector = owner.productId !== undefined
    ? { productId: owner.productId }
    : owner.voucherDefinitionId !== undefined
      ? { voucherDefinitionId: owner.voucherDefinitionId }
      : null;
  if (!selector) throw new Error("Inventory owner is required");
  const balance = await tx.inventoryBalance.findUnique({ where: selector });
  if (!balance || balance.merchantId !== owner.merchantId || balance.ownerType !== owner.ownerType) {
    throw new HttpError(409, "INVENTORY_NOT_INITIALIZED");
  }
  return balance;
}

export async function moveInventory(tx: InventoryTx, input: MoveInventoryInput) {
  const duplicate = await tx.inventoryMovement.findUnique({ where: { eventRef: input.eventRef } });
  if (duplicate) return duplicate;

  const balance = await readInventoryBalance(tx, input);
  const next = applyInventoryMovement(
    { onHand: balance.onHandQuantity, reserved: balance.reservedQuantity },
    input.movementType,
    input.quantity,
  );
  const changed = await tx.inventoryBalance.updateMany({
    where: {
      id: balance.id,
      merchantId: input.merchantId,
      onHandQuantity: balance.onHandQuantity,
      reservedQuantity: balance.reservedQuantity,
    },
    data: { onHandQuantity: next.onHand, reservedQuantity: next.reserved },
  });
  if (changed.count !== 1) throw Object.assign(new Error("Concurrent inventory update"), { code: "P2034" });

  const quantityDelta = ["INITIAL_STOCK", "MANUAL_IN", "RETURN_IN", "REDEMPTION_REVERSAL_IN"].includes(input.movementType)
    ? input.quantity
    : ["MANUAL_OUT", "SALE_OUT", "REWARD_FULFILL_OUT", "VOUCHER_REDEMPTION_OUT"].includes(input.movementType)
      ? -input.quantity
      : 0;

  return tx.inventoryMovement.create({
    data: {
      balanceId: balance.id,
      merchantId: input.merchantId,
      ownerType: input.ownerType,
      movementType: input.movementType,
      quantityDelta,
      onHandBefore: balance.onHandQuantity,
      onHandAfter: next.onHand,
      reservedBefore: balance.reservedQuantity,
      reservedAfter: next.reserved,
      productId: input.productId ?? null,
      voucherDefinitionId: input.voucherDefinitionId ?? null,
      orderId: input.orderId ?? null,
      memberVoucherId: input.memberVoucherId ?? null,
      actorId: input.actorId ?? null,
      reason: input.reason,
      eventRef: input.eventRef,
      requestKey: input.requestKey ?? null,
    },
  });
}

export async function createInventoryBalance(
  tx: InventoryTx,
  owner: InventoryOwner,
  initialQuantity: number,
  actorId: number | null,
) {
  const balance = await tx.inventoryBalance.create({
    data: {
      merchantId: owner.merchantId,
      ownerType: owner.ownerType,
      productId: owner.productId ?? null,
      voucherDefinitionId: owner.voucherDefinitionId ?? null,
    },
  });
  if (initialQuantity > 0) {
    await moveInventory(tx, {
      ...owner,
      movementType: "INITIAL_STOCK",
      quantity: initialQuantity,
      reason: "Initial stock",
      eventRef: `initial-stock-${owner.productId ?? `voucher-${owner.voucherDefinitionId}`}`,
      actorId,
    });
  }
  return balance;
}

export function toInventorySummary(balance: { onHandQuantity: number; reservedQuantity: number }) {
  return {
    onHandQuantity: balance.onHandQuantity,
    reservedQuantity: balance.reservedQuantity,
    availableQuantity: balance.onHandQuantity - balance.reservedQuantity,
  };
}
