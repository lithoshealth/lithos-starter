import { readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

/**
 * Brings a Postgres you run yourself (DATABASE_URL) up to db/schema.sql. The
 * schema is idempotent (IF NOT EXISTS throughout), so running it on every
 * start is safe, and a pulled schema change lands without a reset or a manual
 * `npm run db:seed`, the same way the embedded database already works.
 */
export async function applySchema(url: string, root: string = process.cwd()): Promise<void> {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe(readFileSync(path.join(root, "db", "schema.sql"), "utf8"));
  } finally {
    await sql.end();
  }
}
