import { HttpError } from "../../lib/http-error.js";
import type { DefinitionInput, DefinitionPatch } from "./vouchers.types.js";

const maxInt = 2_147_483_647;
function invalid(): never { throw new HttpError(400, "INVALID_INPUT"); }
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function positiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= maxInt;
}
function amount(value: unknown): value is string {
  return typeof value === "string" && /^[1-9][0-9]{0,14}$/.test(value);
}
function validateFields(input: Record<string, unknown>, partial: boolean) {
  if (input.title !== undefined && (typeof input.title !== "string" || !input.title.trim() || input.title.trim().length > 191)) invalid();
  if (input.pointsCost !== undefined && !positiveInt(input.pointsCost)) invalid();
  if (input.discountAmount !== undefined && input.discountAmount !== null && !amount(input.discountAmount)) invalid();
  if (input.rewardDescription !== undefined && input.rewardDescription !== null && (typeof input.rewardDescription !== "string" || !input.rewardDescription.trim() || input.rewardDescription.length > 1000)) invalid();
  if (input.isActive !== undefined && typeof input.isActive !== "boolean") invalid();
  if (partial && Object.keys(input).length === 0) invalid();
}

export function readIdempotencyKey(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 128) invalid();
  const trimmed = value.trim();
  if (trimmed.length === 0) invalid();
  return trimmed;
}

export function readDefinitionInput(value: unknown, allowLegacyReward = false): DefinitionInput {
  const input = record(value);
  if (Object.keys(input).some((key) => !["type", "title", "pointsCost", "discountAmount", "rewardDescription", "rewardProductId", "initialQuantity"].includes(key))) invalid();
  if (input.title === undefined || input.pointsCost === undefined) invalid();
  validateFields(input, false);
  const title = (input.title as string).trim();
  const pointsCost = input.pointsCost as number;
  const initialQuantity = input.initialQuantity === undefined ? 0 : input.initialQuantity;
  if (typeof initialQuantity !== "number" || !Number.isSafeInteger(initialQuantity) || initialQuantity < 0 || initialQuantity > maxInt) invalid();
  if (input.type === "DISCOUNT") {
    if (!amount(input.discountAmount) || input.rewardDescription != null || input.rewardProductId != null) invalid();
    return { type: "DISCOUNT", title, pointsCost, discountAmount: input.discountAmount, rewardDescription: null, rewardProductId: null, initialQuantity };
  }
  if (input.type === "REWARD") {
    if (input.initialQuantity !== undefined) invalid();
    if (input.discountAmount != null) invalid();
    if (positiveInt(input.rewardProductId) && input.rewardDescription == null) {
      return { type: "REWARD", title, pointsCost, discountAmount: null, rewardDescription: null, rewardProductId: input.rewardProductId };
    }
    if (allowLegacyReward && input.rewardProductId == null && typeof input.rewardDescription === "string" && input.rewardDescription.trim()) {
      return { type: "REWARD", title, pointsCost, discountAmount: null, rewardDescription: input.rewardDescription.trim(), rewardProductId: null };
    }
  }
  return invalid();
}

export function readDefinitionPatch(value: unknown): DefinitionPatch {
  const input = record(value);
  if (Object.keys(input).some((key) => !["title", "pointsCost", "discountAmount", "rewardDescription", "isActive"].includes(key))) invalid();
  validateFields(input, true);
  return {
    ...(input.title !== undefined ? { title: (input.title as string).trim() } : {}),
    ...(input.pointsCost !== undefined ? { pointsCost: input.pointsCost as number } : {}),
    ...(input.discountAmount !== undefined ? { discountAmount: input.discountAmount as string | null } : {}),
    ...(input.rewardDescription !== undefined ? { rewardDescription: input.rewardDescription as string | null } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive as boolean } : {}),
  };
}

export function readFulfillmentNote(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const input = record(value);
  if (Object.keys(input).some((key) => key !== "note")) invalid();
  if (input.note === undefined || input.note === null) return undefined;
  if (typeof input.note !== "string" || input.note.length > 255) invalid();
  return input.note.trim() || undefined;
}

export function readCancellationReason(value: unknown): string {
  if (value === undefined || value === null) return "Merchant cancelled reward";
  const input = record(value);
  if (Object.keys(input).some((key) => key !== "reason")) invalid();
  if (input.reason === undefined || input.reason === null) return "Merchant cancelled reward";
  if (typeof input.reason !== "string" || !input.reason.trim() || input.reason.length > 255) invalid();
  return input.reason.trim();
}
