import { HttpError } from "../../../lib/http-error.js";
import type {
  MerchantProductListQuery,
  ProductImageInput,
  ProductInput,
  ProductPatch,
  ProductSortOption,
  PublicProductListQuery,
} from "./products.types.js";

const maxId = 2_147_483_647;
const maxThreshold = 100_000;
const maxGalleryImages = 10;
const sharedFields = [
  "name",
  "price",
  "description",
  "richDescription",
  "imageUrl",
  "images",
  "sku",
  "categoryId",
  "lowStockThreshold",
];
const createFields = [...sharedFields, "kind", "initialQuantity"];
const patchFields = [...sharedFields, "status"];
const imageItemFields = ["url", "altText", "sortOrder"];
const htmlTagPattern = /<\/?[a-zA-Z][^>]*>|<script\b/i;

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

function readRichDescription(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > 5000 || htmlTagPattern.test(value)) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return value;
}

function readSku(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") throw new HttpError(400, "INVALID_INPUT");
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 64 || /[\u0000-\u001f]/.test(trimmed)) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return trimmed;
}

function readCategoryId(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > maxId) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return value;
}

function readLowStockThreshold(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > maxThreshold) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return value;
}

export function readImageUrl(value: unknown): string | null {
  if (value === null) return null;
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 2048 ||
    /[\s\u0000-\u001f\\]/.test(value)
  ) {
    throw new HttpError(400, "INVALID_INPUT");
  }

  if (value.startsWith("/images/") || value.startsWith("/uploads/")) {
    const prefix = value.startsWith("/images/") ? "/images/" : "/uploads/";
    if (value.length <= prefix.length || value.includes("..")) {
      throw new HttpError(400, "INVALID_INPUT");
    }
    return value;
  }

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

function readImages(value: unknown): ProductImageInput[] {
  if (!Array.isArray(value) || value.length > maxGalleryImages) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  const normalized = value.map((item, index) => {
    const record = readObject(item);
    rejectUnexpectedFields(record, imageItemFields);
    const url = readImageUrl(record.url);
    if (url === null) {
      throw new HttpError(400, "INVALID_INPUT");
    }
    let altText: string | null = null;
    if (record.altText !== undefined && record.altText !== null) {
      if (typeof record.altText !== "string") {
        throw new HttpError(400, "INVALID_INPUT");
      }
      const trimmedAlt = record.altText.trim();
      if (trimmedAlt.length > 191 || htmlTagPattern.test(trimmedAlt)) {
        throw new HttpError(400, "INVALID_INPUT");
      }
      altText = trimmedAlt.length === 0 ? null : trimmedAlt;
    }
    let sortOrder = index;
    if (record.sortOrder !== undefined) {
      if (
        typeof record.sortOrder !== "number" ||
        !Number.isSafeInteger(record.sortOrder) ||
        record.sortOrder < 0 ||
        record.sortOrder > maxThreshold
      ) {
        throw new HttpError(400, "INVALID_INPUT");
      }
      sortOrder = record.sortOrder;
    }
    return { url, altText, sortOrder };
  });

  return normalized.sort((a, b) => a.sortOrder - b.sortOrder);
}

export function readProductInput(value: unknown): ProductInput {
  const input = readObject(value);
  rejectUnexpectedFields(input, createFields);

  const kind = "kind" in input ? input.kind : "SALE";
  if (kind !== "SALE" && kind !== "REWARD") throw new HttpError(400, "INVALID_INPUT");
  if (kind === "REWARD" && "price" in input) throw new HttpError(400, "INVALID_INPUT");
  const initialQuantity = input.initialQuantity === undefined ? 0 : input.initialQuantity;
  if (typeof initialQuantity !== "number" || !Number.isSafeInteger(initialQuantity) || initialQuantity < 0 || initialQuantity > maxId) {
    throw new HttpError(400, "INVALID_INPUT");
  }

  const name = readName(input.name);
  const result: ProductInput = kind === "REWARD"
    ? { name, kind, initialQuantity }
    : { name, kind, price: readPrice(input.price), initialQuantity };
  if ("description" in input) result.description = readDescription(input.description);
  if ("richDescription" in input) result.richDescription = readRichDescription(input.richDescription);
  if ("imageUrl" in input) result.imageUrl = readImageUrl(input.imageUrl);
  if ("images" in input) {
    result.images = readImages(input.images);
    result.imageUrl = result.images[0]?.url ?? null;
  }
  if ("sku" in input) result.sku = readSku(input.sku);
  if ("categoryId" in input) result.categoryId = readCategoryId(input.categoryId);
  if ("lowStockThreshold" in input) {
    result.lowStockThreshold = readLowStockThreshold(input.lowStockThreshold);
  }
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
  if ("richDescription" in input) patch.richDescription = readRichDescription(input.richDescription);
  if ("imageUrl" in input) patch.imageUrl = readImageUrl(input.imageUrl);
  if ("images" in input) {
    patch.images = readImages(input.images);
    patch.imageUrl = patch.images[0]?.url ?? null;
  }
  if ("sku" in input) patch.sku = readSku(input.sku);
  if ("categoryId" in input) patch.categoryId = readCategoryId(input.categoryId);
  if ("lowStockThreshold" in input) {
    patch.lowStockThreshold = readLowStockThreshold(input.lowStockThreshold);
  }
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

export function readStoreSlug(value: unknown): string {
  if (typeof value !== "string") throw new HttpError(400, "INVALID_INPUT");
  const slug = value.trim();
  if (slug.length < 1 || slug.length > 191 || /[\s\u0000-\u001f]/.test(slug)) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return slug;
}

function readOptionalQueryString(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new HttpError(400, "INVALID_INPUT");
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function readPositiveQueryInt(value: unknown, fallback: number, maxValue: number): number {
  const raw = readOptionalQueryString(value);
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw)) throw new HttpError(400, "INVALID_INPUT");
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maxValue) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return parsed;
}

function readSortOption(value: unknown): ProductSortOption {
  const raw = readOptionalQueryString(value);
  if (raw === undefined) return "newest";
  if (raw === "newest" || raw === "price_asc" || raw === "price_desc" || raw === "name_asc") {
    return raw;
  }
  throw new HttpError(400, "INVALID_INPUT");
}

export function readMerchantProductQuery(query: Record<string, unknown>): MerchantProductListQuery {
  const q = readOptionalQueryString(query.q);
  if (q !== undefined && q.length > 100) throw new HttpError(400, "INVALID_INPUT");

  const categoryRaw = readOptionalQueryString(query.categoryId);
  const categoryId = categoryRaw === undefined ? undefined : readRouteId(categoryRaw);

  const statusRaw = readOptionalQueryString(query.status);
  if (statusRaw !== undefined && statusRaw !== "ACTIVE" && statusRaw !== "HIDDEN") {
    throw new HttpError(400, "INVALID_INPUT");
  }

  const kindRaw = readOptionalQueryString(query.kind);
  if (kindRaw !== undefined && kindRaw !== "SALE" && kindRaw !== "REWARD") {
    throw new HttpError(400, "INVALID_INPUT");
  }

  const lowStockRaw = readOptionalQueryString(query.lowStock);
  if (lowStockRaw !== undefined && lowStockRaw !== "true" && lowStockRaw !== "false") {
    throw new HttpError(400, "INVALID_INPUT");
  }

  return {
    ...(q !== undefined ? { q } : {}),
    ...(categoryId !== undefined ? { categoryId } : {}),
    ...(statusRaw !== undefined ? { status: statusRaw } : {}),
    ...(kindRaw !== undefined ? { kind: kindRaw } : {}),
    ...(lowStockRaw === "true" ? { lowStock: true } : {}),
    sort: readSortOption(query.sort),
    page: readPositiveQueryInt(query.page, 1, maxId),
    limit: readPositiveQueryInt(query.limit, 20, 100),
  };
}

export function readPublicProductQuery(query: Record<string, unknown>): PublicProductListQuery {
  const q = readOptionalQueryString(query.q);
  if (q !== undefined && q.length > 100) throw new HttpError(400, "INVALID_INPUT");

  const categoryRaw = readOptionalQueryString(query.categoryId);
  const categoryId = categoryRaw === undefined ? undefined : readRouteId(categoryRaw);

  return {
    ...(q !== undefined ? { q } : {}),
    ...(categoryId !== undefined ? { categoryId } : {}),
    sort: readSortOption(query.sort),
    page: readPositiveQueryInt(query.page, 1, maxId),
    limit: readPositiveQueryInt(query.limit, 20, 100),
  };
}
