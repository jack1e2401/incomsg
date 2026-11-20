export type InventoryBalance = {
  onHand: number;
  reserved: number;
};

export type InventoryMovementType =
  | "INITIAL_STOCK"
  | "MANUAL_IN"
  | "MANUAL_OUT"
  | "RETURN_IN"
  | "ORDER_RESERVE"
  | "ORDER_RELEASE"
  | "SALE_OUT"
  | "REWARD_RESERVE"
  | "REWARD_CANCEL_RELEASE"
  | "REWARD_FULFILL_OUT"
  | "VOUCHER_REDEMPTION_OUT"
  | "REDEMPTION_REVERSAL_IN"
  | "REWARD_LEGACY_RESERVE"
  | "LEGACY_BACKFILL";

const maxInventoryQuantity = 2_147_483_647;

export function availableInventory(balance: InventoryBalance): number {
  return balance.onHand - balance.reserved;
}

export function applyInventoryMovement(
  balance: InventoryBalance,
  type: InventoryMovementType,
  quantity: number,
): InventoryBalance {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Inventory quantity must be a positive integer");
  }
  if (quantity > maxInventoryQuantity) throw new Error("Inventory quantity exceeds the supported range");
  if (!Number.isInteger(balance.onHand) || !Number.isInteger(balance.reserved)) {
    throw new Error("Inventory balances must be integers");
  }
  if (balance.onHand < 0 || balance.reserved < 0 || balance.reserved > balance.onHand) {
    throw new Error("Inventory balance is invalid");
  }

  const next = { ...balance };
  switch (type) {
    case "INITIAL_STOCK":
    case "MANUAL_IN":
    case "RETURN_IN":
    case "REDEMPTION_REVERSAL_IN":
      next.onHand += quantity;
      break;
    case "LEGACY_BACKFILL":
      break;
    case "MANUAL_OUT":
    case "VOUCHER_REDEMPTION_OUT":
      requireAvailable(balance, quantity);
      next.onHand -= quantity;
      break;
    case "ORDER_RESERVE":
    case "REWARD_RESERVE":
    case "REWARD_LEGACY_RESERVE":
      requireAvailable(balance, quantity);
      next.reserved += quantity;
      break;
    case "ORDER_RELEASE":
    case "REWARD_CANCEL_RELEASE":
      requireReserved(balance, quantity);
      next.reserved -= quantity;
      break;
    case "SALE_OUT":
      requireReserved(balance, quantity);
      next.onHand -= quantity;
      next.reserved -= quantity;
      break;
    case "REWARD_FULFILL_OUT":
      requireReserved(balance, quantity);
      next.onHand -= quantity;
      next.reserved -= quantity;
      break;
  }

  if (next.onHand > maxInventoryQuantity || next.reserved > maxInventoryQuantity) {
    throw new Error("Inventory balance exceeds the supported range");
  }

  return next;
}

function requireAvailable(balance: InventoryBalance, quantity: number) {
  if (availableInventory(balance) < quantity) throw new Error("Insufficient available inventory");
}

function requireReserved(balance: InventoryBalance, quantity: number) {
  if (balance.reserved < quantity) throw new Error("Insufficient reserved inventory");
}
