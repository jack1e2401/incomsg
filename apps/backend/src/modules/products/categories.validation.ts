import { HttpError } from "../../lib/http-error.js";
import type { ProductCategoryInput, ProductCategoryPatch } from "./categories.types.js";

const categoryCreateFields = ["name", "slug", "description", "sortOrder"];
const categoryPatchFields = ["name", "slug", "description", "sortOrder"];
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const htmlTagPattern = /<\/?[a-zA-Z][^>]*>/;
const maxSortOrder = 100_000;

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

export function slugifyVietnamese(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
}

function readCategoryName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (name.length < 1 || name.length > 100) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return name;
}

function readCategorySlug(value: unknown): string {
  if (typeof value !== "string") {
    throw new HttpError(400, "INVALID_INPUT");
  }
  const slug = value.trim();
  if (slug.length < 1 || slug.length > 120 || !slugPattern.test(slug)) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return slug;
}

function readCategoryDescription(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new HttpError(400, "INVALID_INPUT");
  }
  const trimmed = value.trim();
  if (trimmed.length > 255 || htmlTagPattern.test(trimmed)) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return trimmed.length === 0 ? null : trimmed;
}

function readSortOrder(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > maxSortOrder) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return value;
}

export function readCategoryInput(value: unknown): ProductCategoryInput {
  const input = readObject(value);
  rejectUnexpectedFields(input, categoryCreateFields);

  const name = readCategoryName(input.name);
  let slug: string;
  if (input.slug === undefined) {
    slug = slugifyVietnamese(name);
    if (!slug) throw new HttpError(400, "INVALID_INPUT");
  } else {
    slug = readCategorySlug(input.slug);
  }

  const sortOrder = input.sortOrder === undefined ? 0 : readSortOrder(input.sortOrder);
  const result: ProductCategoryInput = { name, slug, sortOrder };
  if ("description" in input) {
    result.description = readCategoryDescription(input.description);
  }
  return result;
}

export function readCategoryPatch(value: unknown): ProductCategoryPatch {
  const input = readObject(value);
  rejectUnexpectedFields(input, categoryPatchFields);
  if (Object.keys(input).length === 0) {
    throw new HttpError(400, "INVALID_INPUT");
  }

  const patch: ProductCategoryPatch = {};
  if ("name" in input) patch.name = readCategoryName(input.name);
  if ("slug" in input) patch.slug = readCategorySlug(input.slug);
  if ("description" in input) patch.description = readCategoryDescription(input.description);
  if ("sortOrder" in input) patch.sortOrder = readSortOrder(input.sortOrder);
  return patch;
}
