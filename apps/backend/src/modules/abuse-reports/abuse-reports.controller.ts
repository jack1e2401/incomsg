import type { RequestHandler } from "express";
import { abuseReportsService } from "./abuse-reports.service.js";
import { readCreateAbuseReport } from "./abuse-reports.validation.js";

export const createMerchantAbuseReport: RequestHandler = async (request, response) => {
  const input = readCreateAbuseReport(request.body);
  const result = await abuseReportsService.create(response.locals.user.id, input);
  response.status(201).json(result);
};
