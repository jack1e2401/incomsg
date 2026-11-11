import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env.js";

const secret = new TextEncoder().encode(env.jwtSecret);
const issuer = "incomsg-backend";
const audience = "incomsg-api";

export async function signAccessToken(userId: number): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}

export async function readAccessToken(token: string): Promise<number> {
  const { payload } = await jwtVerify(token, secret, {
    algorithms: ["HS256"],
    issuer,
    audience,
  });
  const userId = Number(payload.sub);
  if (!Number.isSafeInteger(userId) || userId < 1) {
    throw new Error("Invalid token subject");
  }
  return userId;
}
