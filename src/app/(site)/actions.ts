"use server";

import { redirect } from "next/navigation";
import { getLithosClient } from "@/lib/lithos/client";
import { lithosConnection, notConnectedError } from "@/lib/lithos/connection";
import { LithosApiError } from "@/lib/lithos/errors";
import { parseJourneyForm, runJourney, type JourneyState } from "@/lib/journey";
import { holdSlot, releaseHold, type VisitOffer } from "@/lib/sync-visits";
import { loadVisitOffer } from "@/lib/visit-offer";
import type { HoldState } from "@/lib/visit-state";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function createJourneyAction(_previous: JourneyState, formData: FormData): Promise<JourneyState> {
  const parsed = parseJourneyForm(formData);
  if (!parsed.ok) return { status: "failed", stage: "validation", errors: parsed.errors };

  // Validate first, then check the connection: the visitor learns their form
  // was fine, and that what's missing is somewhere to send it.
  if (!lithosConnection().connected) return { status: "failed", stage: "connection", errors: [notConnectedError()] };

  const client = getLithosClient();
  const result = await runJourney(parsed.value, client);
  if (result.status === "needs_visit") {
    const offer = await loadVisitOffer(client, { patientId: result.patientId, carePlanId: result.carePlanId });
    return { ...result, offer };
  }
  if (result.status === "complete") {
    redirect(`/care/${encodeURIComponent(result.encounterId)}${result.modality === "sync" ? "#visit" : ""}`);
  }
  return result;
}

/** Reload the times on offer — after the test clock moved, or to page to later ones. */
export async function intakeSlotsAction(previous: VisitOffer, formData: FormData): Promise<VisitOffer> {
  if (!lithosConnection().connected) return { ...previous, error: { errors: [notConnectedError()] } };
  return loadVisitOffer(getLithosClient(), {
    patientId: field(formData, "patient_id"),
    carePlanId: field(formData, "care_plan_id"),
    from: field(formData, "from") || undefined,
  });
}

/** Hold the time the patient picked before their encounter exists, or give the hold back. */
export async function intakeHoldAction(_previous: HoldState, formData: FormData): Promise<HoldState> {
  if (!lithosConnection().connected) return { status: "error", errors: [notConnectedError()] };
  const client = getLithosClient();
  try {
    if (field(formData, "intent") === "release") {
      await releaseHold(client, field(formData, "reservation_token"));
      return { status: "idle" };
    }
    // Lithos checks the plan belongs to the patient (`reference.invalid`).
    const reservation = await holdSlot(client, {
      slotToken: field(formData, "slot_token"),
      patientId: field(formData, "patient_id"),
      carePlanId: field(formData, "care_plan_id"),
    });
    return { status: "held", reservation, idempotencyKey: crypto.randomUUID() };
  } catch (error) {
    if (error instanceof LithosApiError) return { status: "error", httpStatus: error.status, errors: error.errors };
    return { status: "error", errors: [{ code: "sample_app.integration_error", message: error instanceof Error ? error.message : String(error) }] };
  }
}
