import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { createDefinition, listMerchantDefinitions, listPublicDefinitions, updateDefinition, listOwnedVouchers, redeemVoucher, listRewardFulfillments, fulfillReward } from "./vouchers.controller.js";

export const merchantVoucherRoutes = Router();
merchantVoucherRoutes.use(authenticate, requireRole("MERCHANT"));
merchantVoucherRoutes.get("/", listMerchantDefinitions);
merchantVoucherRoutes.post("/", createDefinition);
merchantVoucherRoutes.patch("/:id", updateDefinition);

export const merchantRewardRoutes = Router();
merchantRewardRoutes.use(authenticate, requireRole("MERCHANT"));
merchantRewardRoutes.get("/", listRewardFulfillments);
merchantRewardRoutes.post("/:memberVoucherId/fulfill", fulfillReward);

export const publicVoucherRoutes = Router();
publicVoucherRoutes.get("/:merchantId/vouchers", listPublicDefinitions);

export const memberVoucherRoutes = Router();
memberVoucherRoutes.use(authenticate, requireRole("MEMBER"));
memberVoucherRoutes.get("/:merchantId/vouchers", listOwnedVouchers);

export const memberRedemptionRoutes = Router();
memberRedemptionRoutes.use(authenticate, requireRole("MEMBER"));
memberRedemptionRoutes.post("/:definitionId/redeem", redeemVoucher);
