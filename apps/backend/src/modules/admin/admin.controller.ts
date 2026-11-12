import type { RequestHandler } from "express";
import { adminService } from "./admin.service.js";
import { readAuditListQuery, readBlacklistCreate, readBlacklistListQuery, readId, readMerchantStatusChange, readReasonBody, readUserListQuery, readUserStatusChange } from "./admin.validation.js";

export const listAdminMerchants: RequestHandler = async (_request, response) => {
  response.json({ merchants: await adminService.listMerchants() });
};

export const getAdminDashboard: RequestHandler = async (_request, response) => {
  response.json({ stats: await adminService.getDashboardStats() });
};

export const listAdminUsers: RequestHandler = async (request, response) => {
  response.json(await adminService.listUsers(readUserListQuery(request.query)));
};

export const changeAdminUserStatus: RequestHandler = async (request, response) => {
  const input = readUserStatusChange(request.body);
  response.json(await adminService.changeUserStatus(readId(request.params.userId), input.status, input.reason, response.locals.user));
};

export const changeAdminMerchantStatus: RequestHandler = async (request, response) => {
  const input = readMerchantStatusChange(request.body);
  response.json(await adminService.changeMerchantStatus(readId(request.params.merchantId), input.isActive, input.reason, response.locals.user));
};

export const listAdminBlacklist: RequestHandler = async (request, response) => {
  response.json(await adminService.listBlacklist(readBlacklistListQuery(request.query)));
};

export const addAdminBlacklist: RequestHandler = async (request, response) => {
  const input = readBlacklistCreate(request.body);
  response.status(201).json(await adminService.addBlacklist(input.email, input.reason, response.locals.user));
};

export const deactivateAdminBlacklist: RequestHandler = async (request, response) => {
  const { reason } = readReasonBody(request.body);
  response.json(await adminService.deactivateBlacklist(readId(request.params.id), reason, response.locals.user));
};

export const listAdminAuditLogs: RequestHandler = async (request, response) => {
  response.json(await adminService.listAuditLogs(readAuditListQuery(request.query)));
};
