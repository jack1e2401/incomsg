import type { RequestHandler } from "express";
import { adminService } from "./admin.service.js";

export const listAdminMerchants: RequestHandler = async (_request, response) => {
  response.json({ merchants: await adminService.listMerchants() });
};

export const getAdminDashboard: RequestHandler = async (_request, response) => {
  response.json({ stats: await adminService.getDashboardStats() });
};
