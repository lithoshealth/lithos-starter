"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLithosClient } from "@/lib/lithos/client";
import { lithosConnection, notConnectedError } from "@/lib/lithos/connection";
import { LithosApiError } from "@/lib/lithos/errors";
import type { Encounter } from "@/lib/lithos/types";
import { askPatientAsClinician, declineAsClinician, signOffAsClinician } from "@/lib/sandbox-review";
import type { ClinicianState } from "@/lib/sandbox-review-state";
import { bookVisit, cancelVisit, holdSlot, releaseHold, rescheduleVisit } from "@/lib/sync-visits";
import type { ActionError, HoldState, VisitActionState } from "@/lib/visit-state";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function errorState(error: unknown): ActionError {
  if (error instanceof LithosApiError) return { status: "error", httpStatus: error.status, errors: error.errors };
  return { status: "error", errors: [{ code: "sample_app.integration_error", message: error instanceof Error ? error.message : String(error) }] };
}

function carePath(encounterId: string): string {
  return `/care/${encodeURIComponent(encounterId)}`;
}

/** Hold the time the patient picked, or give a hold back. */
export async function slotHoldAction(_prev: HoldState, formData: FormData): Promise<HoldState> {
  if (!lithosConnection().connected) return { status: "error", errors: [notConnectedError()] };
  const client = getLithosClient();
  try {
    if (field(formData, "intent") === "release") {
      await releaseHold(client, field(formData, "reservation_token"));
      // Back to the grid: fetch it fresh, since the one on screen may be stale by now.
      const encounterId = field(formData, "encounter_id");
      if (encounterId) revalidatePath(carePath(encounterId));
      return { status: "idle" };
    }
    // The hold must be for the encounter's own patient and plan; read them
    // rather than trusting the browser to send them back.
    const encounter = await client.get<Encounter>(`/v1/encounters/${encodeURIComponent(field(formData, "encounter_id"))}`);
    const reservation = await holdSlot(client, {
      slotToken: field(formData, "slot_token"),
      patientId: encounter.patient_id,
      carePlanId: encounter.care_plan_id,
    });
    return { status: "held", reservation, idempotencyKey: crypto.randomUUID() };
  } catch (error) {
    return errorState(error);
  }
}

/** Book the hold as the encounter's visit, or spend it moving an existing one. */
export async function confirmVisitAction(_prev: VisitActionState, formData: FormData): Promise<VisitActionState> {
  if (!lithosConnection().connected) return { status: "error", errors: [notConnectedError()] };
  const encounterId = field(formData, "encounter_id");
  const reservationToken = field(formData, "reservation_token");
  const idempotencyKey = field(formData, "idempotency_key");
  try {
    if (field(formData, "intent") === "reschedule") {
      await rescheduleVisit(getLithosClient(), { appointmentId: field(formData, "appointment_id"), reservationToken, idempotencyKey });
    } else {
      await bookVisit(getLithosClient(), { encounterId, reservationToken, idempotencyKey });
    }
  } catch (error) {
    return errorState(error);
  }
  revalidatePath(carePath(encounterId));
  redirect(`${carePath(encounterId)}#visit`);
}

export async function cancelVisitAction(_prev: VisitActionState, formData: FormData): Promise<VisitActionState> {
  if (!lithosConnection().connected) return { status: "error", errors: [notConnectedError()] };
  const encounterId = field(formData, "encounter_id");
  try {
    await cancelVisit(getLithosClient(), field(formData, "appointment_id"), field(formData, "reason"));
  } catch (error) {
    return errorState(error);
  }
  revalidatePath(carePath(encounterId));
  redirect(`${carePath(encounterId)}#visit`);
}

/**
 * Sandbox only: play the clinician on the visitor's own encounter, so the
 * app's journey closes. Approve (the default), decline, or ask the patient a
 * question first — the three things a clinician can do.
 */
export async function playClinicianAction(_prev: ClinicianState, formData: FormData): Promise<ClinicianState> {
  const encounterId = String(formData.get("encounter_id") ?? "");
  const decision = String(formData.get("decision") ?? "approve");
  if (!lithosConnection().connected) return { status: "error", errors: [notConnectedError()] };
  try {
    const client = getLithosClient();
    let chose: string | undefined;
    if (decision === "decline") {
      await declineAsClinician(client, encounterId);
    } else if (decision === "ask") {
      const question = String(formData.get("question") ?? "").trim().slice(0, 10_000);
      if (!question) return { status: "error", errors: [{ code: "sandbox.empty_question", message: "Write the clinician's question first." }] };
      await askPatientAsClinician(client, encounterId, question);
    } else {
      ({ chose } = await signOffAsClinician(client, encounterId));
    }
    revalidatePath(`/care/${encounterId}`);
    return { status: "ok", chose };
  } catch (error) {
    if (error instanceof LithosApiError) return { status: "error", httpStatus: error.status, errors: error.errors };
    return { status: "error", errors: [{ code: "sandbox.sign_off_failed", message: error instanceof Error ? error.message : String(error) }] };
  }
}
