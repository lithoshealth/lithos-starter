import { buildEscalationPlan, type EscalationPlan } from "./escalation";
import { getLithosClient } from "./lithos/client";
import { LithosApiError } from "./lithos/errors";
import type { ApiError, CarePlan, Encounter, EncounterCreate, PatientCreate } from "./lithos/types";
import { getMemberRecord, linkMemberToLithos, recordGovernmentInsurance } from "./members";
import { findOpenEncounter, findOpenInitialCarePlan, upsertCarePlan, upsertEncounter } from "./projections";

/**
 * Push a member into Lithos medical care. This is the partner's side of the
 * bargain done properly: hard stops first, the member's own id as the
 * reconciliation key, resumable at every stage, and the reconciliation path
 * the contract documents — a reused `external_id` returns the existing
 * patient's id, so we link to it rather than creating a duplicate.
 */

/** The eight required screening answers. Not held by a coaching business; asked at escalation. */
export type ScreeningAnswers = {
  established_atherosclerotic_cardiovascular_disease: boolean;
  recent_cardiac_condition: boolean;
  drug_hypersensitivity: boolean;
  cirrhosis: boolean;
  severe_hepatic_impairment: boolean;
  severe_renal_impairment: boolean;
  pregnancy: boolean;
  currently_taking_cyclosporine: boolean;
};

export type EscalateInput = {
  memberId: string;
  screening: ScreeningAnswers;
  /** Timestamps of the telehealth consent and identity check taken at escalation. */
  attestedAt: Date;
  /** The option the member chose at intake (protocol: patient chooses). Omitted = provider-choice line. */
  catalogTreatmentId?: string;
  /**
   * The platform's government-insurance question, when it hasn't been asked
   * before. Recorded on the member, so it is asked once rather than every time.
   */
  enrolledInGovernmentInsurance?: boolean;
};

export type EscalateResult =
  | { status: "blocked"; plan: EscalationPlan }
  | { status: "failed"; stage: "patient" | "care_plan" | "encounter"; httpStatus: number; errors: ApiError[]; patientId?: string; carePlanId?: string }
  | { status: "complete"; patientId: string; carePlanId: string; encounterId: string; linkedToExisting: boolean; plan: EscalationPlan; encounter: Encounter };

// The protocol's screening hard stops. Answered yes → do not create the encounter.
const SCREENING_HARD_STOPS: Array<keyof ScreeningAnswers> = [
  "drug_hypersensitivity", "pregnancy", "cirrhosis", "severe_hepatic_impairment", "severe_renal_impairment",
];

export async function escalateMember(input: EscalateInput): Promise<EscalateResult> {
  // Persist the answer before building the plan, so the hard stop below reads
  // what the member actually said rather than a default.
  if (input.enrolledInGovernmentInsurance !== undefined) {
    await recordGovernmentInsurance(input.memberId, input.enrolledInGovernmentInsurance);
  }

  const record = await getMemberRecord(input.memberId);
  if (!record) throw new Error(`No member ${input.memberId}`);

  const plan = buildEscalationPlan(record);
  for (const key of SCREENING_HARD_STOPS) {
    plan.hardStops.push({ rule: `Screening: ${key.replace(/_/g, " ")}`, triggered: input.screening[key], basis: input.screening[key] ? "answered yes" : "answered no" });
  }
  if (plan.hardStops.some((h) => h.triggered)) return { status: "blocked", plan: { ...plan, eligible: false } };

  const client = getLithosClient();
  const { member } = record;
  let patientId = member.lithos_patient_id ?? undefined;
  let linkedToExisting = false;

  if (!patientId) {
    const payload: PatientCreate = {
      ...plan.patient,
      telehealth_consented_at: input.attestedAt.toISOString(),
      identity_verified_at: input.attestedAt.toISOString(),
    };
    try {
      const created = await client.post<{ id: string }>("/v1/patients", payload);
      patientId = created.id;
    } catch (error) {
      if (!(error instanceof LithosApiError)) throw error;
      // Documented reconciliation: the external_id already names a patient in
      // this organisation. Link to it — that's the whole point of the key.
      const conflict = error.errors.find((e) => e.code === "patient.external_id_in_use");
      const existing = conflict?.meta?.existing_patient_id;
      if (typeof existing === "string") {
        patientId = existing;
        linkedToExisting = true;
      } else {
        return { status: "failed", stage: "patient", httpStatus: error.status, errors: error.errors };
      }
    }
    await linkMemberToLithos(member.id, patientId);
  }

  // Idempotent on re-run: a plan still awaiting its initial review is reused,
  // and an encounter already open on it is returned as-is. Only initial-review
  // plans qualify — an active plan means a follow-up, which has its own intake
  // shape and is a separate flow.
  const existingPlan = await findOpenInitialCarePlan(member.id);
  if (existingPlan) {
    const existingEncounter = await findOpenEncounter(existingPlan.id);
    if (existingEncounter) {
      return { status: "complete", patientId, carePlanId: existingPlan.id, encounterId: existingEncounter.id, linkedToExisting, plan, encounter: existingEncounter };
    }
  }

  let carePlan: CarePlan;
  if (existingPlan) {
    carePlan = existingPlan;
  } else {
    try {
      carePlan = await client.post<CarePlan>("/v1/care_plans", { patient_id: patientId, category: "lipid_management" });
      await upsertCarePlan(member.id, carePlan);
    } catch (error) {
      if (!(error instanceof LithosApiError)) throw error;
      return { status: "failed", stage: "care_plan", httpStatus: error.status, errors: error.errors, patientId };
    }
  }

  const encounterPayload: EncounterCreate = {
    patient_id: patientId,
    care_plan_id: carePlan.id,
    intake_form: { data: { ...plan.intake, ...input.screening } },
    requested_treatments: [input.catalogTreatmentId ? { action: "add", catalog_treatment_id: input.catalogTreatmentId } : { action: "add" }],
  };

  try {
    const encounter = await client.post<Encounter>("/v1/encounters", encounterPayload);
    await upsertEncounter(member.id, encounter);
    return { status: "complete", patientId, carePlanId: carePlan.id, encounterId: encounter.id, linkedToExisting, plan, encounter };
  } catch (error) {
    if (!(error instanceof LithosApiError)) throw error;
    return { status: "failed", stage: "encounter", httpStatus: error.status, errors: error.errors, patientId, carePlanId: carePlan.id };
  }
}
