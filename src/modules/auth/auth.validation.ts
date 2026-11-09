import { HttpError } from "../../lib/http-error.js";
import type { Credentials, MerchantRegistration } from "./auth.types.js";

function readObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return value as Record<string, unknown>;
}

function readCredentials(value: unknown): Credentials {
  const input = readObject(value);
  if (Object.keys(input).some((key) => !["email", "password"].includes(key))) {
    throw new HttpError(400, "INVALID_INPUT");
  }

  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input.password === "string" ? input.password : "";
  if (email.length > 191 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  if (password.length < 1 || password.length > 128) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return { email, password };
}

export function readRegistration(value: unknown): Credentials {
  const credentials = readCredentials(value);
  if (credentials.password.length < 12) throw new HttpError(400, "INVALID_INPUT");
  return credentials;
}

export function readMerchantRegistration(value: unknown): MerchantRegistration {
  const input = readObject(value);
  if (Object.keys(input).some((key) => !["email", "password", "storeName"].includes(key))) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  const credentials = readRegistration({ email: input.email, password: input.password });
  const storeName = typeof input.storeName === "string" ? input.storeName.trim() : "";
  if (storeName.length < 1 || storeName.length > 191) throw new HttpError(400, "INVALID_INPUT");
  return { ...credentials, storeName };
}

export function readLogin(value: unknown): Credentials {
  return readCredentials(value);
}
