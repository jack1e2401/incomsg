import { HttpError } from "../../lib/http-error.js";
import type { CreateOrderInput } from "./orders.types.js";

const maxId = 2_147_483_647;

export function readCreateOrderInput(value: unknown): CreateOrderInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => key !== "productId" && key !== "quantity" && key !== "voucherId")) {
    throw new HttpError(400, "INVALID_INPUT");
  }

  const { productId, quantity } = input;
  if (typeof productId !== "number" || !Number.isInteger(productId) || productId < 1 || productId > maxId) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  const voucherId = input.voucherId;
  if (voucherId !== undefined && (typeof voucherId !== "number" || !Number.isInteger(voucherId) || voucherId < 1 || voucherId > maxId)) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return { productId, quantity, ...(voucherId !== undefined ? { voucherId } : {}) };
}
