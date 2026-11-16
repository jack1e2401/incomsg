import type { RequestHandler } from "express";
import { storefrontService } from "./storefront.service.js";
import { readStorefrontConfig, readStorefrontNote, readVersionId } from "./storefront.validation.js";

export const getMerchantStorefront: RequestHandler = async (_request, response) => {
  response.json(await storefrontService.getMerchantStorefront(response.locals.user.id));
};

export const saveMerchantStorefrontDraft: RequestHandler = async (request, response) => {
  const config = readStorefrontConfig(request.body, 6);
  response.json(await storefrontService.saveDraft(response.locals.user.id, config));
};

export const getMerchantStorefrontPreview: RequestHandler = async (_request, response) => {
  response.json(await storefrontService.getPreview(response.locals.user.id));
};

export const publishMerchantStorefront: RequestHandler = async (request, response) => {
  const note = readStorefrontNote(request.body);
  const result = await storefrontService.publish(response.locals.user.id, note);
  response.status(201).json(result);
};

export const listMerchantStorefrontVersions: RequestHandler = async (_request, response) => {
  response.json(await storefrontService.listVersions(response.locals.user.id));
};

export const rollbackMerchantStorefrontVersion: RequestHandler = async (request, response) => {
  const versionId = readVersionId(request.params.versionId);
  const note = readStorefrontNote(request.body);
  const result = await storefrontService.rollbackVersion(response.locals.user.id, versionId, note);
  response.status(201).json(result);
};

export const getPublicStorefrontBySlug: RequestHandler = async (request, response) => {
  const slug = typeof request.params.slug === "string" ? request.params.slug : "";
  response.json(await storefrontService.getPublicStorefront(slug));
};
