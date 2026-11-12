import type { RequestHandler } from "express";
import type { PointTransactionType } from "../../generated/prisma/enums.js";
import { loyaltyService } from "./loyalty.service.js";
import { parseConfig } from "./loyalty.validation.js";
import { loyaltyRepository } from "./loyalty.repository.js";
import { VALID_TRANSACTION_TYPES } from "./loyalty.read.js";
import { HttpError } from "../../lib/http-error.js";
import { readRouteId } from "../products/products.validation.js";

export const getLoyaltyConfig: RequestHandler = async (_request, response) => {
  response.json({ config: await loyaltyService.getConfig(response.locals.user.id) });
};

export const putLoyaltyConfig: RequestHandler = async (request, response) => {
  const input = parseConfig(request.body);
  response.json({ config: await loyaltyService.saveConfig(response.locals.user.id, input) });
};

export const listLoyaltyPolicyHistory: RequestHandler = async (_request, response) => {
  const versions = await loyaltyService.listPolicyHistory(response.locals.user.id);
  response.json({ versions });
};

export const getMemberWallet: RequestHandler = async (request, response) => {
  const merchantId = readRouteId(request.params.merchantId);
  const wallet = await loyaltyRepository.getWallet(response.locals.user.id, merchantId);
  if (wallet === "merchant_missing") throw new HttpError(404, "MERCHANT_NOT_FOUND");
  response.json({ wallet });
};

export const previewMemberEarning: RequestHandler = async (request, response) => {
  const merchantId = readRouteId(request.params.merchantId);
  const netOrderAmountVnd = request.body?.netOrderAmountVnd;
  const result = await loyaltyService.previewMemberEarning(response.locals.user.id, merchantId, netOrderAmountVnd);
  response.json(result);
};

export const previewMerchantPolicy: RequestHandler = async (request, response) => {
  const result = await loyaltyService.previewMerchantPolicy(response.locals.user.id, request.body ?? {});
  response.json(result);
};

export const listMerchantTransactions: RequestHandler = async (request, response) => {
  const memberIdRaw = request.query.memberId;
  let memberId: number | undefined;
  if (memberIdRaw !== undefined) {
    if (typeof memberIdRaw !== "string" || !/^\d+$/.test(memberIdRaw)) {
      throw new HttpError(400, "INVALID_INPUT");
    }
    memberId = Number(memberIdRaw);
    if (!Number.isSafeInteger(memberId) || memberId <= 0) {
      throw new HttpError(400, "INVALID_INPUT");
    }
  }

  const orderIdRaw = request.query.orderId;
  let orderId: number | undefined;
  if (orderIdRaw !== undefined) {
    if (typeof orderIdRaw !== "string" || !/^\d+$/.test(orderIdRaw)) {
      throw new HttpError(400, "INVALID_INPUT");
    }
    orderId = Number(orderIdRaw);
    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      throw new HttpError(400, "INVALID_INPUT");
    }
  }

  const typeRaw = request.query.type;
  let type: PointTransactionType | undefined;
  if (typeRaw !== undefined) {
    if (typeof typeRaw !== "string" || !VALID_TRANSACTION_TYPES.includes(typeRaw as PointTransactionType)) {
      throw new HttpError(400, "INVALID_INPUT");
    }
    type = typeRaw as PointTransactionType;
  }

  const fromRaw = request.query.from;
  let from: string | undefined;
  if (fromRaw !== undefined) {
    if (typeof fromRaw !== "string" || Number.isNaN(Date.parse(fromRaw))) {
      throw new HttpError(400, "INVALID_INPUT");
    }
    from = fromRaw;
  }

  const toRaw = request.query.to;
  let to: string | undefined;
  if (toRaw !== undefined) {
    if (typeof toRaw !== "string" || Number.isNaN(Date.parse(toRaw))) {
      throw new HttpError(400, "INVALID_INPUT");
    }
    to = toRaw;
  }

  const cursorRaw = request.query.cursor;
  let cursor: number | undefined;
  if (cursorRaw !== undefined) {
    if (typeof cursorRaw !== "string" || !/^\d+$/.test(cursorRaw)) {
      throw new HttpError(400, "INVALID_INPUT");
    }
    cursor = Number(cursorRaw);
    if (!Number.isSafeInteger(cursor) || cursor <= 0) {
      throw new HttpError(400, "INVALID_INPUT");
    }
  }

  const limitRaw = request.query.limit;
  let limit: number | undefined;
  if (limitRaw !== undefined) {
    if (typeof limitRaw !== "string" || !/^\d+$/.test(limitRaw)) {
      throw new HttpError(400, "INVALID_INPUT");
    }
    limit = Number(limitRaw);
    if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 100) {
      throw new HttpError(400, "INVALID_INPUT");
    }
  }

  const result = await loyaltyService.listMerchantTransactions(response.locals.user.id, {
    memberId,
    orderId,
    type,
    from,
    to,
    cursor,
    limit,
  });
  response.json(result);
};
