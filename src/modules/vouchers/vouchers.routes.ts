import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { createDefinition, listMerchantDefinitions, listPublicDefinitions, updateDefinition, listOwnedVouchers } from "./vouchers.controller.js";

export const merchantVoucherRoutes = Router();
merchantVoucherRoutes.use(authenticate, requireRole("MERCHANT"));
merchantVoucherRoutes.get("/", listMerchantDefinitions);
merchantVoucherRoutes.post("/", createDefinition);
merchantVoucherRoutes.patch("/:id", updateDefinition);

export const publicVoucherRoutes = Router();
publicVoucherRoutes.get("/:merchantId/vouchers", listPublicDefinitions);

export const memberVoucherRoutes = Router();
memberVoucherRoutes.use(authenticate, requireRole("MEMBER"));
memberVoucherRoutes.get("/:merchantId/vouchers", listOwnedVouchers);
