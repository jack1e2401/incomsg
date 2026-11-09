import type { RequestHandler } from "express";
import { productsService } from "./products.service.js";
import { readProductInput, readProductPatch, readRouteId } from "./products.validation.js";

export const createProduct: RequestHandler = async (request, response) => {
  const input = readProductInput(request.body);
  const product = await productsService.createProduct(response.locals.user.id, input);
  response.status(201).json({ product });
};

export const listOwnProducts: RequestHandler = async (_request, response) => {
  const products = await productsService.listOwnProducts(response.locals.user.id);
  response.json({ products });
};

export const updateProduct: RequestHandler = async (request, response) => {
  const productId = readRouteId(request.params.productId!);
  const patch = readProductPatch(request.body);
  const product = await productsService.updateProduct(response.locals.user.id, productId, patch);
  response.json({ product });
};

export const listPublicProducts: RequestHandler = async (request, response) => {
  const merchantId = readRouteId(request.params.merchantId!);
  const products = await productsService.listPublicProducts(merchantId);
  response.json({ products });
};
