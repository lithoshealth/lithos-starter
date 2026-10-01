import { cpSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { databaseUrl } from "../../db/running.mjs";
import { startEmbeddedDb } from "./embedded-db";

const root = mkdtempSync(path.join(tmpdir(), "embedded-db-"));
cpSync(path.join(process.cwd(), "db", "schema.sql"), path.join(root, "db", "schema.sql"), { recursive: true });
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("the embedded database", () => {
  it("runs the real schema and the app's queries, keeps its data across a restart, and tells scripts where it is", async () => {
    const first = await startEmbeddedDb(root);
    expect(first.fresh).toBe(true);
    expect(databaseUrl(root)).toBe(first.url);

    const sql = postgres(first.url, { max: 1, onnotice: () => {} });
    const member = { id: "eu_mem_test", email: "sample.test@example.com", first_name: "Sample", last_name: "Test", date_of_birth: "1980-01-01", sex: "female", plan: "essential" };
    await sql`INSERT INTO members ${sql(member)} ON CONFLICT (id) DO UPDATE SET ${sql(member, "first_name")}`;
    await sql.end();
    await first.stop();
    expect(databaseUrl(root)).toBeNull();

    const second = await startEmbeddedDb(root);
    expect(second.fresh).toBe(false);
    const again = postgres(second.url, { max: 1, onnotice: () => {} });
    expect(await again`SELECT first_name FROM members WHERE id = 'eu_mem_test'`).toEqual([{ first_name: "Sample" }]);
    await again.end();
    await second.stop();
  }, 30_000);
});

describe("databaseUrl", () => {
  it("prefers DATABASE_URL, and ignores a pointer left by an app that's gone", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "running-"));
    mkdirSync(path.join(dir, ".lithos-db"));
    writeFileSync(path.join(dir, ".lithos-db", "server.json"), JSON.stringify({ port: 5999, pid: 999_999_999 }));
    expect(databaseUrl(dir)).toBeNull();
    process.env.DATABASE_URL = "postgres://hosted.example/db";
    try {
      expect(databaseUrl(dir)).toBe("postgres://hosted.example/db");
    } finally {
      delete process.env.DATABASE_URL;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
