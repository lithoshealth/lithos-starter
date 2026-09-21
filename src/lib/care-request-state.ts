/**
 * State for the member-facing care request. Separate from the libraries that
 * talk to Postgres and Lithos, because the form is a client component.
 */

import type { ApiError } from "./lithos/types";

export type CareRequestState =
  | { status: "idle" }
  /** Hard stops the partner applies itself. No encounter was created. */
  | { status: "blocked"; reasons: string[] }
  | { status: "error"; httpStatus?: number; errors: ApiError[] };

export const INITIAL_CARE_REQUEST_STATE: CareRequestState = { status: "idle" };
