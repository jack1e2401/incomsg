import { HttpError } from "../../lib/http-error.js";
import { merchantRepository } from "./merchant.repository.js";

export const merchantService = {
  async listActiveStores() {
    return merchantRepository.listActiveStores();
  },

  async getOwnStore(ownerId: number) {
    const merchant = await merchantRepository.findActiveStoreByOwner(ownerId);
    if (!merchant) throw new HttpError(403, "MERCHANT_NOT_ACTIVE");
    return merchant;
  },
};
