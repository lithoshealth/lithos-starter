import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { JourneyIds } from "./steps";

/**
 * Handing the app a prospect saw over to them.
 *
 * After a demo, "Download your app" packs this app as it was customised — the
 * brand, program, intake style and logo live in files — with no credentials.
 * The demo organization's credentials go separately, the way Lithos already
 * sends credentials (1Password). This file records which patient and encounter
 * the walkthrough was following, so when the prospect pastes those credentials
 * the walkthrough picks up where the demo left off.
 *
 * Nothing secret in it: ids, and a hash of the client ID so a copy connected to
 * a different organization ignores it.
 */
export const HANDOFF_FILE = "lithos-handoff.json";

export type Handoff = {
  createdAt: string;
  brandName: string;
  clientIdHash: string;
  journey: Omit<JourneyIds, "program">;
};

export const clientIdHash = (clientId: string) => createHash("sha256").update(clientId).digest("hex");

export async function readHandoff(root = process.cwd()): Promise<Handoff | undefined> {
  try {
    const value = JSON.parse(await readFile(path.join(root, HANDOFF_FILE), "utf8")) as Handoff;
    return typeof value.clientIdHash === "string" && value.journey ? value : undefined;
  } catch {
    return undefined;
  }
}

/** The walkthrough progress a handed-over copy starts from — only when it's connected to the same organization. */
export async function handoffJourney(clientId: string | undefined): Promise<Omit<JourneyIds, "program"> | undefined> {
  if (!clientId) return undefined;
  const handoff = await readHandoff();
  return handoff && handoff.clientIdHash === clientIdHash(clientId) ? handoff.journey : undefined;
}

const NEVER = [/^\.env(?!\.example$)/, /^\.git\//, /^node_modules\//, /^\.next\//, /^\.vercel\//, /\.DS_Store$/, /^next-env\.d\.ts$/];

/**
 * Every file of the app worth handing over: what git tracks plus anything new
 * it doesn't ignore (an uploaded logo), and never credentials or build output.
 * Without git (a copy that was itself unzipped) it walks the folder instead.
 */
export async function appFiles(root = process.cwd()): Promise<string[]> {
  let files: string[];
  try {
    const { stdout } = await promisify(execFile)("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root, maxBuffer: 16 * 1024 * 1024 });
    files = stdout.split("\0").filter(Boolean);
  } catch {
    files = await walk(root, "");
  }
  return [...new Set(files)].filter((f) => f !== HANDOFF_FILE && !NEVER.some((re) => re.test(f))).sort();
}

async function walk(root: string, dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (NEVER.some((re) => re.test(entry.isDirectory() ? `${rel}/` : rel))) continue;
    if (entry.isDirectory()) out.push(...(await walk(root, rel)));
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

export function startHere(brandName: string, date: Date): string {
  const day = date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return `# ${brandName} — your app, built with Lithos

Put together with you on ${day}. It's the Lithos starter, dressed as ${brandName}:
your name, colours, logo, program and intake.

## Open it

You need Node 20 or later.

\`\`\`sh
npm install
npm run dev
\`\`\`

Then open http://localhost:3001/setup.

## Connect it

Step 1 asks for your sandbox credentials. Paste the client ID and secret from the
1Password item we sent you. They're saved to \`.env.local\` on your machine and
never leave it except to talk to Lithos.

Once they're in, you're back where we left off: the same sandbox organization,
the same sample patient, the clinician's decision. Step 5 (webhooks) will ask
for your own public address — the one from our call pointed at our laptop.

The full guide is in README.md.
`;
}
