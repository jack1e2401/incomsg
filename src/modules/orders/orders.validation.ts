import { HttpError } from "../../lib/http-error.js";
import type { CreateOrderInput } from "./orders.types.js";

const maxId = 2_147_483_647;
const maxOrderLines = 100;

function readObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return value as Record<string, unknown>;
}

function readOrderLine(value: unknown): CreateOrderInput["items"][number] {
  const input = readObject(value);
  if (Object.keys(input).some((key) => key !== "productId" && key !== "quantity")) {
    throw new HttpError(400, "INVALID_INPUT");
  }

  const { productId, quantity } = input;
  if (typeof productId !== "number" || !Number.isInteger(productId) || productId < 1 || productId > maxId) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return { productId, quantity };
}

export function readCreateOrderInput(value: unknown): CreateOrderInput {
  const { voucherId, ...input } = readObject(value);
  if (voucherId !== undefined && (typeof voucherId !== "number" || !Number.isInteger(voucherId) || voucherId < 1 || voucherId > maxId)) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  const rawItems = "items" in input ? input.items : [input];
  if (("items" in input && Object.keys(input).length !== 1) ||
      !Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > maxOrderLines) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  const items = rawItems.map(readOrderLine);
  if (new Set(items.map(({ productId }) => productId)).size !== items.length) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return { items, ...(voucherId !== undefined ? { voucherId } : {}) };
}
