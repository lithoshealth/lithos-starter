import { cookies } from "next/headers";
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

export async function readJourneyIds(): Promise<JourneyIds> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return {};
  try {
    const { clientId, ...ids } = JSON.parse(raw) as Stored;
    return clientId && clientId === process.env.LITHOS_CLIENT_ID ? ids : {};
  } catch {
    return {};
  }
}

export async function writeJourneyIds(ids: JourneyIds): Promise<void> {
  const stored: Stored = { ...ids, clientId: process.env.LITHOS_CLIENT_ID };
  (await cookies()).set(COOKIE, JSON.stringify(stored), {
    httpOnly: true, sameSite: "lax", path: "/setup", maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearJourneyIds(): Promise<void> {
  (await cookies()).delete({ name: COOKIE, path: "/setup" });
}
