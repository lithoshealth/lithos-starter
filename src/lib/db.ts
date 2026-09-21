import postgres from "postgres";

// One pool per process. Next.js dev reloads modules on edit, so without the
// global the pool is recreated on every change until Postgres refuses
// connections.
const globalForDb = globalThis as typeof globalThis & {
  __eucardiaDb?: postgres.Sql;
};

export function getDb(): postgres.Sql {
  if (!globalForDb.__eucardiaDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Missing required server environment variable: DATABASE_URL");
    globalForDb.__eucardiaDb = postgres(url, {
      // Serverless: keep the footprint small and don't hold connections open.
      max: process.env.VERCEL === "1" ? 1 : 5,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  return globalForDb.__eucardiaDb;
}

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Eucardia's own member identifier — and the `external_id` Lithos stores for us. */
export function newMemberId(): string {
  return `eu_mem_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}
