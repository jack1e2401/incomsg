import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { parseEnv } from "node:util";

const root = resolve(import.meta.dirname, "..");
const backend = resolve(root, "apps/backend");
const frontend = resolve(root, "apps/frontend");
const envFile = resolve(backend, ".env");
const backendConfig = existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")) : {};
const frontendOrigin = new URL(process.env.FRONTEND_ORIGIN ?? backendConfig.FRONTEND_ORIGIN ?? "http://localhost:5173");
const backendRequire = createRequire(resolve(backend, "package.json"));
const frontendRequire = createRequire(resolve(frontend, "package.json"));
const vite = resolve(dirname(frontendRequire.resolve("vite/package.json")), "bin/vite.js");

const processes = [
  spawn(process.execPath, [backendRequire.resolve("tsx/cli"), "watch", "src/server.ts"], {
    cwd: backend,
    stdio: "inherit",
  }),
  spawn(process.execPath, [vite, "--configLoader", "runner", "--host", frontendOrigin.hostname, "--port", frontendOrigin.port || "5173", "--strictPort"], {
    cwd: frontend,
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
