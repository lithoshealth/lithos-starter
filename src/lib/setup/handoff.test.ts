import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { HANDOFF_FILE, START_HERE_FILE, appFiles, clientIdHash, readHandoff } from "./handoff";

async function folder(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "handoff-"));
  for (const [name, text] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await writeFile(path.join(root, name), text);
  }
  return root;
}

describe("appFiles", () => {
  it("never hands over credentials, the database, dependencies, build output, or the last download's notes", async () => {
    const root = await folder({
      "package.json": "{}",
      "starter.config.json": "{}",
      "public/brand/logo.png": "png",
      ".env.local": "LITHOS_CLIENT_SECRET=secret",
      ".env": "X=1",
      ".env.example": "LITHOS_CLIENT_ID=",
      "node_modules/next/index.js": "",
      ".next/build.js": "",
      ".lithos-db/data/base/1/1259": "the demo's database",
      [HANDOFF_FILE]: "{}",
      [START_HERE_FILE]: "# the last download's",
    });
    // A folder without git: the walk, not git ls-files.
    expect(await appFiles(root)).toEqual([".env.example", "package.json", "public/brand/logo.png", "starter.config.json"]);
  });
});

describe("readHandoff", () => {
  it("reads the handoff the download wrote, matched by client ID hash", async () => {
    const root = await folder({
      [HANDOFF_FILE]: JSON.stringify({ createdAt: "2026-09-29T16:00:00Z", brandName: "GenMeds", clientIdHash: clientIdHash("client_01ABC"), journey: { encounterId: "enc_test_1" } }),
    });
    const handoff = await readHandoff(root);
    expect(handoff?.journey.encounterId).toBe("enc_test_1");
    expect(handoff?.clientIdHash).toBe(clientIdHash("client_01ABC"));
    expect(handoff?.clientIdHash).not.toBe(clientIdHash("client_01OTHER"));
  });

  it("is absent in a copy that wasn't handed over", async () => {
    expect(await readHandoff(await folder({ "package.json": "{}" }))).toBeUndefined();
  });
});
