import type { RequestHandler } from "express";
import { merchantService } from "../merchant/merchant.service.js";
import { readRouteId } from "../products/products.validation.js";
import { parseCustomerListQuery } from "./customers.domain.js";
import { getMerchantCustomerDetail, listMerchantCustomers } from "./customers.service.js";

export const listCustomers: RequestHandler = async (request, response) => {
  const merchant = await merchantService.getOwnStore(response.locals.user.id);
  const query = parseCustomerListQuery(request.query as Record<string, unknown>);
  response.json(await listMerchantCustomers(merchant.id, query));
};

export const getCustomerDetail: RequestHandler = async (request, response) => {
  const merchant = await merchantService.getOwnStore(response.locals.user.id);
  const memberId = readRouteId(request.params.memberId);
  response.json(await getMerchantCustomerDetail(merchant.id, memberId));
};
