import { HttpError } from "../../lib/http-error.js";
import { applicationRepository } from "./application.repository.js";

export const applicationService = {
  listPending() {
    return applicationRepository.listPending();
  },

  async approve(applicationId: number, reviewerId: number) {
    try {
      const result = await applicationRepository.approve(applicationId, reviewerId);
      if (result.kind === "missing") throw new HttpError(404, "APPLICATION_NOT_FOUND");
      if (result.kind === "already_reviewed") throw new HttpError(409, "APPLICATION_ALREADY_REVIEWED");
      return { application: result.application, merchant: result.merchant };
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        throw new HttpError(409, "MERCHANT_CONFLICT");
      }
      throw error;
    }
  },

  async reject(applicationId: number, reviewerId: number) {
    const result = await applicationRepository.reject(applicationId, reviewerId);
    if (result.kind === "missing") throw new HttpError(404, "APPLICATION_NOT_FOUND");
    if (result.kind === "already_reviewed") throw new HttpError(409, "APPLICATION_ALREADY_REVIEWED");
    return result.application;
  },
};
