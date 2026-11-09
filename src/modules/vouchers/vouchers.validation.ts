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

export function readDefinitionInput(value: unknown): DefinitionInput {
  const input = record(value);
  if (Object.keys(input).some((key) => !["type", "title", "pointsCost", "discountAmount", "rewardDescription"].includes(key))) invalid();
  if (input.title === undefined || input.pointsCost === undefined) invalid();
  validateFields(input, false);
  if (input.type === "DISCOUNT") {
    if (!amount(input.discountAmount) || input.rewardDescription !== undefined && input.rewardDescription !== null) invalid();
    return { type: "DISCOUNT", title: (input.title as string).trim(), pointsCost: input.pointsCost as number, discountAmount: input.discountAmount, rewardDescription: null };
  }
  if (input.type === "REWARD") {
    if (input.discountAmount !== undefined && input.discountAmount !== null || typeof input.rewardDescription !== "string" || !input.rewardDescription.trim()) invalid();
    return { type: "REWARD", title: (input.title as string).trim(), pointsCost: input.pointsCost as number, discountAmount: null, rewardDescription: input.rewardDescription.trim() };
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
