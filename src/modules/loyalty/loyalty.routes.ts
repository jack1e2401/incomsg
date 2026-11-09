import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { getLoyaltyConfig, getMemberWallet, putLoyaltyConfig } from "./loyalty.controller.js";

export const merchantLoyaltyRoutes = Router();
merchantLoyaltyRoutes.use(authenticate, requireRole("MERCHANT"));
merchantLoyaltyRoutes.get("/", getLoyaltyConfig);
merchantLoyaltyRoutes.put("/", putLoyaltyConfig);

export const memberLoyaltyRoutes = Router();
memberLoyaltyRoutes.get("/merchants/:merchantId/wallet", authenticate, requireRole("MEMBER"), getMemberWallet);
