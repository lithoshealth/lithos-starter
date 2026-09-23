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
  /** Credentials accepted and saved to .env.local; the page tells the reader what happens next. */
  | { status: "connected"; treatments: number }
  | { status: "error"; httpStatus?: number; errors: ApiError[]; hint?: string };

export const INITIAL_SETUP_ACTION_STATE: SetupActionState = { status: "idle" };
