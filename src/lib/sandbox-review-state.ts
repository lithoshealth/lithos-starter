/** State for the sandbox "play the clinician" control. Client-safe: no server imports. */

import type { ApiError } from "./lithos/types";

export type ClinicianState =
  | { status: "idle" }
  | { status: "ok"; chose?: string }
  | { status: "error"; httpStatus?: number; errors: ApiError[] };

export const INITIAL_CLINICIAN_STATE: ClinicianState = { status: "idle" };
