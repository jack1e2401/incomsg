import type { RequestHandler } from "express";
import { mediaService } from "./media.service.js";

export const uploadMerchantMedia: RequestHandler = async (request, response) => {
  const uploaded = await mediaService.uploadMerchantImage(response.locals.user.id, request);
  response.status(201).json(uploaded);
};
