import type { RequestHandler } from "express";
import { merchantService } from "./merchant.service.js";
import { getMerchantFinance, readFinanceQuery } from "./merchant.finance.js";

export const getOwnStore: RequestHandler = async (_request, response) => {
  const merchant = await merchantService.getOwnStore(response.locals.user.id);
  response.json({ merchant });
};

export const getOwnFinance: RequestHandler = async (request, response) => {
  const query = readFinanceQuery(request.query);
  const merchant = await merchantService.getOwnStore(response.locals.user.id);
  response.json(await getMerchantFinance(merchant.id, query));
};
