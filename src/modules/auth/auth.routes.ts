import { Router } from "express";
import { applicationStatus, login, registerMember, registerMerchant } from "./auth.controller.js";

export const authRoutes = Router();
authRoutes.post("/register/member", registerMember);
authRoutes.post("/register/merchant", registerMerchant);
authRoutes.post("/application-status", applicationStatus);
authRoutes.post("/login", login);
