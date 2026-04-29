import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const DEFAULT_TEST_DB_URL = "postgres://fc:fc@localhost:5433/fc_test";

function adminUrlFor(testDbUrl: string): { adminUrl: string; dbName: string } {
  const url = new URL(testDbUrl);
  const dbName = url.pathname.replace(/^\//, "");
  url.pathname = "/postgres";
  return { adminUrl: url.toString(), dbName };
}

export async function setup() {
  const testDbUrl = process.env.DATABASE_URL ?? DEFAULT_TEST_DB_URL;
  if (!/_test\b/.test(testDbUrl)) {
    throw new Error(
      `refusing to run tests against a database that doesn't end in _test: ${testDbUrl}`,
    );
  }

  const { adminUrl, dbName } = adminUrlFor(testDbUrl);
  const admin = postgres(adminUrl, { max: 1 });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  await admin.unsafe(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  const sql = postgres(testDbUrl, { max: 1 });
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: "./drizzle" });
  await sql.end();
}
