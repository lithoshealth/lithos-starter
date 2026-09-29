import { cookies } from "next/headers";
import { readConfig } from "../starter-config";
import { handoffJourney } from "./handoff";
import type { JourneyIds } from "./steps";

/**
 * The walkthrough's progress: the patient, care plan and encounter it created.
 *
 * Stamped with the client id it was made under. A browser keeps this cookie per
 * host, not per organization, so without the stamp a developer who switches
 * `.env.local` to another sandbox org would inherit the first org's patient —
 * and the checklist would show steps done that this org never did. A mismatch
 * reads as no progress at all.
 */

const COOKIE = "setup_journey";
type Stored = JourneyIds & { clientId?: string };

/**
 * The program isn't progress — it's a choice about the company, so it lives in
 * starter.config.json where the whole site can read it. It's merged in here so
 * the step engine sees one set of ids.
 */
export async function readJourneyIds(): Promise<JourneyIds> {
  const { program } = await readConfig();
  const raw = (await cookies()).get(COOKIE)?.value;
  if (raw) {
    try {
      const { clientId, program: _legacy, ...ids } = JSON.parse(raw) as Stored;
      if (clientId && clientId === process.env.LITHOS_CLIENT_ID) return { ...ids, program };
    } catch {
      /* unreadable — fall through */
    }
  }
  // A copy handed over after a demo starts where the demo left off, once it's
  // connected to the same organization (lib/setup/handoff.ts).
  const handedOver = await handoffJourney(process.env.LITHOS_CLIENT_ID);
  return handedOver ? { ...handedOver, program } : { program };
}

export async function writeJourneyIds(ids: JourneyIds): Promise<void> {
  const { program: _config, ...progress } = ids;
  const stored: Stored = { ...progress, clientId: process.env.LITHOS_CLIENT_ID };
  (await cookies()).set(COOKIE, JSON.stringify(stored), {
    httpOnly: true, sameSite: "lax", path: "/setup", maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearJourneyIds(): Promise<void> {
  (await cookies()).delete({ name: COOKIE, path: "/setup" });
}
