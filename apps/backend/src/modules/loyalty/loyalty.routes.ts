import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import {
  getLoyaltyConfig,
  listLoyaltyPolicyHistory,
  getMemberWallet,
  getMerchantMemberWallet,
  listMerchantMembers,
  listMerchantTransactions,
  previewMemberEarning,
  previewMerchantPolicy,
  putLoyaltyConfig,
} from "./loyalty.controller.js";

export const merchantLoyaltyRoutes = Router();
merchantLoyaltyRoutes.use(authenticate, requireRole("MERCHANT"));
merchantLoyaltyRoutes.get("/", getLoyaltyConfig);
merchantLoyaltyRoutes.put("/", putLoyaltyConfig);
merchantLoyaltyRoutes.get("/history", listLoyaltyPolicyHistory);
merchantLoyaltyRoutes.post("/preview", previewMerchantPolicy);
merchantLoyaltyRoutes.get("/transactions", listMerchantTransactions);
merchantLoyaltyRoutes.get("/members", listMerchantMembers);
merchantLoyaltyRoutes.get("/members/:memberId/wallet", getMerchantMemberWallet);

export const memberLoyaltyRoutes = Router();
memberLoyaltyRoutes.get("/merchants/:merchantId/wallet", authenticate, requireRole("MEMBER"), getMemberWallet);
memberLoyaltyRoutes.post("/merchants/:merchantId/loyalty/preview", authenticate, requireRole("MEMBER"), previewMemberEarning);
