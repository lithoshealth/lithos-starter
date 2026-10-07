/**
 * Runs once when the server starts, before it handles a request.
 *
 * With no DATABASE_URL, the app runs its own Postgres (lib/embedded-db.ts) and
 * points DATABASE_URL at it — so everything that reads the database works on a
 * laptop with nothing installed, and the first start seeds the sample members.
 * With a DATABASE_URL of your own, it brings that database up to db/schema.sql
 * (lib/apply-schema.ts), so an update that changes the schema just works.
 * Development only: a deployed app's database is yours to migrate.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "development") return;

  if (process.env.DATABASE_URL) {
    const { applySchema } = await import("./lib/apply-schema");
    try {
      await applySchema(process.env.DATABASE_URL);
      console.log("- Database:      your DATABASE_URL, schema up to date");
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`- Database:      couldn't apply db/schema.sql to your DATABASE_URL (${reason})`);
    }
    return;
  }

  const { seedEmbeddedDb, startEmbeddedDb } = await import("./lib/embedded-db");
  const { setEmbeddedDbUrl } = await import("./lib/db");
  const db = await startEmbeddedDb();
  // Held in memory (lib/db.ts), since Next resets process.env when .env.local changes.
  setEmbeddedDbUrl(db.url);
  console.log(`- Database:      embedded Postgres in .lithos-db/${db.fresh ? " (new — seeding sample members)" : ""}`);
  if (db.fresh) await seedEmbeddedDb(db.url);
}
