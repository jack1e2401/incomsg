import type { RequestHandler } from "express";
import { merchantService } from "../../merchants/profile/merchant.service.js";
import { productsService } from "./products.service.js";
import {
  readMerchantProductQuery,
  readProductInput,
  readProductPatch,
  readPublicProductQuery,
  readRouteId,
  readStoreSlug,
} from "./products.validation.js";

export const createProduct: RequestHandler = async (request, response) => {
  const input = readProductInput(request.body);
  const product = await productsService.createProduct(response.locals.user.id, input);
  response.status(201).json({ product });
};

export const listOwnProducts: RequestHandler = async (request, response) => {
  const query = readMerchantProductQuery(request.query as Record<string, unknown>);
  const result = await productsService.listOwnProducts(response.locals.user.id, query);
  response.json(result);
};

export const updateProduct: RequestHandler = async (request, response) => {
  const productId = readRouteId(request.params.productId);
  const patch = readProductPatch(request.body);
  const product = await productsService.updateProduct(response.locals.user.id, productId, patch);
  response.json({ product });
};

export const listPublicProducts: RequestHandler = async (request, response) => {
  const merchantId = readRouteId(request.params.merchantId);
  const query = readPublicProductQuery(request.query as Record<string, unknown>);
  const result = await productsService.listPublicProducts(merchantId, query);
  response.json(result);
};

export const listPublicStoreProducts: RequestHandler = async (request, response) => {
  const slug = readStoreSlug(request.params.slug);
  const query = readPublicProductQuery(request.query as Record<string, unknown>);
  const result = await productsService.listPublicStoreProducts(slug, query);
  response.json(result);
};

export const getPublicStoreProduct: RequestHandler = async (request, response) => {
  const slug = readStoreSlug(request.params.slug);
  const productId = readRouteId(request.params.productId);
  const product = await productsService.getPublicStoreProduct(slug, productId);
  response.json({ product });
};

export const listPublicMerchants: RequestHandler = async (request, response) => {
  const merchants = await merchantService.listActiveStores(request.query.include === "cover");
  response.json({ merchants });
};
