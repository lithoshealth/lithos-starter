import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";

/**
 * The app's own database, with nothing to install: when DATABASE_URL isn't
 * set, the app runs Postgres itself — PGlite, real Postgres compiled to run
 * inside Node — and keeps its data in `.lithos-db/` in this folder. The app
 * talks to it exactly as it would to any Postgres (through a local port), so
 * the same code runs against a hosted database when one is set.
 *
 * Laptops and demos only. A deployed app has no lasting disk and several
 * copies running at once: set DATABASE_URL to a hosted Postgres there.
 *
 * One process opens the data folder; anything else — the seed, the scripts —
 * connects to it through the port in `.lithos-db/server.json` (db/running.mjs).
 */

export const EMBEDDED_DIR = ".lithos-db";

export type EmbeddedDb = { url: string; fresh: boolean; stop: () => Promise<void> };

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer().once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => (typeof address === "object" && address ? resolve(address.port) : reject(new Error("no port"))));
    });
  });
}

/** db/seed.mjs against a database that just started — the sample members. Awaited, so the first page has them. */
export async function seedEmbeddedDb(url: string, root: string = process.cwd()): Promise<void> {
  const { spawn } = await import("node:child_process");
  await new Promise<void>((resolve) => {
    const child = spawn(process.execPath, [path.join(root, "db", "seed.mjs")], { env: { ...process.env, DATABASE_URL: url }, stdio: "inherit" });
    child.on("exit", () => resolve());
    child.on("error", () => resolve());
  });
}

export async function startEmbeddedDb(root: string = process.cwd()): Promise<EmbeddedDb> {
  const dir = path.join(root, EMBEDDED_DIR);
  const dataDir = path.join(dir, "data");
  const fresh = !existsSync(dataDir);
  mkdirSync(dir, { recursive: true });

  const { PGlite } = await import("@electric-sql/pglite");
  const { PGLiteSocketServer } = await import("@electric-sql/pglite-socket");
  const db = await PGlite.create(dataDir);
  // The schema is idempotent (IF NOT EXISTS throughout), so it runs on every
  // start and a pulled schema change lands without a reset.
  await db.exec(readFileSync(path.join(root, "db", "schema.sql"), "utf8"));

  const port = await freePort();
  const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1" });
  await server.start();

  const pointer = path.join(dir, "server.json");
  writeFileSync(pointer, `${JSON.stringify({ port, pid: process.pid })}\n`);
  return {
    url: `postgres://postgres@127.0.0.1:${port}/postgres`,
    fresh,
    stop: async () => {
      await server.stop();
      await db.close();
      rmSync(pointer, { force: true });
    },
  };
}
