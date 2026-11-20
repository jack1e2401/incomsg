import type { RequestHandler } from "express";
import { eventsService } from "./events.service.js";
import {
  readCreateEventInput,
  readEventId,
  readMerchantEventsQuery,
  readPublicEventsQuery,
  readRouteSlug,
  readUpdateEventInput,
} from "./events.validation.js";

export const listMerchantEvents: RequestHandler = async (request, response) => {
  const query = readMerchantEventsQuery(request.query);
  const result = await eventsService.listMerchantEvents(response.locals.user.id, query);
  response.json(result);
};

export const createMerchantEvent: RequestHandler = async (request, response) => {
  const input = readCreateEventInput(request.body);
  const event = await eventsService.createMerchantEvent(response.locals.user.id, input);
  response.status(201).json({ event });
};

export const getMerchantEvent: RequestHandler = async (request, response) => {
  const eventId = readEventId(request.params.eventId);
  const event = await eventsService.getMerchantEvent(response.locals.user.id, eventId);
  response.json({ event });
};

export const updateMerchantEvent: RequestHandler = async (request, response) => {
  const eventId = readEventId(request.params.eventId);
  const patch = readUpdateEventInput(request.body);
  const event = await eventsService.updateMerchantEvent(response.locals.user.id, eventId, patch);
  response.json({ event });
};

export const publishMerchantEvent: RequestHandler = async (request, response) => {
  const eventId = readEventId(request.params.eventId);
  const event = await eventsService.publishMerchantEvent(response.locals.user.id, eventId);
  response.json({ event });
};

export const unpublishMerchantEvent: RequestHandler = async (request, response) => {
  const eventId = readEventId(request.params.eventId);
  const event = await eventsService.unpublishMerchantEvent(response.locals.user.id, eventId);
  response.json({ event });
};

export const deleteMerchantEvent: RequestHandler = async (request, response) => {
  const eventId = readEventId(request.params.eventId);
  const result = await eventsService.deleteMerchantEvent(response.locals.user.id, eventId);
  response.json(result);
};

export const listPublicStoreEvents: RequestHandler = async (request, response) => {
  const storeSlug = readRouteSlug(request.params.slug);
  const query = readPublicEventsQuery(request.query);
  const result = await eventsService.listPublicStoreEvents(storeSlug, query);
  response.json(result);
};

export const getPublicStoreEvent: RequestHandler = async (request, response) => {
  const storeSlug = readRouteSlug(request.params.slug);
  const eventSlug = readRouteSlug(request.params.eventSlug);
  const result = await eventsService.getPublicStoreEvent(storeSlug, eventSlug);
  response.json(result);
};
