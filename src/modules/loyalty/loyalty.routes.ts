import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { getLoyaltyConfig, putLoyaltyConfig } from "./loyalty.controller.js";

export const merchantLoyaltyRoutes = Router();
merchantLoyaltyRoutes.use(authenticate, requireRole("MERCHANT"));
merchantLoyaltyRoutes.get("/", getLoyaltyConfig);
merchantLoyaltyRoutes.put("/", putLoyaltyConfig);
