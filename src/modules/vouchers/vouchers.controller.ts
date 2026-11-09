import type { RequestHandler } from "express";
import { HttpError } from "../../lib/http-error.js";
import { vouchersService } from "./vouchers.service.js";
import { readDefinitionInput, readDefinitionPatch } from "./vouchers.validation.js";

function readId(value: string): number {
  if (!/^[1-9][0-9]*$/.test(value)) throw new HttpError(400, "INVALID_INPUT");
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id > 2_147_483_647) throw new HttpError(400, "INVALID_INPUT");
  return id;
}
function param(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}
export const listMerchantDefinitions: RequestHandler = async (_request, response) => {
  response.json({ definitions: await vouchersService.listMerchantDefinitions(response.locals.user.id) });
};
export const createDefinition: RequestHandler = async (request, response) => {
  const definition = await vouchersService.createDefinition(response.locals.user.id, readDefinitionInput(request.body));
  response.status(201).json({ definition });
};
export const updateDefinition: RequestHandler = async (request, response) => {
  const definition = await vouchersService.updateDefinition(response.locals.user.id, readId(param(request.params.id)), readDefinitionPatch(request.body));
  response.json({ definition });
};
export const listPublicDefinitions: RequestHandler = async (request, response) => {
  const definitions = await vouchersService.listPublicDefinitions(readId(param(request.params.merchantId)));
  response.json({ definitions });
};
export const listOwnedVouchers: RequestHandler = async (request, response) => {
  const vouchers = await vouchersService.listOwnedVouchers(response.locals.user.id, readId(param(request.params.merchantId)));
  response.json({ vouchers });
};
export const redeemVoucher: RequestHandler = async (request, response) => {
  const result = await vouchersService.redeemVoucher(response.locals.user.id, readId(param(request.params.definitionId)));
  response.status(201).json(result);
};
