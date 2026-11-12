import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { env } from "../config/env.js";
import { PrismaClient } from "../generated/prisma/client.js";

if (!env.databaseUrl) {
  throw new Error("DATABASE_URL is required. Copy .env.example to .env.");
}

const url = new URL(env.databaseUrl);
const host = url.hostname === "[::1]" ? "::1" : url.hostname;
const adapter = new PrismaMariaDb({
  host,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: decodeURIComponent(url.pathname.slice(1)),
  // MySQL's full password handshake can request the server's RSA key on loopback.
  allowPublicKeyRetrieval: ["localhost", "127.0.0.1", "::1"].includes(host),
  connectionLimit: 5,
});

export const prisma = new PrismaClient({ adapter });
