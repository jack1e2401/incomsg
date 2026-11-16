import { existsSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Provision an isolated worktree environment (.env files, optional node_modules junction on Windows,
 * and optional MySQL test database creation + migration).
 *
 * Usage:
 *   node scripts/setup-worktree-env.mjs --db incomsg_testdb_feat01 --port 3001 --frontend-port 5174 --base-url mysql://USER:PASS@127.0.0.1:3306
 */
function parseArgs(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key?.startsWith("--")) continue;
    const value = argv[i + 1];
    if (value && !value.startsWith("--")) {
      args.set(key.slice(2), value);
      i += 1;
    } else {
      args.set(key.slice(2), "true");
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const worktreeRoot = resolve(args.get("worktree") ?? process.cwd());
const dbName = args.get("db");
const port = Number(args.get("port") ?? "3000");
const frontendPort = Number(args.get("frontend-port") ?? "5173");
const baseUrlRaw = args.get("base-url") ?? process.env.MYSQL_BASE_URL ?? process.env.DATABASE_URL;

if (!dbName || !/^(incomsg-test|incomsg_testdb_[a-z0-9_]+)$/.test(dbName)) {
  console.error("--db must match incomsg-test or incomsg_testdb_<name>");
  process.exit(1);
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("--port must be a valid TCP port");
  process.exit(1);
}
if (!baseUrlRaw) {
  console.error("Provide --base-url mysql://user:pass@127.0.0.1:3306 or set MYSQL_BASE_URL / DATABASE_URL");
  process.exit(1);
}

const baseUrl = new URL(baseUrlRaw);
if (baseUrl.protocol !== "mysql:" || !["localhost", "127.0.0.1", "[::1]"].includes(baseUrl.hostname)) {
  console.error("Refusing non-local MySQL host:", baseUrl.hostname);
  process.exit(1);
}
baseUrl.pathname = `/${dbName}`;
const targetUrl = baseUrl.toString();

const jwtSecret = randomBytes(32).toString("hex");
const backendEnvPath = resolve(worktreeRoot, "apps/backend/.env");
const frontendEnvPath = resolve(worktreeRoot, "apps/frontend/.env");
mkdirSync(dirname(backendEnvPath), { recursive: true });
mkdirSync(dirname(frontendEnvPath), { recursive: true });

writeFileSync(
  backendEnvPath,
  [
    `PORT=${port}`,
    `FRONTEND_ORIGIN=http://localhost:${frontendPort}`,
    `DATABASE_URL=${targetUrl}`,
    `TEST_DATABASE_URL=${targetUrl}`,
    `JWT_SECRET=${jwtSecret}`,
    `PAYMENT_MODE=mock`,
    "",
  ].join("\n"),
  "utf8",
);

writeFileSync(
  frontendEnvPath,
  [
    `VITE_API_BASE_URL=http://localhost:${port}`,
    `VITE_API_MODE=backend`,
    "",
  ].join("\n"),
  "utf8",
);

console.log(`Wrote untracked .env files in ${worktreeRoot} targeting ${dbName} (BE:${port}, FE:${frontendPort})`);

const mainNodeModules = resolve(process.cwd(), "node_modules");
const targetNodeModules = resolve(worktreeRoot, "node_modules");
if (worktreeRoot !== process.cwd() && existsSync(mainNodeModules) && !existsSync(targetNodeModules)) {
  symlinkSync(mainNodeModules, targetNodeModules, "junction");
  console.log(`Linked node_modules junction at ${targetNodeModules}`);
}

if (args.get("create-db") === "true") {
  const mysqlExe = "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe";
  const mysqlCmd = existsSync(mysqlExe) ? mysqlExe : "mysql";
  const env = { ...process.env };
  if (baseUrl.password) env.MYSQL_PWD = decodeURIComponent(baseUrl.password);
  const res = spawnSync(
    mysqlCmd,
    [
      "-h",
      baseUrl.hostname,
      "-P",
      baseUrl.port || "3306",
      "-u",
      decodeURIComponent(baseUrl.username || "root"),
      "-e",
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
    ],
    { env, stdio: "inherit" },
  );
  if (res.status !== 0) {
    console.error("Failed to create database", dbName);
    process.exit(res.status ?? 1);
  }
  console.log(`Ensured MySQL database ${dbName}`);
}
