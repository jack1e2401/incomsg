import type { RequestHandler } from "express";
import { categoriesService } from "./categories.service.js";
import { readCategoryInput, readCategoryPatch } from "./categories.validation.js";
import { readRouteId } from "./products.validation.js";

export const listOwnCategories: RequestHandler = async (_request, response) => {
  const categories = await categoriesService.listOwnCategories(response.locals.user.id);
  response.json({ categories });
};

export const createCategory: RequestHandler = async (request, response) => {
  const input = readCategoryInput(request.body);
  const category = await categoriesService.createCategory(response.locals.user.id, input);
  response.status(201).json({ category });
};

export const updateCategory: RequestHandler = async (request, response) => {
  const categoryId = readRouteId(request.params.categoryId);
  const patch = readCategoryPatch(request.body);
  const category = await categoriesService.updateCategory(response.locals.user.id, categoryId, patch);
  response.json({ category });
};

export const deleteCategory: RequestHandler = async (request, response) => {
  const categoryId = readRouteId(request.params.categoryId);
  const result = await categoriesService.deleteCategory(response.locals.user.id, categoryId);
  response.json(result);
};
