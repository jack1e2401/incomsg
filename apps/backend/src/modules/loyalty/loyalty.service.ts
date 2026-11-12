import { HttpError } from "../../lib/http-error.js";
import { merchantRepository } from "../merchant/merchant.repository.js";
import { loyaltyRepository } from "./loyalty.repository.js";
import type { LoyaltyConfigInput } from "./loyalty.types.js";
import {
  previewMemberEarning,
  previewMerchantPolicy,
  listMerchantTransactions,
  type MerchantTransactionFilters,
} from "./loyalty.read.js";
import type { TierLevel } from "./loyalty.calculation.js";

export const loyaltyService = {
  async getConfig(ownerId: number) {
    const merchant = await merchantRepository.findActiveStoreByOwner(ownerId);
    if (!merchant) throw new HttpError(403, "MERCHANT_NOT_ACTIVE");
    return loyaltyRepository.getConfig(merchant.id);
  },

  async saveConfig(ownerId: number, input: LoyaltyConfigInput) {
    const merchant = await merchantRepository.findActiveStoreByOwner(ownerId);
    if (!merchant) throw new HttpError(403, "MERCHANT_NOT_ACTIVE");
    return loyaltyRepository.saveConfig(merchant.id, ownerId, input);
  },

  async listPolicyHistory(ownerId: number) {
    const merchant = await merchantRepository.findActiveStoreByOwner(ownerId);
    if (!merchant) throw new HttpError(403, "MERCHANT_NOT_ACTIVE");
    return loyaltyRepository.listHistory(merchant.id);
  },

  async previewMemberEarning(memberId: number, merchantId: number, netOrderAmountVnd: string) {
    return previewMemberEarning(memberId, merchantId, netOrderAmountVnd);
  },

  async previewMerchantPolicy(ownerId: number, input: { netOrderAmountVnd: string; tierLevel?: TierLevel }) {
    const merchant = await merchantRepository.findActiveStoreByOwner(ownerId);
    if (!merchant) throw new HttpError(403, "MERCHANT_NOT_ACTIVE");
    return previewMerchantPolicy(merchant.id, input);
  },

  async listMerchantTransactions(ownerId: number, filters: MerchantTransactionFilters) {
    const merchant = await merchantRepository.findActiveStoreByOwner(ownerId);
    if (!merchant) throw new HttpError(403, "MERCHANT_NOT_ACTIVE");
    return listMerchantTransactions(merchant.id, filters);
  },
};
