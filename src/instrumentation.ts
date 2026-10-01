/**
 * Runs once when the server starts, before it handles a request.
 *
 * With no DATABASE_URL, the app runs its own Postgres (lib/embedded-db.ts) and
 * points DATABASE_URL at it — so everything that reads the database works on a
 * laptop with nothing installed, and the first start seeds the sample members.
 * Development only: a deployed app sets DATABASE_URL to a hosted Postgres.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.DATABASE_URL || process.env.NODE_ENV !== "development") return;

  const { seedEmbeddedDb, startEmbeddedDb } = await import("./lib/embedded-db");
  const db = await startEmbeddedDb();
  process.env.DATABASE_URL = db.url;
  process.env.LITHOS_EMBEDDED_DB = "1";
  console.log(`- Database:      embedded Postgres in .lithos-db/${db.fresh ? " (new — seeding sample members)" : ""}`);
  if (db.fresh) await seedEmbeddedDb(db.url);
}
