import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { createCategory, deleteCategory, listOwnCategories, updateCategory } from "./categories.controller.js";

export const merchantCategoryRoutes = Router();
merchantCategoryRoutes.use(authenticate, requireRole("MERCHANT"));
merchantCategoryRoutes.get("/", listOwnCategories);
merchantCategoryRoutes.post("/", createCategory);
merchantCategoryRoutes.patch("/:categoryId", updateCategory);
merchantCategoryRoutes.delete("/:categoryId", deleteCategory);
