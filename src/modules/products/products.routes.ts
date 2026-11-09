import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { createProduct, listOwnProducts, listPublicProducts, updateProduct } from "./products.controller.js";

export const merchantProductRoutes = Router();
merchantProductRoutes.use(authenticate, requireRole("MERCHANT"));
merchantProductRoutes.post("/", createProduct);
merchantProductRoutes.get("/", listOwnProducts);
merchantProductRoutes.patch("/:productId", updateProduct);

export const publicProductRoutes = Router();
publicProductRoutes.get("/:merchantId/products", listPublicProducts);
