import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { inventoryHandlers } from "./inventory.controller.js";

export const merchantInventoryRoutes = Router();
merchantInventoryRoutes.use(authenticate, requireRole("MERCHANT"));

const sale = inventoryHandlers("SALE_PRODUCT");
merchantInventoryRoutes.get("/products/:productId/stock/movements", sale.get);
merchantInventoryRoutes.post("/products/:productId/stock/in", sale.stockIn);
merchantInventoryRoutes.post("/products/:productId/stock/out", sale.stockOut);

const reward = inventoryHandlers("REWARD_PRODUCT");
merchantInventoryRoutes.get("/rewards/:productId/stock/movements", reward.get);
merchantInventoryRoutes.post("/rewards/:productId/stock/in", reward.stockIn);
merchantInventoryRoutes.post("/rewards/:productId/stock/out", reward.stockOut);

const voucher = inventoryHandlers("DISCOUNT_VOUCHER");
merchantInventoryRoutes.get("/vouchers/:definitionId/stock/movements", voucher.get);
merchantInventoryRoutes.post("/vouchers/:definitionId/stock/in", voucher.stockIn);
merchantInventoryRoutes.post("/vouchers/:definitionId/stock/out", voucher.stockOut);
