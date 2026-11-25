"use server";

import { LIPID_EMERGENCY_KEYS, LIPID_SCREENING_KEYS } from "@/lib/intake/lipid";
import { redirect } from "next/navigation";
import { escalateMember, type ScreeningAnswers } from "@/lib/escalate";
import type { CareRequestState } from "@/lib/care-request-state";
import { getLithosClient } from "@/lib/lithos/client";
import { lithosConnection, notConnectedError } from "@/lib/lithos/connection";
import { loadVisitOffer } from "@/lib/visit-offer";
import { attemptFrom } from "@/lib/lithos/idempotency";


/**
 * The member asking for care themselves. Same escalation the coach or an
 * operator runs — the partner's hard stops apply before any call to Lithos, so
 * a member who isn't eligible is told here rather than by a clinician later.
 */
export async function requestCareAction(_prev: CareRequestState, formData: FormData): Promise<CareRequestState> {
  const memberId = String(formData.get("member_id") ?? "");
  const catalogTreatmentId = String(formData.get("catalog_treatment_id") ?? "") || undefined;

  if (formData.get("attested") !== "on") {
    return {
      status: "error",
      errors: [{ code: "eucardia.consent_required", message: "Please confirm consent to telehealth care before continuing." }],
    };
  }

  const governmentInsurance = formData.get("enrolled_in_government_insurance");
  if (governmentInsurance !== "true" && governmentInsurance !== "false") {
    return {
      status: "error",
      errors: [{ code: "eucardia.insurance_answer_required", message: "Please answer the Medicare, Medicaid and Tricare question." }],
    };
  }

  const screening = {
    ...Object.fromEntries(LIPID_SCREENING_KEYS.map((k) => [k, formData.get(k) === "on"])),
    emergency_symptoms_now: formData.getAll("emergency_symptoms_now").filter((v): v is string => typeof v === "string" && LIPID_EMERGENCY_KEYS.includes(v)),
  } as ScreeningAnswers;

  // The answers are valid; whether there's anywhere to send them is a separate question.
  if (!lithosConnection().connected) return { status: "error", errors: [notConnectedError()] };

  const reservationToken = String(formData.get("reservation_token") ?? "");
  const idempotencyKey = String(formData.get("idempotency_key") ?? "");
  const result = await escalateMember({
    memberId,
    screening,
    attempt: attemptFrom(formData),
    catalogTreatmentId,
    enrolledInGovernmentInsurance: governmentInsurance === "true",
    ...(reservationToken && idempotencyKey ? { visit: { reservationToken, idempotencyKey } } : {}),
  });

  if (result.status === "blocked") {
    return { status: "blocked", reasons: result.plan.hardStops.filter((h) => h.triggered).map((h) => `${h.rule} — ${h.basis}`) };
  }
  if (result.status === "failed") return { status: "error", httpStatus: result.httpStatus, errors: result.errors };
  if (result.status === "needs_visit") {
    const offer = await loadVisitOffer(getLithosClient(), { patientId: result.patientId, carePlanId: result.carePlanId });
    return { ...result, offer };
  }

  const sync = (result.modality ?? result.encounter.modality) === "sync";
  redirect(`/care/${encodeURIComponent(result.encounterId)}${sync ? "#visit" : ""}`);
}
