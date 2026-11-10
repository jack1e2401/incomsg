import { HttpError } from "../../lib/http-error.js";
import { merchantRepository } from "../merchant/merchant.repository.js";
import { vouchersRepository } from "./vouchers.repository.js";
import type { DefinitionInput, DefinitionPatch } from "./vouchers.types.js";
import { readDefinitionInput } from "./vouchers.validation.js";

export const vouchersService = {
  async createDefinition(ownerId: number, input: DefinitionInput) {
    const merchant = await merchantRepository.findActiveStoreByOwner(ownerId);
    if (!merchant) throw new HttpError(403, "MERCHANT_NOT_ACTIVE");
    return vouchersRepository.createDefinition(merchant.id, input);
  },
  async listMerchantDefinitions(ownerId: number) {
    const merchant = await merchantRepository.findActiveStoreByOwner(ownerId);
    if (!merchant) throw new HttpError(403, "MERCHANT_NOT_ACTIVE");
    return vouchersRepository.listDefinitions(merchant.id, false);
  },
  async updateDefinition(ownerId: number, id: number, patch: DefinitionPatch) {
    const merchant = await merchantRepository.findActiveStoreByOwner(ownerId);
    if (!merchant) throw new HttpError(403, "MERCHANT_NOT_ACTIVE");
    const existing = await vouchersRepository.getDefinition(id);
    if (!existing || existing.merchantId !== merchant.id) throw new HttpError(404, "VOUCHER_DEFINITION_NOT_FOUND");
    if (existing.rewardProductId !== null && patch.rewardDescription !== undefined) {
      throw new HttpError(400, "INVALID_INPUT");
    }
    const validated = readDefinitionInput({
      type: existing.type,
      title: patch.title ?? existing.title,
      pointsCost: patch.pointsCost ?? existing.pointsCost,
      discountAmount: patch.discountAmount !== undefined ? patch.discountAmount : existing.discountAmount?.toFixed(0),
      rewardProductId: existing.rewardProductId,
      rewardDescription: existing.rewardProductId === null
        ? patch.rewardDescription !== undefined ? patch.rewardDescription : existing.rewardDescription
        : null,
    }, true);
    const result = await vouchersRepository.updateDefinition(merchant.id, id, {
      title: validated.title,
      pointsCost: validated.pointsCost,
      discountAmount: validated.discountAmount,
      ...(existing.rewardProductId === null ? { rewardDescription: validated.rewardDescription } : {}),
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
    });
    if (!result) throw new HttpError(404, "VOUCHER_DEFINITION_NOT_FOUND");
    return result;
  },
  async listPublicDefinitions(merchantId: number) {
    const result = await vouchersRepository.listPublicDefinitions(merchantId);
    if (!result) throw new HttpError(404, "MERCHANT_NOT_FOUND");
    return result;
  },
  async listOwnedVouchers(memberId: number, merchantId: number) {
    const result = await vouchersRepository.listOwnedVouchers(memberId, merchantId);
    if (!result) throw new HttpError(404, "MERCHANT_NOT_FOUND");
    return result;
  },
  redeemVoucher(memberId: number, definitionId: number) {
    return vouchersRepository.redeemVoucher(memberId, definitionId);
  },
  async listRewardFulfillments(ownerId: number) {
    const merchant = await merchantRepository.findActiveStoreByOwner(ownerId);
    if (!merchant) throw new HttpError(403, "MERCHANT_NOT_ACTIVE");
    return vouchersRepository.listRewardFulfillments(merchant.id);
  },
  async fulfillReward(ownerId: number, memberVoucherId: number, note?: string) {
    const merchant = await merchantRepository.findActiveStoreByOwner(ownerId);
    if (!merchant) throw new HttpError(403, "MERCHANT_NOT_ACTIVE");
    const result = await vouchersRepository.fulfillReward(merchant.id, ownerId, memberVoucherId, note);
    if (result === "missing") throw new HttpError(404, "REWARD_NOT_FOUND");
    if (result === "already_fulfilled") throw new HttpError(409, "REWARD_ALREADY_FULFILLED");
    return result;
  },
};
