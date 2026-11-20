import { Router } from "express";
import { authenticate, requireRole } from "../../../middleware/auth.js";
import {
  getMerchantStorefront,
  getMerchantStorefrontPreview,
  getPublicStorefrontBySlug,
  listMerchantStorefrontVersions,
  publishMerchantStorefront,
  rollbackMerchantStorefrontVersion,
  saveMerchantStorefrontDraft,
} from "./storefront.controller.js";

export const merchantStorefrontRoutes = Router();
merchantStorefrontRoutes.use(authenticate, requireRole("MERCHANT"));
merchantStorefrontRoutes.get("/", getMerchantStorefront);
merchantStorefrontRoutes.put("/draft", saveMerchantStorefrontDraft);
merchantStorefrontRoutes.get("/preview", getMerchantStorefrontPreview);
merchantStorefrontRoutes.post("/publish", publishMerchantStorefront);
merchantStorefrontRoutes.get("/versions", listMerchantStorefrontVersions);
merchantStorefrontRoutes.post("/versions/:versionId/rollback", rollbackMerchantStorefrontVersion);

export const publicStorefrontRoutes = Router();
publicStorefrontRoutes.get("/stores/:slug", getPublicStorefrontBySlug);
