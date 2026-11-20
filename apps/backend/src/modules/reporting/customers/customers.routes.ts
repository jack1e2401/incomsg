import { Router } from "express";
import { authenticate, requireRole } from "../../../middleware/auth.js";
import { getCustomerDetail, listCustomers } from "./customers.controller.js";

export const merchantCustomerRoutes = Router();
merchantCustomerRoutes.use(authenticate, requireRole("MERCHANT"));
merchantCustomerRoutes.get("/", listCustomers);
merchantCustomerRoutes.get("/:memberId", getCustomerDetail);
