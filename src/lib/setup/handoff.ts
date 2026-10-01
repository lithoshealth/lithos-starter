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
 * The prospect gets their own in step 1, with the email this file carries. Or,
 * to pick up exactly where the demo left off, they paste the demo
 * organization's credentials, sent separately (1Password): this file records
 * which patient and encounter the walkthrough was following.
 *
 * Nothing secret in it: the prospect's own email, ids, and a hash of the client
 * ID so a copy connected to a different organization ignores the journey.
 */
export const HANDOFF_FILE = "lithos-handoff.json";
export const START_HERE_FILE = "START-HERE.md";

export type Handoff = {
  createdAt: string;
  brandName: string;
  /** The email the demo signed up with — step 1 starts from it. */
  email?: string;
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

/** The zip's name and its top folder: `acme-health` for "Acme Health". */
export const appFolder = (brandName: string) =>
  brandName.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "lithos-app";

const NEVER = [/^\.env(?!\.example$)/, /^\.git\//, /^\.lithos-db\//, /^node_modules\//, /^\.next\//, /^\.vercel\//, /\.DS_Store$/, /^next-env\.d\.ts$/];

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
  // The download writes these two fresh; a copy that was itself unzipped has old ones.
  return [...new Set(files)].filter((f) => f !== HANDOFF_FILE && f !== START_HERE_FILE && !NEVER.some((re) => re.test(f))).sort();
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

In step 1, click **Get sandbox credentials**. That gives you your own Lithos
sandbox organization, and saves its credentials to \`.env.local\` on your
machine — they never leave it except to talk to Lithos. Your brand, program and
intake are already set; run a sample patient through steps 3 and 4 to see a
clinician's decision come back.

If we sent you credentials in 1Password, paste them into step 1 instead: you'll
be back where we left off, with the same sample patient and decision.

Step 5 (webhooks) asks for a public address for your app — a tunnel or a
deploy. It's optional.

The full guide is in README.md.
`;
}
