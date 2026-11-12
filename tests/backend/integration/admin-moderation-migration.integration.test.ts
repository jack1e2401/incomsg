import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

process.env.JWT_SECRET ??= randomBytes(32).toString("hex");
const { env } = await import("../../../apps/backend/src/config/env.js");
interface SqlConnection { query<T = unknown>(sql: string): Promise<T>; end(): Promise<void> }
const { createConnection } = createRequire(new URL("../../../apps/backend/package.json", import.meta.url))("mariadb") as {
  createConnection(config: { host: string; port: number; user: string; password: string; database: string }): Promise<SqlConnection>;
};

test("Admin migration preserves identities and distinguishes pending/rejected accounts from suspension", async () => {
  assert.ok(env.databaseUrl);
  const url = new URL(env.databaseUrl);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  assert.equal(decodeURIComponent(url.pathname.slice(1)), "incomsg-test");
  const nonce = randomUUID().replaceAll("-", "").slice(0, 12);
  const logicalNames = ["User", "MerchantApplication", "EmailBlacklistEntry", "AdminAuditLog"] as const;
  const tables = Object.fromEntries(logicalNames.map((name) => [name, `TestAdmin${nonce}${name}`])) as Record<typeof logicalNames[number], string>;
  const migration = readFileSync(new URL("../../../apps/backend/prisma/migrations/20261112110000_admin_moderation/migration.sql", import.meta.url), "utf8");
  const statements = logicalNames.reduce((sql, name) => sql.replaceAll(`\`${name}\``, `\`${tables[name]}\``), migration)
    .replace(/^\s*--.*$/gm, "").split(";").map((statement) => statement.trim()).filter(Boolean);
  const sql = await createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: "incomsg-test" });
  try {
    await sql.query(`CREATE TABLE \`${tables.User}\` (id INT PRIMARY KEY, email VARCHAR(191), passwordHash VARCHAR(255), role VARCHAR(20), isActive BOOLEAN)`);
    await sql.query(`CREATE TABLE \`${tables.MerchantApplication}\` (applicantId INT PRIMARY KEY, status VARCHAR(20))`);
    await sql.query(`INSERT INTO \`${tables.User}\` VALUES
      (1, 'active@test.local', 'hash-1', 'MEMBER', 1),
      (2, 'inactive@test.local', 'hash-2', 'MEMBER', 0),
      (3, 'pending@test.local', 'hash-3', 'MERCHANT', 0),
      (4, 'rejected@test.local', 'hash-4', 'MERCHANT', 0),
      (5, 'approved@test.local', 'hash-5', 'MERCHANT', 1),
      (6, 'disabled-approved@test.local', 'hash-6', 'MERCHANT', 0)`);
    await sql.query(`INSERT INTO \`${tables.MerchantApplication}\` VALUES (3, 'PENDING'), (4, 'REJECTED'), (5, 'APPROVED'), (6, 'APPROVED')`);
    for (const statement of statements) await sql.query(statement);
    const rows = await sql.query<{ id: number; email: string; passwordHash: string; accountStatus: string }[]>(`SELECT id, email, passwordHash, accountStatus FROM \`${tables.User}\` ORDER BY id`);
    assert.deepEqual(rows.map((row) => [row.id, row.email, row.passwordHash, row.accountStatus]), [
      [1, "active@test.local", "hash-1", "ACTIVE"],
      [2, "inactive@test.local", "hash-2", "SUSPENDED"],
      [3, "pending@test.local", "hash-3", "PENDING_APPROVAL"],
      [4, "rejected@test.local", "hash-4", "REJECTED"],
      [5, "approved@test.local", "hash-5", "ACTIVE"],
      [6, "disabled-approved@test.local", "hash-6", "SUSPENDED"],
    ]);
  } finally {
    for (const name of [...logicalNames].reverse()) await sql.query(`DROP TABLE IF EXISTS \`${tables[name]}\``);
    await sql.end();
  }
});
