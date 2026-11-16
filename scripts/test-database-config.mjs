const ALLOWED_TEST_DB = /^(incomsg-test|incomsg_testdb_[a-z0-9_]+)$/;

/** Resolve DB QA configuration before spawning any process that could write data. */
export function testDatabaseUrl(environment) {
  const source = environment.TEST_DATABASE_URL ?? environment.DATABASE_URL;
  if (!source) throw new Error("DATABASE_URL or TEST_DATABASE_URL is required for DB QA");
  const url = new URL(source);
  if (url.protocol !== "mysql:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("DB tests require a local MySQL server");
  }
  if (!environment.TEST_DATABASE_URL) url.pathname = "/incomsg-test";
  const dbName = decodeURIComponent(url.pathname.slice(1));
  if (!ALLOWED_TEST_DB.test(dbName)) {
    throw new Error("DB tests must target incomsg-test or incomsg_testdb_*; application databases are forbidden");
  }
  return url.toString();
}
