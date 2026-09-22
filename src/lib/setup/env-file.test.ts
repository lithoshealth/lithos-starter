import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveToEnvLocal } from "./env-file";

let dir: string;
const cwd = process.cwd();

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "env-file-"));
  process.chdir(dir);
});
afterEach(async () => {
  process.chdir(cwd);
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

describe("saveToEnvLocal", () => {
  it("replaces its own line and leaves the rest of the file alone", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await writeFile(".env.local", "# comment\nLITHOS_CLIENT_ID=client_x\nLITHOS_WEBHOOK_SECRET=\nOTHER=1\n");
    expect(await saveToEnvLocal("LITHOS_WEBHOOK_SECRET", "whsec_new")).toBe(true);
    expect(await readFile(".env.local", "utf8")).toBe("# comment\nLITHOS_CLIENT_ID=client_x\nLITHOS_WEBHOOK_SECRET=whsec_new\nOTHER=1\n");
    expect((await stat(".env.local")).mode & 0o777).toBe(0o600);
  });

  it("appends the line when it isn't there, and creates the file when that isn't either", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(await saveToEnvLocal("LITHOS_WEBHOOK_SECRET", "whsec_a")).toBe(true);
    expect(await readFile(".env.local", "utf8")).toBe("LITHOS_WEBHOOK_SECRET=whsec_a\n");
  });

  it("refuses outside development — a deployed copy has no file to write", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await saveToEnvLocal("LITHOS_WEBHOOK_SECRET", "whsec_a")).toBe(false);
  });
});
