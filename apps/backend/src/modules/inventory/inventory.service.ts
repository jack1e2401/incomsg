import { HttpError } from "../../lib/http-error.js";
import { merchantRepository } from "../merchant/merchant.repository.js";
import { inventoryRepository, type InventoryItemKind } from "./inventory.repository.js";

export const inventoryService = {
  async get(ownerId: number, kind: InventoryItemKind, id: number) {
    const merchant = await merchantRepository.findActiveStoreByOwner(ownerId);
    if (!merchant) throw new HttpError(403, "MERCHANT_NOT_ACTIVE");
    const result = await inventoryRepository.getInventory(merchant.id, kind, id);
    if (!result) throw new HttpError(404, "INVENTORY_ITEM_NOT_FOUND");
    return result;
  },

  async adjust(ownerId: number, kind: InventoryItemKind, id: number, input: {
    direction: "in" | "out";
    quantity: number;
    reason: string;
    requestKey: string;
    returnToStock: boolean;
  }) {
    const merchant = await merchantRepository.findActiveStoreByOwner(ownerId);
    if (!merchant) throw new HttpError(403, "MERCHANT_NOT_ACTIVE");
    try {
      return await inventoryRepository.adjust({
        ...input,
        merchantId: merchant.id,
        actorId: ownerId,
        kind,
        id,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Insufficient available inventory") {
        throw new HttpError(409, "INSUFFICIENT_AVAILABLE_INVENTORY");
      }
      throw error;
    }
  },
};
