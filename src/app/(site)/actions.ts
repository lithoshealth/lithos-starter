"use server";

import { redirect } from "next/navigation";
import { getLithosClient } from "@/lib/lithos/client";
import { lithosConnection, notConnectedError } from "@/lib/lithos/connection";
import { LithosApiError } from "@/lib/lithos/errors";
import { attemptFrom } from "@/lib/lithos/idempotency";
import { isDbConfigured } from "@/lib/db";
import { findOrCreateMemberForCare, linkMemberToLithos } from "@/lib/members";
import { parseJourneyForm, runJourney, type JourneyState } from "@/lib/journey";
import { holdSlot, releaseHold, type VisitOffer } from "@/lib/sync-visits";
import { loadVisitOffer } from "@/lib/visit-offer";
import type { HoldState } from "@/lib/visit-state";
import { DEFAULT_PROGRAM, readConfig } from "@/lib/starter-config";
import { writeJourneyIds } from "@/lib/setup/journey-cookie";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function createJourneyAction(_previous: JourneyState, formData: FormData): Promise<JourneyState> {
  const { program } = await readConfig();
  const parsed = parseJourneyForm(formData, program ?? DEFAULT_PROGRAM);
  if (!parsed.ok) return { status: "failed", stage: "validation", errors: parsed.errors };

  // Validate first, then check the connection: the visitor learns their form
  // was fine, and that what's missing is somewhere to send it.
  if (!lithosConnection().connected) return { status: "failed", stage: "connection", errors: [notConnectedError()] };

  const client = getLithosClient();
  // The person, in your own records first (lib/members.ts): found by email or
  // added, and their id is the patient's external_id — so whichever door they
  // came in by, they're one member and one Lithos patient.
  const member = isDbConfigured() ? await findOrCreateMemberForCare(parsed.value.patient) : null;
  if (member?.lithos_patient_id) parsed.value.resume.patientId ??= member.lithos_patient_id;
  const result = await runJourney(parsed.value, client, { attempt: attemptFrom(formData), externalId: member?.id });
  // Linked as soon as Lithos has the patient — even if a later step failed.
  const patientId = "patientId" in result ? result.patientId : undefined;
  if (member && !member.lithos_patient_id && patientId) await linkMemberToLithos(member.id, patientId);
  if (result.status === "needs_visit") {
    const offer = await loadVisitOffer(client, { patientId: result.patientId, carePlanId: result.carePlanId });
    return { ...result, offer };
  }
  if (result.status === "complete") {
    // The setup walkthrough follows the latest care review from this browser:
    // filling in the intake as your first patient (step 3's form) completes
    // that step, with the real patient, care plan and encounter.
    await writeJourneyIds({ patientId: result.patientId, carePlanId: result.carePlanId, encounterId: result.encounterId });
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
