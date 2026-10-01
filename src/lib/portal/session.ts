import { cookies } from "next/headers";
import { connectedOutsideSandbox } from "@/lib/lithos/sandbox";

/**
 * The portal's demo sign-in: who this browser is "signed in" as. Lithos has no
 * patient accounts, by design — the partner owns the login. A real app keeps
 * its own users; here that's the member (your own record, lib/members.ts), and
 * their Lithos patient is the link on that record. Without a database (a
 * deployed copy that never set one) it falls back to a Lithos patient id.
 *
 * Stamped with the client id it was made under, like the walkthrough's cookie:
 * several copies of the app share localhost, and someone from another
 * organization would only 404.
 *
 * Sandbox only. Anyone can pick anyone here, which is fine for sample people
 * and a data leak for real ones — so connected anywhere else, the demo sign-in
 * is off and this returns nobody. Replace this file with your own login: read
 * your signed-in user, return their member id.
 */
export const demoSignInEnabled = () => !connectedOutsideSandbox();

const COOKIE = "portal_patient";

export type PortalIdentity = { memberId: string } | { patientId: string };
type Stored = { memberId?: string; patientId?: string; clientId?: string };

export async function readPortalIdentity(): Promise<PortalIdentity | undefined> {
  if (!demoSignInEnabled()) return undefined;
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return undefined;
  try {
    const { memberId, patientId, clientId } = JSON.parse(raw) as Stored;
    if (!clientId || clientId !== process.env.LITHOS_CLIENT_ID) return undefined;
    if (memberId) return { memberId };
    if (patientId) return { patientId };
  } catch {
    /* unreadable — nobody */
  }
  return undefined;
}

export async function signInAs(identity: PortalIdentity): Promise<void> {
  if (!demoSignInEnabled()) throw new Error("The demo sign-in only works against the Lithos sandbox.");
  const stored: Stored = { ...identity, clientId: process.env.LITHOS_CLIENT_ID };
  (await cookies()).set(COOKIE, JSON.stringify(stored), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function signOut(): Promise<void> {
  (await cookies()).delete({ name: COOKIE, path: "/" });
}
