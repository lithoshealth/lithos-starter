/**
 * Sync visits: a live video visit the clinician reviews the encounter in.
 *
 * Lithos decides whether a visit is needed, which clinicians to offer, and runs
 * the room. The partner offers times, holds one, books it, and links to
 * `patient_join.url`. Every call below is on the public `/v1` API; the whole
 * feature is still hidden from the published reference.
 *
 *   GET  /v1/encounter_requirements          → modality: sync | async
 *   GET  /v1/appointment_slots               → times to offer (≤ 14 days per call)
 *   POST /v1/slot_reservations               → a hold, 15 minutes by default
 *   POST /v1/encounters/{id}/appointments    → the booking (Idempotency-Key required)
 *   POST /v1/appointments/{id}/reschedule    → one atomic move (Idempotency-Key required)
 *   POST /v1/appointments/{id}/cancel        → reason required; needs_appointment → true
 */

import type { LithosClient } from "./lithos/client";
import { LithosApiError } from "./lithos/errors";
import { formatVisitTime } from "./time-zones";
import type {
  ApiError,
  Appointment,
  AppointmentSlotsResponse,
  Encounter,
  EncounterPrecheck,
  Modality,
  SlotReservation,
} from "./lithos/types";

/** Times grouped by the patient's local day, labels already formatted. */
export type SlotDay = { label: string; slots: Array<{ token: string; time: string }> };

/** Everything a time picker needs, with no further call to Lithos. */
export type VisitOffer = {
  /** The patient's zone, from Lithos: the grid's days and labels are in it. */
  timeZone: string;
  sandbox: boolean;
  /** The test clock's time, formatted; null on the wall clock. */
  clockLabel: string | null;
  days: SlotDay[];
  reason: AppointmentSlotsResponse["reason"];
  nextAvailable: string | null;
  /** Where "later times" starts: the end of this range. Null when nothing was offered. */
  laterFrom: string | null;
  error?: { httpStatus?: number; errors: ApiError[] };
};

export function slotDays(slots: AppointmentSlotsResponse["slots"], timeZone: string): SlotDay[] {
  const days: SlotDay[] = [];
  for (const slot of slots) {
    const label = formatVisitTime(slot.starts_at, timeZone, "day");
    if (days.at(-1)?.label !== label) days.push({ label, slots: [] });
    days.at(-1)!.slots.push({ token: slot.slot_token, time: formatVisitTime(slot.starts_at, timeZone, "time") });
  }
  return days;
}

/** Well inside the API's 14-day cap, and one screen of times. */
export const SLOT_WINDOW_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1_000;

function id(value: string): string {
  return encodeURIComponent(value);
}

function query(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

export function slotWindow(from: Date, days = SLOT_WINDOW_DAYS): { from: string; to: string } {
  return { from: from.toISOString(), to: new Date(from.getTime() + days * DAY_MS).toISOString() };
}

/**
 * Asks Lithos, before the encounter exists, whether it can take one and how:
 * async, or a live visit. GET /v1/encounter_precheck answers what
 * POST /v1/encounters would; when it wouldn't take it, the reasons come back as
 * the error POST would give (a 422 with the same codes), so the intake shows
 * them instead of a modality.
 */
export async function readModality(client: LithosClient, patientId: string, carePlanId: string): Promise<Modality> {
  const answer = await client.get<EncounterPrecheck>(
    `/v1/encounter_precheck?${query({ patient_id: patientId, care_plan_id: carePlanId })}`,
  );
  if (!answer.passed || !answer.requirements) {
    throw new LithosApiError(422, answer.reasons.map((r) => ({ code: r.code, message: r.message })));
  }
  return answer.requirements.modality.value;
}

export function listSlots(
  client: LithosClient,
  input: { patientId: string; carePlanId: string; from: string; to: string },
): Promise<AppointmentSlotsResponse> {
  return client.get(
    `/v1/appointment_slots?${query({ patient_id: input.patientId, care_plan_id: input.carePlanId, from: input.from, to: input.to })}`,
  );
}

/** The grid for moving one visit: its own time comes back, and continuity of care narrows it to that clinician. */
export function listRescheduleSlots(
  client: LithosClient,
  appointmentId: string,
  window: { from: string; to: string },
): Promise<AppointmentSlotsResponse> {
  return client.get(`/v1/appointments/${id(appointmentId)}/reschedule_slots?${query(window)}`);
}

export function holdSlot(
  client: LithosClient,
  input: { slotToken: string; patientId: string; carePlanId: string },
): Promise<SlotReservation> {
  return client.post("/v1/slot_reservations", {
    slot_token: input.slotToken,
    patient_id: input.patientId,
    care_plan_id: input.carePlanId,
  });
}

export function releaseHold(client: LithosClient, reservationToken: string): Promise<SlotReservation> {
  return client.post(`/v1/slot_reservations/${id(reservationToken)}/release`, {});
}

export function bookVisit(
  client: LithosClient,
  input: { encounterId: string; reservationToken: string; idempotencyKey: string },
): Promise<Appointment> {
  return client.post(
    `/v1/encounters/${id(input.encounterId)}/appointments`,
    { reservation_token: input.reservationToken },
    { idempotencyKey: input.idempotencyKey },
  );
}

/** Answers with the NEW appointment; the old one becomes `canceled` with `rescheduled_to_id`. */
export function rescheduleVisit(
  client: LithosClient,
  input: { appointmentId: string; reservationToken: string; idempotencyKey: string },
): Promise<Appointment> {
  return client.post(
    `/v1/appointments/${id(input.appointmentId)}/reschedule`,
    { reservation_token: input.reservationToken },
    { idempotencyKey: input.idempotencyKey },
  );
}

export function cancelVisit(client: LithosClient, appointmentId: string, reason: string): Promise<Appointment> {
  return client.post(`/v1/appointments/${id(appointmentId)}/cancel`, { reason });
}

export function readAppointment(client: LithosClient, appointmentId: string): Promise<Appointment> {
  return client.get(`/v1/appointments/${id(appointmentId)}`);
}

/** Every booking on the encounter, newest first — rebookings and reschedules add rows. */
export async function listAppointments(client: LithosClient, encounterId: string): Promise<Appointment[]> {
  const page = await client.get<{ data: Appointment[] }>(`/v1/encounters/${id(encounterId)}/appointments`);
  return page.data;
}

export function isLive(appointment: Pick<Appointment, "status"> | null | undefined): boolean {
  return appointment?.status === "scheduled" || appointment?.status === "in_progress";
}

/**
 * What the visit section should offer. Driven by the two encounter fields the
 * guide says to trust after creation — `modality` and `needs_appointment` —
 * plus the latest booking.
 */
export type VisitStage = "none" | "book" | "booked" | "done";

export function visitStage(encounter: Pick<Encounter, "status" | "modality" | "needs_appointment" | "latest_appointment">): VisitStage {
  if (encounter.modality !== "sync") return "none";
  if (encounter.status === "canceled" || encounter.status === "completed") return "done";
  if (isLive(encounter.latest_appointment)) return "booked";
  if (encounter.needs_appointment) return "book";
  return "done";
}
