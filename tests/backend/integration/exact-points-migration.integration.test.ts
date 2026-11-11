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
const migration = readFileSync(new URL("../../../apps/backend/prisma/migrations/20261111100000_exact_loyalty_points/migration.sql", import.meta.url), "utf8");
const logicalTables = ["LoyaltyExactPreflight", "LoyaltyWallet", "PointTransaction", "Order", "PaymentAttempt"] as const;

async function withLegacyTables(run: (sql: SqlConnection, tables: Record<typeof logicalTables[number], string>, statements: string[]) => Promise<void>, scenario: "valid" | "bad-wallet" | "missing-earn" = "valid") {
  assert.ok(env.databaseUrl, "The isolated integration-test database is required");
  const url = new URL(env.databaseUrl);
  const database = decodeURIComponent(url.pathname.slice(1));
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname), "Migration fixtures require a local test database");
  assert.match(database, /[-_]test$/i, "Migration fixtures require a database ending in -test or _test");
  const nonce = randomUUID().replaceAll("-", "").slice(0, 12);
  const tables = Object.fromEntries(logicalTables.map((name) => [name, `TestExact${nonce}${name}`])) as Record<typeof logicalTables[number], string>;
  const statements = logicalTables.reduce((text, name) => text.replaceAll(`\`${name}\``, `\`${tables[name]}\``), migration)
    .replace(/^\s*--.*$/gm, "").split(";").map((text) => text.trim()).filter(Boolean);
  // A dedicated connection preserves the migration's temporary preflight table.
  // Real uniquely named fixture tables exercise unchanged ALTER/guard SQL and
  // avoid both temporary-table reopen limits and DDL implicit transaction commits.
  const sql = await createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database });
  const created: string[] = [];
  const create = async (name: typeof logicalTables[number], columns: string) => {
    await sql.query(`CREATE TABLE \`${tables[name]}\` ${columns}`);
    created.push(tables[name]);
  };
  try {
    await create("LoyaltyWallet", "(id INTEGER PRIMARY KEY, availablePoints INTEGER NOT NULL DEFAULT 0, lifetimeEarnedPoints INTEGER NOT NULL DEFAULT 0, reservedPoints INTEGER NOT NULL DEFAULT 0)");
    await create("PointTransaction", "(id INTEGER PRIMARY KEY, walletId INTEGER NOT NULL, type VARCHAR(32) NOT NULL, delta INTEGER NOT NULL, balanceAfter INTEGER NOT NULL, orderId INTEGER NULL)");
    await create("Order", "(id INTEGER PRIMARY KEY, status VARCHAR(20) NOT NULL)");
    await create("PaymentAttempt", "(id INTEGER PRIMARY KEY, orderId INTEGER NOT NULL, reservedPoints INTEGER NOT NULL DEFAULT 0)");
    await sql.query(`INSERT INTO \`${tables.LoyaltyWallet}\` VALUES (1, 7, 10, 4), (2, 0, 0, 0)`);
    await sql.query(`INSERT INTO \`${tables.PointTransaction}\` VALUES (1, 1, 'EARN', 10, 10, 1), (2, 1, 'REDEEM_DISCOUNT', -3, 7, NULL)`);
    await sql.query(`INSERT INTO \`${tables.Order}\` VALUES (1, 'PAID'), (2, 'PENDING')`);
    await sql.query(`INSERT INTO \`${tables.PaymentAttempt}\` VALUES (1, 2, 4)`);
    if (scenario === "bad-wallet") await sql.query(`UPDATE \`${tables.LoyaltyWallet}\` SET availablePoints = 8 WHERE id = 1`);
    if (scenario === "missing-earn") await sql.query(`INSERT INTO \`${tables.Order}\` VALUES (3, 'PAID')`);
    await run(sql, tables, statements);
  } finally {
    try {
      await sql.query(`DROP TEMPORARY TABLE IF EXISTS \`${tables.LoyaltyExactPreflight}\``);
      for (const name of created.reverse()) await sql.query(`DROP TABLE IF EXISTS \`${name}\``);
    } finally {
      await sql.end();
    }
  }
}

test("exact-points SQL migration preserves integer balances, redemption, reserves and historical order earning", async () => {
  await withLegacyTables(async (sql, tables, statements) => {
    for (const statement of statements) await sql.query(statement);
    const wallets = await sql.query<{ exactBalance: string; netLifetimeEarned: string; reservedPoints: string }[]>(`SELECT exactBalance, netLifetimeEarned, reservedPoints FROM \`${tables.LoyaltyWallet}\` ORDER BY id`);
    assert.deepEqual(wallets.map((item) => [item.exactBalance, item.netLifetimeEarned, item.reservedPoints]), [["7.000000000000", "10.000000000000", "4.000000000000"], ["0.000000000000", "0.000000000000", "0.000000000000"]]);
    const ledger = await sql.query<{ delta: string; balanceAfter: string }[]>(`SELECT delta, balanceAfter FROM \`${tables.PointTransaction}\` ORDER BY id`);
    assert.deepEqual(ledger.map((entry) => [entry.delta, entry.balanceAfter]), [["10.000000000000", "10.000000000000"], ["-3.000000000000", "7.000000000000"]]);
    const orders = await sql.query<{ earnedPointsExact: string | null; source: string | null }[]>(`SELECT earnedPointsExact, JSON_UNQUOTE(JSON_EXTRACT(loyaltySnapshot, '$.source')) AS source FROM \`${tables.Order}\` ORDER BY id`);
    assert.equal(orders[0]?.earnedPointsExact, "10.000000000000");
    assert.equal(orders[0]?.source, "LEGACY_INTEGER_LEDGER");
    assert.equal(orders[1]?.earnedPointsExact, null);
    assert.equal(orders[1]?.source, null);
    const [attempt] = await sql.query<{ reservedPoints: string; snapshotTierLevel: string | null; snapshotMultiplier: string | null; snapshotPolicy: unknown }[]>(`SELECT reservedPoints, snapshotTierLevel, snapshotMultiplier, snapshotPolicy FROM \`${tables.PaymentAttempt}\``);
    assert.equal(attempt?.reservedPoints, "4.000000000000");
    assert.equal(attempt?.snapshotTierLevel, null);
    assert.equal(attempt?.snapshotMultiplier, null);
    assert.equal(attempt?.snapshotPolicy, null);
    await sql.query(`UPDATE \`${tables.LoyaltyWallet}\` SET exactBalance = exactBalance + 0.123456789012 WHERE id = 1`);
    const [fractional] = await sql.query<{ exactBalance: string }[]>(`SELECT exactBalance FROM \`${tables.LoyaltyWallet}\` WHERE id = 1`);
    assert.equal(fractional?.exactBalance, "7.123456789012");
  });
});

for (const scenario of ["bad-wallet", "missing-earn"] as const) {
  test(`exact-points migration stops before changing columns for ${scenario}`, async () => {
    await withLegacyTables(async (sql, tables, statements) => {
      const preflight = statements.slice(0, statements.findIndex((statement) => statement.startsWith("ALTER TABLE")));
      await assert.rejects(async () => {
        for (const statement of preflight) await sql.query(statement);
      }, /cannot be null|not null/i);
      const [legacy] = await sql.query<{ availablePoints: number; lifetimeEarnedPoints: number }[]>(`SELECT availablePoints, lifetimeEarnedPoints FROM \`${tables.LoyaltyWallet}\` WHERE id = 1`);
      assert.equal(legacy?.availablePoints, scenario === "bad-wallet" ? 8 : 7);
      assert.equal(legacy?.lifetimeEarnedPoints, 10);
      const [entry] = await sql.query<{ delta: number; balanceAfter: number }[]>(`SELECT delta, balanceAfter FROM \`${tables.PointTransaction}\` WHERE id = 2`);
      assert.equal(entry?.delta, -3);
      assert.equal(entry?.balanceAfter, 7);
    }, scenario);
  });
}
