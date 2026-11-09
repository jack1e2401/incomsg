import { HttpError } from "../../lib/http-error.js";
import type { ProductInput, ProductPatch } from "./products.types.js";

const maxId = 2_147_483_647;
const createFields = ["name", "price", "description", "imageUrl"];
const patchFields = [...createFields, "status"];

function readObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return value as Record<string, unknown>;
}

function rejectUnexpectedFields(input: Record<string, unknown>, allowed: string[]): void {
  if (Object.keys(input).some((key) => !allowed.includes(key))) {
    throw new HttpError(400, "INVALID_INPUT");
  }
}

function readName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (name.length < 1 || name.length > 191) throw new HttpError(400, "INVALID_INPUT");
  return name;
}

function readPrice(value: unknown): string {
  if (typeof value !== "string" || !/^[1-9]\d{0,14}$/.test(value)) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return value;
}

function readDescription(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > 1000) throw new HttpError(400, "INVALID_INPUT");
  return value;
}

function readImageUrl(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > 2048) throw new HttpError(400, "INVALID_INPUT");

  try {
    const url = new URL(value);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname) {
      throw new Error("Unsupported URL");
    }
  } catch {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return value;
}

export function readProductInput(value: unknown): ProductInput {
  const input = readObject(value);
  rejectUnexpectedFields(input, createFields);

  const result: ProductInput = {
    name: readName(input.name),
    price: readPrice(input.price),
  };
  if ("description" in input) result.description = readDescription(input.description);
  if ("imageUrl" in input) result.imageUrl = readImageUrl(input.imageUrl);
  return result;
}

export function readProductPatch(value: unknown): ProductPatch {
  const input = readObject(value);
  rejectUnexpectedFields(input, patchFields);
  if (Object.keys(input).length === 0) throw new HttpError(400, "INVALID_INPUT");

  const patch: ProductPatch = {};
  if ("name" in input) patch.name = readName(input.name);
  if ("price" in input) patch.price = readPrice(input.price);
  if ("description" in input) patch.description = readDescription(input.description);
  if ("imageUrl" in input) patch.imageUrl = readImageUrl(input.imageUrl);
  if ("status" in input) {
    if (input.status !== "ACTIVE" && input.status !== "HIDDEN") throw new HttpError(400, "INVALID_INPUT");
    patch.status = input.status;
  }
  return patch;
}

export function readRouteId(value: unknown): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new HttpError(400, "INVALID_INPUT");
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1 || id > maxId) throw new HttpError(400, "INVALID_INPUT");
  return id;
}
