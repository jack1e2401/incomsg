import type { RequestHandler } from "express";
import { merchantService } from "../../merchants/profile/merchant.service.js";
import { parseAnalyticsQuery } from "./analytics.domain.js";
import { getMerchantAnalytics } from "./analytics.service.js";

export const getAnalytics: RequestHandler = async (request, response) => {
  const merchant = await merchantService.getOwnStore(response.locals.user.id);
  const range = parseAnalyticsQuery(request.query as Record<string, unknown>);
  response.json(await getMerchantAnalytics(merchant.id, range));
};
