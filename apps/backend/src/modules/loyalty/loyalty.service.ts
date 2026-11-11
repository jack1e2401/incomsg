import { HttpError } from "../../lib/http-error.js";
import { merchantRepository } from "../merchant/merchant.repository.js";
import { loyaltyRepository } from "./loyalty.repository.js";
import type { LoyaltyConfigInput } from "./loyalty.types.js";

export const loyaltyService = {
  async getConfig(ownerId: number) {
    const merchant = await merchantRepository.findActiveStoreByOwner(ownerId);
    if (!merchant) throw new HttpError(403, "MERCHANT_NOT_ACTIVE");
    return loyaltyRepository.getConfig(merchant.id);
  },

  async saveConfig(ownerId: number, input: LoyaltyConfigInput) {
    const merchant = await merchantRepository.findActiveStoreByOwner(ownerId);
    if (!merchant) throw new HttpError(403, "MERCHANT_NOT_ACTIVE");
    return loyaltyRepository.saveConfig(merchant.id, input);
  },
};
