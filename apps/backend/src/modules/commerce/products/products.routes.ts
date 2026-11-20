import { Router } from "express";
import { authenticate, requireRole } from "../../../middleware/auth.js";
import {
  createProduct,
  getPublicStoreProduct,
  listOwnProducts,
  listPublicMerchants,
  listPublicProducts,
  listPublicStoreProducts,
  updateProduct,
} from "./products.controller.js";

export const merchantProductRoutes = Router();
merchantProductRoutes.use(authenticate, requireRole("MERCHANT"));
merchantProductRoutes.post("/", createProduct);
merchantProductRoutes.get("/", listOwnProducts);
merchantProductRoutes.patch("/:productId", updateProduct);

export const publicProductRoutes = Router();
publicProductRoutes.get("/", listPublicMerchants);
publicProductRoutes.get("/:merchantId/products", listPublicProducts);

export const publicStoreProductRoutes = Router();
publicStoreProductRoutes.get("/:slug/products", listPublicStoreProducts);
publicStoreProductRoutes.get("/:slug/products/:productId", getPublicStoreProduct);
