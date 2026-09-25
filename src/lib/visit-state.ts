import type { ApiError, SlotReservation } from "@/lib/lithos/types";

export type ActionError = { status: "error"; httpStatus?: number; errors: ApiError[] };

/** One Idempotency-Key per hold, so retrying the same booking can't book twice. */
export type HoldState = { status: "idle" } | { status: "held"; reservation: SlotReservation; idempotencyKey: string } | ActionError;

export type VisitActionState = { status: "idle" } | { status: "ok"; message?: string } | ActionError;

export const IDLE_HOLD: HoldState = { status: "idle" };
export const IDLE_ACTION: VisitActionState = { status: "idle" };
