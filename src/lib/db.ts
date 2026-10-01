import postgres from "postgres";

// One pool per process. Next.js dev reloads modules on edit, so without the
// global the pool is recreated on every change until Postgres refuses
// connections.
const globalForDb = globalThis as typeof globalThis & {
  __eucardiaDb?: postgres.Sql;
  __embeddedDbUrl?: string;
};

/**
 * Where the app's database is: DATABASE_URL, or the embedded one this process
 * started (src/instrumentation.ts → lib/embedded-db.ts). The embedded address
 * is held here as well as in process.env because Next resets process.env to
 * how it started whenever .env.local changes — and step 1 of /setup always
 * changes it.
 */
export function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || globalForDb.__embeddedDbUrl;
}

/** Called once, by the server's startup, when it runs the embedded database. */
export function setEmbeddedDbUrl(url: string): void {
  globalForDb.__embeddedDbUrl = url;
}

export function getDb(): postgres.Sql {
  if (!globalForDb.__eucardiaDb) {
    const url = databaseUrl();
    if (!url) throw new Error("Missing required server environment variable: DATABASE_URL");
    const embedded = !process.env.DATABASE_URL || url === globalForDb.__embeddedDbUrl;
    globalForDb.__eucardiaDb = postgres(url, {
      // Serverless: keep the footprint small and don't hold connections open.
      // The embedded database (lib/embedded-db.ts) runs one query at a time.
      max: process.env.VERCEL === "1" || embedded ? 1 : 5,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  return globalForDb.__eucardiaDb;
}

export function isDbConfigured(): boolean {
  return Boolean(databaseUrl());
}

/** Eucardia's own member identifier — and the `external_id` Lithos stores for us. */
export function newMemberId(): string {
  return `eu_mem_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}
