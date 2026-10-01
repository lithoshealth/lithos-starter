import { cookies } from "next/headers";
import { connectedOutsideSandbox } from "@/lib/lithos/sandbox";

/**
 * The portal's demo sign-in: which sample patient this browser is "signed in"
 * as. Lithos has no patient accounts, by design — the partner owns the login.
 * A real app keeps its own users and maps each to a Lithos patient id; this
 * cookie stands in for that, so the portal needs no database.
 *
 * Stamped with the client id it was made under, like the walkthrough's cookie:
 * several copies of the app share localhost, and a patient from another
 * organization would only 404.
 *
 * Sandbox only. Anyone can pick any patient here, which is fine for fake
 * patients and a data leak for real ones — so connected anywhere else, the
 * demo sign-in is off and this returns nobody. Replace this file with your own
 * login: read your signed-in user, return their Lithos patient id.
 */
export const demoSignInEnabled = () => !connectedOutsideSandbox();

const COOKIE = "portal_patient";
type Stored = { patientId: string; clientId?: string };

export async function readPortalPatientId(): Promise<string | undefined> {
  if (!demoSignInEnabled()) return undefined;
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return undefined;
  try {
    const { patientId, clientId } = JSON.parse(raw) as Stored;
    return clientId && clientId === process.env.LITHOS_CLIENT_ID ? patientId : undefined;
  } catch {
    return undefined;
  }
}

export async function signInAs(patientId: string): Promise<void> {
  if (!demoSignInEnabled()) throw new Error("The demo sign-in only works against the Lithos sandbox.");
  const stored: Stored = { patientId, clientId: process.env.LITHOS_CLIENT_ID };
  (await cookies()).set(COOKIE, JSON.stringify(stored), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function signOut(): Promise<void> {
  (await cookies()).delete({ name: COOKIE, path: "/" });
}
