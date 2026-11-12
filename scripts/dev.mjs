import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { testDatabaseUrl } from "./test-database-config.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backend = resolve(root, "apps/backend");
const backendEnvFile = resolve(backend, ".env");
const backendConfig = existsSync(backendEnvFile) ? parseEnv(readFileSync(backendEnvFile, "utf8")) : {};
const environment = { ...backendConfig, ...process.env };
const databaseUrl = testDatabaseUrl(environment);

const processes = [
  spawn(process.execPath, [resolve(backend, "node_modules/tsx/dist/cli.mjs"), "watch", "src/server.ts"], {
    cwd: backend,
    env: { ...environment, DATABASE_URL: databaseUrl, PAYMENT_MODE: "mock" },
    stdio: "inherit",
  }),
  spawn(process.execPath, [resolve(root, "node_modules/vite/bin/vite.js"), "--configLoader", "runner", "--host", "127.0.0.1"], {
    cwd: resolve(root, "apps/frontend"),
    env: process.env,
    stdio: "inherit",
  }),
];

let stopping = false;
function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of processes) if (child.exitCode === null) child.kill();
  process.exitCode = exitCode;
}

for (const child of processes) {
  child.on("error", (error) => {
    console.error("Could not start a development server", error);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) stop(code ?? 1);
  });
}

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
console.info("Development servers use local incomsg-test with mock payments.");
