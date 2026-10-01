// Where a script finds the app's database: DATABASE_URL when it's set, else the
// embedded database the running app started (src/lib/embedded-db.ts), through
// the port it wrote to .lithos-db/server.json. A script never opens the data
// folder itself — one process at a time keeps it intact.
import { readFileSync } from "node:fs";
import path from "node:path";

export function databaseUrl(root = process.cwd()) {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const { port, pid } = JSON.parse(readFileSync(path.join(root, ".lithos-db", "server.json"), "utf8"));
    process.kill(pid, 0); // throws if the app that wrote it has gone
    return `postgres://postgres@127.0.0.1:${port}/postgres`;
  } catch {
    return null;
  }
}

/** The URL, or a message saying how to get one — and exit. */
export function requireDatabaseUrl(root = process.cwd()) {
  const url = databaseUrl(root);
  if (url) return url;
  console.error("No database. Start the app (npm run dev) — it runs its own database — or set DATABASE_URL to a Postgres.");
  process.exit(1);
}
