import { cookies } from "next/headers";
import type { IssuedCredentials } from "./action-state";

/**
 * What sandbox signup just created, masked, kept for a few minutes so step 1
 * can show it. Writing .env.local makes the dev server reload the page, which
 * throws away anything the form was showing; a cookie survives that. Holds only
 * the masked values — nothing in it can be used to call Lithos.
 */
const COOKIE = "setup_issued";
const MINUTES = 15;

export async function rememberIssued(issued: IssuedCredentials): Promise<void> {
  (await cookies()).set(COOKIE, JSON.stringify(issued), {
    httpOnly: true, sameSite: "lax", path: "/setup", maxAge: MINUTES * 60,
  });
}

export async function readIssued(): Promise<IssuedCredentials | undefined> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return undefined;
  try {
    const value = JSON.parse(raw) as IssuedCredentials;
    return typeof value.organizationName === "string" && typeof value.clientSecretMasked === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}
