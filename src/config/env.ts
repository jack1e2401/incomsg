import "dotenv/config";

const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

export const env = {
  port,
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
};

if (!env.jwtSecret || Buffer.byteLength(env.jwtSecret, "utf8") < 32) {
  throw new Error("JWT_SECRET must be configured with at least 32 bytes");
}
