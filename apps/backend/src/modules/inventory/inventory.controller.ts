import type { RequestHandler } from "express";
import { inventoryService } from "./inventory.service.js";
import { readInventoryAdjustment, readRouteId } from "./inventory.validation.js";
import type { InventoryItemKind } from "./inventory.repository.js";

function params(request: Parameters<RequestHandler>[0], kind: InventoryItemKind) {
  const id = readRouteId(request.params.productId ?? request.params.definitionId);
  return { id, kind };
}

export function inventoryHandlers(kind: InventoryItemKind) {
  const get: RequestHandler = async (request, response) => {
    const { id } = params(request, kind);
    response.json(await inventoryService.get(response.locals.user.id, kind, id));
  };
  const adjust = (direction: "in" | "out"): RequestHandler => async (request, response) => {
    const { id } = params(request, kind);
    const input = readInventoryAdjustment(request.body, request.header("Idempotency-Key"), direction);
    response.json(await inventoryService.adjust(response.locals.user.id, kind, id, { ...input, direction }));
  };
  return { get, stockIn: adjust("in"), stockOut: adjust("out") };
}
