"use server";

import { redirect } from "next/navigation";
import { escalateMember, type ScreeningAnswers } from "@/lib/escalate";
import type { CareRequestState } from "@/lib/care-request-state";
import { getLithosClient } from "@/lib/lithos/client";
import { lithosConnection, notConnectedError } from "@/lib/lithos/connection";
import { loadVisitOffer } from "@/lib/visit-offer";

const SCREENING_KEYS: Array<keyof ScreeningAnswers> = [
  "established_atherosclerotic_cardiovascular_disease", "recent_cardiac_condition", "drug_hypersensitivity",
  "cirrhosis", "severe_hepatic_impairment", "severe_renal_impairment", "pregnancy", "currently_taking_cyclosporine",
];

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

  const screening = Object.fromEntries(SCREENING_KEYS.map((k) => [k, formData.get(k) === "on"])) as ScreeningAnswers;

  // The answers are valid; whether there's anywhere to send them is a separate question.
  if (!lithosConnection().connected) return { status: "error", errors: [notConnectedError()] };

  const reservationToken = String(formData.get("reservation_token") ?? "");
  const idempotencyKey = String(formData.get("idempotency_key") ?? "");
  const result = await escalateMember({
    memberId,
    screening,
    attestedAt: new Date(),
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
