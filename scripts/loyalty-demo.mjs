import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { testDatabaseUrl } from "./test-database-config.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backend = resolve(root, "apps/backend");
const require = createRequire(resolve(backend, "package.json"));
const envPath = resolve(backend, ".env");
const source = { ...(existsSync(envPath) ? parseEnv(readFileSync(envPath, "utf8")) : {}), ...process.env };
const environment = {
  ...source,
  DATABASE_URL: testDatabaseUrl(source),
  JWT_SECRET: source.JWT_SECRET || randomBytes(32).toString("hex"),
  PAYMENT_MODE: "mock",
  PORT: source.DEMO_PORT || "3000",
  FRONTEND_ORIGIN: source.DEMO_FRONTEND_ORIGIN || "http://localhost:5173",
  VITE_API_MODE: "http",
  VITE_PAYMENT_MODE: "mock",
  VITE_API_BASE_URL: source.DEMO_API_URL || `http://localhost:${source.DEMO_PORT || "3000"}`,
};
const action = process.argv[2];
if (!["serve", "frontend", "seed", "verify"].includes(action)) throw new Error("Use serve, frontend, seed, or verify");
console.log("Loyalty demo target: local incomsg-test; payment mode: mock");

function run(args, cwd = backend) {
  const result = spawnSync(process.execPath, args, { cwd, env: environment, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (action === "serve" || action === "seed") {
  run([require.resolve("prisma/build/index.js"), "migrate", "deploy", "--config", "prisma7.config.ts"]);
  run([require.resolve("prisma/build/index.js"), "generate"]);
}
if (action === "seed" || action === "verify") {
  run([require.resolve("tsx/cli"), action === "seed" ? "prisma/demo-seed.ts" : "prisma/demo-http.ts"]);
} else {
  const npmCli = process.env.npm_execpath ?? resolve(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
  const child = spawn(process.execPath, [npmCli, "run", action === "frontend" ? "dev:frontend" : "dev:backend"], { cwd: root, env: environment, stdio: "inherit" });
  child.on("error", (error) => { throw error; });
  child.on("exit", (code) => { process.exitCode = code ?? 1; });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
}
