import type { RequestHandler } from "express";
import { HttpError } from "../../lib/http-error.js";
import { applicationService } from "./application.service.js";

function readApplicationId(value: unknown): number {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id > 2_147_483_647) throw new HttpError(400, "INVALID_INPUT");
  return id;
}

export const listPending: RequestHandler = async (_request, response) => {
  response.json({ applications: await applicationService.listPending() });
};

export const approve: RequestHandler = async (request, response) => {
  const user = response.locals.user;
  const result = await applicationService.approve(readApplicationId(request.params.id), user.id);
  response.json(result);
};

export const reject: RequestHandler = async (request, response) => {
  const user = response.locals.user;
  const application = await applicationService.reject(readApplicationId(request.params.id), user.id);
  response.json({ application });
};
