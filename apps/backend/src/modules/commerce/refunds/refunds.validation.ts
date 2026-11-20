import { HttpError } from "../../../lib/http-error.js";
export function reasonInput(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 255) throw new HttpError(400, "INVALID_INPUT");
  return value.trim();
}
