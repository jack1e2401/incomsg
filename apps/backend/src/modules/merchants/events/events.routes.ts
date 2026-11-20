import { Router } from "express";
import { authenticate, requireRole } from "../../../middleware/auth.js";
import {
  createMerchantEvent,
  deleteMerchantEvent,
  getMerchantEvent,
  getPublicStoreEvent,
  listMerchantEvents,
  listPublicStoreEvents,
  publishMerchantEvent,
  unpublishMerchantEvent,
  updateMerchantEvent,
} from "./events.controller.js";

export const merchantEventRoutes = Router();
merchantEventRoutes.use(authenticate, requireRole("MERCHANT"));
merchantEventRoutes.get("/", listMerchantEvents);
merchantEventRoutes.post("/", createMerchantEvent);
merchantEventRoutes.get("/:eventId", getMerchantEvent);
merchantEventRoutes.patch("/:eventId", updateMerchantEvent);
merchantEventRoutes.post("/:eventId/publish", publishMerchantEvent);
merchantEventRoutes.post("/:eventId/unpublish", unpublishMerchantEvent);
merchantEventRoutes.delete("/:eventId", deleteMerchantEvent);

export const publicStoreEventRoutes = Router();
publicStoreEventRoutes.get("/:slug/events", listPublicStoreEvents);
publicStoreEventRoutes.get("/:slug/events/:eventSlug", getPublicStoreEvent);
