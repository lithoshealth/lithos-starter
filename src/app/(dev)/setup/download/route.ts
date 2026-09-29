import { readFile } from "node:fs/promises";
import path from "node:path";
import { readConfig } from "@/lib/starter-config";
import { readJourneyIds } from "@/lib/setup/journey-cookie";
import { HANDOFF_FILE, START_HERE_FILE, appFiles, appFolder, clientIdHash, startHere, type Handoff } from "@/lib/setup/handoff";
import { zip, type ZipEntry } from "@/lib/setup/zip";

export const dynamic = "force-dynamic";

/**
 * "Download your app": this app as it was customised, zipped, without
 * credentials. Development only — it reads the working folder. Whoever opens it
 * gets their own credentials in step 1 (see lib/setup/handoff.ts).
 */
export async function GET(): Promise<Response> {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Download works from a local copy of the app (npm run dev).", { status: 404 });
  }

  const root = process.cwd();
  const { brand } = await readConfig();
  const folder = appFolder(brand.name);
  const now = new Date();

  const entries: ZipEntry[] = await Promise.all(
    (await appFiles(root)).map(async (file) => ({ path: `${folder}/${file}`, data: await readFile(path.join(root, file)) })),
  );

  // Where the walkthrough was, for the same organization only (see lib/setup/handoff.ts).
  const clientId = process.env.LITHOS_CLIENT_ID;
  if (clientId) {
    const { program: _program, ...journey } = await readJourneyIds();
    const handoff: Handoff = {
      createdAt: now.toISOString(), brandName: brand.name, email: process.env.LITHOS_SIGNUP_EMAIL || undefined,
      clientIdHash: clientIdHash(clientId), journey,
    };
    entries.push({ path: `${folder}/${HANDOFF_FILE}`, data: Buffer.from(JSON.stringify(handoff, null, 2) + "\n") });
  }
  entries.push({ path: `${folder}/${START_HERE_FILE}`, data: Buffer.from(startHere(brand.name, now)) });

  return new Response(new Uint8Array(zip(entries, now)), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${folder}.zip"`,
      "cache-control": "no-store",
    },
  });
}
