/**
 * What a setup action hands back to its form. Client-safe (no server imports):
 * the step forms are client components.
 */

import type { ApiError } from "../lithos/types";

export type SetupActionState =
  | { status: "idle" }
  | { status: "ok" }
  /**
   * The signing secret — returned exactly once by Lithos. In development it's
   * also saved to .env.local (`saved`); otherwise it's shown once, stored nowhere.
   */
  | { status: "secret"; endpointId: string; url: string; signingSecret: string; saved: boolean }
  /**
   * Credentials accepted and saved to .env.local; the page tells the reader what
   * happens next. `issued` is set when they were just created by sandbox
   * signup: what was made, with the credentials masked on the server — the
   * full values never leave it.
   */
  | { status: "connected"; treatments: number; issued?: IssuedCredentials }
  | { status: "error"; httpStatus?: number; errors: ApiError[]; hint?: string };

export type IssuedCredentials = {
  organizationName: string;
  organizationId: string;
  clientIdMasked: string;
  clientSecretMasked: string;
};

/** Enough of a credential to recognise it, never enough to use it. */
export function maskCredential(value: string, { head, tail }: { head: number; tail: number }): string {
  if (value.length <= head + tail) return "•".repeat(Math.max(value.length, 8));
  return `${value.slice(0, head)}${"•".repeat(12)}${value.slice(-tail)}`;
}

export const INITIAL_SETUP_ACTION_STATE: SetupActionState = { status: "idle" };
