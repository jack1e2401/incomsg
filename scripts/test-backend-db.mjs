import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";
import { testDatabaseUrl } from "./test-database-config.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backend = resolve(root, "apps/backend");
const require = createRequire(resolve(backend, "package.json"));
const envPath = resolve(backend, ".env");
const environment = { ...(existsSync(envPath) ? parseEnv(readFileSync(envPath, "utf8")) : {}), ...process.env };
const testEnvironment = { ...environment, DATABASE_URL: testDatabaseUrl(environment), NODE_ENV: "test" };
function run(args, cwd) {
  const result = spawnSync(process.execPath, args, { cwd, env: testEnvironment, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("MySQL integration target: local incomsg-test");
run([require.resolve("prisma/build/index.js"), "migrate", "deploy", "--config", "prisma7.config.ts"], backend);
if (!process.argv.includes("--migrate-only")) {
  const fileIndex = process.argv.indexOf("--test-file");
  if (fileIndex !== -1) {
    const file = process.argv[fileIndex + 1];
    if (!file || !/^[a-z0-9-]+\.integration\.test\.ts$/.test(file)) throw new Error("--test-file requires an integration test basename");
    run([require.resolve("prisma/build/index.js"), "generate"], backend);
    run([require.resolve("tsx/cli"), "--test", "--test-concurrency=1", resolve(root, "tests/backend/integration", file)], root);
  } else {
    const npmCli = process.env.npm_execpath ?? resolve(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
    run([npmCli, "run", "test:db", "--workspace", "apps/backend"], root);
  }
}
