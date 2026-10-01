import { getDb, newId } from "./db";
import { getLithosClient } from "./lithos/client";
import { LithosApiError } from "./lithos/errors";
import type { ApiError, CarePlan, Encounter, EncounterCreate, LipidManagementFollowUpIntake, RequestedTreatmentLine } from "./lithos/types";
import { getMemberRecord } from "./members";
import { upsertEncounter } from "./projections";
import { newAttempt, stepKeys, type Attempt } from "./lithos/idempotency";

/**
 * The treat-to-target recheck — the loop a preventive clinic lives on, and the
 * least-tested surface of the integration.
 *
 * What a partner has to own here, because Lithos doesn't:
 *   - The recheck value arrives from the lab as a PDF. Eucardia transcribes it
 *     into its own record and into the follow-up intake by hand.
 *   - The protocol's decision — at target: continue; ≥ 50 on monotherapy:
 *     suggest the complementary agent — is applied on the partner side and
 *     expressed as requested_treatments lines. The clinician still decides.
 *   - The refill guard: only submit when the treatment's refill_status is
 *     `eligible`; `pending` means a follow-up is already waiting on review.
 */

export const PROTOCOL_TARGET_LDL = 50;

export type RecheckPanel = {
  drawn_on: string;
  ldl_c: number;
  apo_b?: number | null;
  hba1c?: number | null;
  hdl_c?: number | null;
  triglycerides?: number | null;
  total_cholesterol?: number | null;
  /** CMP values from the statin-path panel; sent as an undeclared extra. */
  cmp?: Record<string, number>;
  notes?: string;
};

export type FollowUpInput = {
  memberId: string;
  /** The stable treatment line being renewed (`thr_…`). */
  treatmentId: string;
  recheck: RecheckPanel;
  adherence: LipidManagementFollowUpIntake["adherence"];
  sideEffects?: string[];
  healthChanges?: string;
  /** Catalog slug to add as a second agent when still above target (the protocol's "suggest the complementary agent"). */
  addAgent?: string;
  fhResponsive?: LipidManagementFollowUpIntake["familial_hypercholesterolemia_responsive"];
  /** The recheck as one attempt (lib/lithos/idempotency.ts): sent twice, one encounter. */
  attempt?: Attempt;
};

export type FollowUpResult =
  | { status: "blocked"; reason: string }
  | { status: "failed"; httpStatus: number; errors: ApiError[] }
  | { status: "complete"; encounterId: string; encounter: Encounter; decision: string; lines: RequestedTreatmentLine[] };

export async function followUpMember(input: FollowUpInput): Promise<FollowUpResult> {
  const record = await getMemberRecord(input.memberId);
  if (!record) throw new Error(`No member ${input.memberId}`);
  const { member, panels, target } = record;
  if (!member.lithos_patient_id) return { status: "blocked", reason: "member is not linked to a Lithos patient" };

  const sql = getDb();
  const [planRow] = await sql<{ lithos_care_plan_id: string }[]>`
    SELECT lithos_care_plan_id FROM care_plans WHERE member_id = ${member.id} AND status = 'active' ORDER BY synced_at DESC LIMIT 1`;
  if (!planRow) return { status: "blocked", reason: "no active care plan projected locally" };

  // The refill guard, read live rather than from the projection: `eligible` is
  // set by a clock-driven sweep and the projection may be behind.
  const client = getLithosClient();
  const plan = await client.get<CarePlan>(`/v1/care_plans/${encodeURIComponent(planRow.lithos_care_plan_id)}`);
  const treatment = plan.treatments.find((t) => t.treatment_id === input.treatmentId);
  if (!treatment) return { status: "blocked", reason: `treatment ${input.treatmentId} is not on the active plan` };
  if (treatment.refill_status !== "eligible") {
    return { status: "blocked", reason: `treatment refill_status is ${treatment.refill_status}${treatment.refill_status === "pending" ? " — a follow-up is already awaiting review; don't ask the member again" : ""}` };
  }

  // Eucardia's own record gets the recheck first. Lithos ordered the draw, the
  // lab produced a PDF, a human typed these numbers — so `source: lithos`.
  await sql`INSERT INTO lab_panels ${sql({
    id: newId("lab"),
    member_id: member.id,
    drawn_on: input.recheck.drawn_on,
    source: "lithos",
    ldl_c: input.recheck.ldl_c,
    apo_b: input.recheck.apo_b ?? null,
    lp_a: null,
    hdl_c: input.recheck.hdl_c ?? null,
    triglycerides: input.recheck.triglycerides ?? null,
    total_cholesterol: input.recheck.total_cholesterol ?? null,
    hs_crp: null,
    a1c: input.recheck.hba1c ?? null,
    notes: input.recheck.notes ?? `Recheck on ${treatment.catalog_treatment_id}; transcribed from the lab PDF.`,
  })}`;

  // The protocol's follow-up branch, applied on the partner side.
  const ldl = input.recheck.ldl_c;
  const lines: RequestedTreatmentLine[] = [{ action: "refill", treatment_id: input.treatmentId }];
  let decision: string;
  if (ldl < PROTOCOL_TARGET_LDL) {
    decision = `LDL-C ${ldl} < ${PROTOCOL_TARGET_LDL}: at target — continue, no change`;
  } else if (input.addAgent) {
    lines.push({ action: "add", catalog_treatment_id: input.addAgent });
    decision = `LDL-C ${ldl} ≥ ${PROTOCOL_TARGET_LDL} on ${treatment.catalog_treatment_id} alone: suggest the complementary agent — adding ${input.addAgent}`;
  } else {
    decision = `LDL-C ${ldl} ≥ ${PROTOCOL_TARGET_LDL} on ${treatment.catalog_treatment_id} alone: protocol suggests the complementary agent; none requested (clinician may up-titrate)`;
  }

  const initial = panels[panels.length - 1];
  const intake: LipidManagementFollowUpIntake & Record<string, unknown> = {
    adherence: input.adherence,
    ldl_c: ldl,
    ldl_c_date: input.recheck.drawn_on,
    ...(input.fhResponsive ? { familial_hypercholesterolemia_responsive: input.fhResponsive } : {}),
    side_effects: input.sideEffects ?? [],
    ...(input.healthChanges ? { health_changes: input.healthChanges } : {}),
    // The rest of the recheck panel, undeclared: stored and shown, validated by nobody.
    ...(input.recheck.apo_b != null ? { apo_b: input.recheck.apo_b } : {}),
    ...(input.recheck.hba1c != null ? { hba1c: input.recheck.hba1c } : {}),
    ...(input.recheck.hdl_c != null ? { hdl_c: input.recheck.hdl_c } : {}),
    ...(input.recheck.triglycerides != null ? { triglycerides: input.recheck.triglycerides } : {}),
    ...(input.recheck.total_cholesterol != null ? { total_cholesterol: input.recheck.total_cholesterol } : {}),
    ...(input.recheck.cmp ? { cmp: input.recheck.cmp } : {}),
    partner_context: [
      `~3-month recheck on ${treatment.catalog_treatment_id} ${treatment.current_prescription?.strength ?? ""}`.trim(),
      initial?.ldl_c != null ? `LDL-C ${Number(initial.ldl_c)} at Eucardia baseline → ${ldl} now` : null,
      `protocol target < ${PROTOCOL_TARGET_LDL}`,
      target?.ldl_c_target ? `Eucardia's own target ${Number(target.ldl_c_target)}` : null,
      decision,
    ].filter(Boolean).join("; "),
  };

  const payload: EncounterCreate = {
    patient_id: member.lithos_patient_id,
    care_plan_id: plan.id,
    intake_form: { data: intake },
    requested_treatments: lines,
  };

  try {
    const encounter = await client.post<Encounter>("/v1/encounters", payload, stepKeys(input.attempt ?? newAttempt())("encounter"));
    await upsertEncounter(member.id, encounter);
    return { status: "complete", encounterId: encounter.id, encounter, decision, lines };
  } catch (error) {
    if (!(error instanceof LithosApiError)) throw error;
    return { status: "failed", httpStatus: error.status, errors: error.errors };
  }
}
