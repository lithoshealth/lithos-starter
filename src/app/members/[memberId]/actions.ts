"use server";

import { revalidatePath } from "next/cache";
import { escalateMember, type ScreeningAnswers } from "@/lib/escalate";
import { getLithosClient } from "@/lib/lithos/client";
import { LithosApiError } from "@/lib/lithos/errors";
import type { ApiError, Inquiry } from "@/lib/lithos/types";
import { upsertInquiry } from "@/lib/projections";

export type ActionState =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "blocked"; reasons: string[] }
  | { status: "error"; httpStatus?: number; errors: ApiError[] };

const SCREENING_KEYS: Array<keyof ScreeningAnswers> = [
  "established_atherosclerotic_cardiovascular_disease", "recent_cardiac_condition", "drug_hypersensitivity",
  "cirrhosis", "severe_hepatic_impairment", "severe_renal_impairment", "pregnancy", "currently_taking_cyclosporine",
];

/** The partner's escalation: screening answered now, treatment chosen by the member, hard stops applied before any call. */
export async function escalateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const memberId = String(formData.get("member_id") ?? "");
  const catalogTreatmentId = String(formData.get("catalog_treatment_id") ?? "") || undefined;
  if (formData.get("attested") !== "on") {
    return { status: "error", errors: [{ code: "eucardia.consent_required", message: "Telehealth consent and identity confirmation are required before escalating." }] };
  }
  const screening = Object.fromEntries(SCREENING_KEYS.map((k) => [k, formData.get(k) === "on"])) as ScreeningAnswers;

  // Tri-state on purpose: unanswered stays undefined, so it is never mistaken
  // for "no" on the way to Lithos.
  const governmentInsurance = formData.get("enrolled_in_government_insurance");
  const enrolledInGovernmentInsurance =
    governmentInsurance === "true" ? true : governmentInsurance === "false" ? false : undefined;

  const result = await escalateMember({ memberId, screening, attestedAt: new Date(), catalogTreatmentId, enrolledInGovernmentInsurance });
  revalidatePath(`/members/${memberId}`);

  if (result.status === "blocked") {
    return { status: "blocked", reasons: result.plan.hardStops.filter((h) => h.triggered).map((h) => `${h.rule} — ${h.basis}`) };
  }
  if (result.status === "failed") return { status: "error", httpStatus: result.httpStatus, errors: result.errors };
  return { status: "ok", message: `${result.linkedToExisting ? "Linked to existing patient" : "Patient created"} · encounter ${result.encounterId} is ${result.encounter.status.replace("_", " ")}.` };
}

/** Relay the member's reply to the care team, then re-read the thread so the projection is current. */
export async function replyToInquiryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const memberId = String(formData.get("member_id") ?? "");
  const inquiryId = String(formData.get("inquiry_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { status: "error", errors: [{ code: "eucardia.empty_reply", message: "Write a reply first." }] };

  const client = getLithosClient();
  try {
    await client.post(`/v1/inquiries/${encodeURIComponent(inquiryId)}/messages`, { body });
    const inquiry = await client.get<Inquiry>(`/v1/inquiries/${encodeURIComponent(inquiryId)}`);
    await upsertInquiry(memberId, inquiry);
  } catch (error) {
    if (!(error instanceof LithosApiError)) throw error;
    return { status: "error", httpStatus: error.status, errors: error.errors };
  }
  revalidatePath(`/members/${memberId}`);
  return { status: "ok", message: "Reply sent to the care team." };
}
