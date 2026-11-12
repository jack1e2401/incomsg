import { HttpError } from "../../lib/http-error.js";
import { readRouteId } from "../products/products.validation.js";

const maxQuantity = 2_147_483_647;

export function readInventoryAdjustment(value: unknown, idempotencyKey: unknown, direction: "in" | "out") {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new HttpError(400, "INVALID_INPUT");
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !["quantity", "reason", "returnToStock"].includes(key))) throw new HttpError(400, "INVALID_INPUT");
  if (!Number.isSafeInteger(body.quantity) || typeof body.quantity !== "number" || body.quantity < 1 || body.quantity > maxQuantity) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  if (typeof body.reason !== "string" || !body.reason.trim() || body.reason.trim().length > 255) throw new HttpError(400, "INVALID_INPUT");
  if (body.returnToStock !== undefined && typeof body.returnToStock !== "boolean") throw new HttpError(400, "INVALID_INPUT");
  if (typeof idempotencyKey !== "string" || !idempotencyKey.trim() || idempotencyKey.trim().length > 128) {
    throw new HttpError(400, "IDEMPOTENCY_KEY_REQUIRED");
  }
  if (body.returnToStock && (direction !== "in")) throw new HttpError(400, "INVALID_INPUT");
  return {
    quantity: body.quantity,
    reason: body.reason.trim(),
    returnToStock: body.returnToStock === true,
    requestKey: idempotencyKey.trim(),
  };
}

export { readRouteId };
