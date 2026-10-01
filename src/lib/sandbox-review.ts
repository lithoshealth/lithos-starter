/**
 * Play the clinician, in the sandbox.
 *
 * In production a licensed clinician reviews an encounter in the Lithos ops
 * portal. The sandbox lets a partner script that part, so the loop — request
 * care, get a decision, receive the webhooks — closes without waiting on
 * anyone. Used by the setup walkthrough and by the app's own care page.
 *
 * Three outcomes, the same a real clinician has: approve (and prescribe),
 * decline (the plan becomes ineligible, with a reason code), or ask the patient
 * a question (an escalation, which opens a message thread with them).
 *
 * One wrinkle approval handles: a "clinician's choice" line (no treatment named)
 * can't be approved with an empty sign-off — someone has to choose. Here the
 * sandbox chooses the first active treatment in the encounter's category, at
 * its starting dose, and says so in the returned note.
 */

import type { LithosClient } from "./lithos/client";
import { isSandboxBaseUrl } from "./lithos/sandbox";

type RequestedLine = { id: string; catalog_treatment_id: string | null; status: string };
type EncounterRead = { id: string; status: string; patient_id: string; care_plan_id: string; requested_treatments: RequestedLine[]; modality?: string };
type InquiryRead = { id: string; status: string; references?: Array<{ id?: string }> };
type CatalogTreatment = { id: string; name: string; status?: string; categories?: string[]; dosages?: Array<{ id: string }> };

export type SignOffResult = { chose?: string };

export { isSandboxBaseUrl };

function refuseOutsideSandbox() {
  if (!isSandboxBaseUrl(process.env.LITHOS_API_BASE_URL)) {
    throw new Error("Refusing to script a clinician decision outside the Lithos sandbox.");
  }
}

/**
 * Put the encounter in review, as a clinician opening it would. Returns it, or
 * null if it's already decided.
 *
 * An escalated encounter is waiting on a question to the patient. A clinician
 * who carries on reads the thread and resolves it, which is also what returns
 * the encounter to review — so that's what happens here, rather than leaving
 * the question open behind a decision.
 */
async function openForReview(client: LithosClient, encounterId: string): Promise<EncounterRead | null> {
  const encounter = await client.get<EncounterRead>(`/v1/encounters/${encounterId}`);
  if (encounter.status === "completed" || encounter.status === "canceled") return null;
  if (encounter.status === "pending_review") {
    // A sync encounter's review starts when both people join the visit's room.
    if (encounter.modality === "sync") throw new Error("This encounter needs its video visit first — book it and play it out with the test clock.");
    await client.post(`/v1/sandbox/encounters/${encounterId}/start_review`, {});
  }
  if (encounter.status === "escalated") {
    const inquiries = await client.get<{ data: InquiryRead[] }>(`/v1/patients/${encounter.patient_id}/inquiries`);
    const open = inquiries.data.find((i) => i.status === "open" && i.references?.some((r) => r.id === encounterId));
    if (open) await client.post(`/v1/sandbox/inquiries/${open.id}/resolve`, {});
    else await client.post(`/v1/sandbox/encounters/${encounterId}/resume`, {});
  }
  return encounter;
}

export async function signOffAsClinician(client: LithosClient, encounterId: string): Promise<SignOffResult> {
  refuseOutsideSandbox();
  const encounter = await openForReview(client, encounterId);
  if (!encounter) return {};

  const unchosen = encounter.requested_treatments.filter((line) => !line.catalog_treatment_id && line.status === "pending");
  if (unchosen.length === 0) {
    // Every line names a treatment: an empty body approves them all.
    await client.post(`/v1/sandbox/encounters/${encounterId}/complete`, {});
    return {};
  }

  const plan = await client.get<{ category: string }>(`/v1/care_plans/${encounter.care_plan_id}`);
  const catalog = await client.get<{ data: CatalogTreatment[] }>("/v1/catalog_treatments");
  const pick = catalog.data.find((t) => t.status !== "inactive" && t.categories?.includes(plan.category) && t.dosages?.length);
  if (!pick?.dosages) throw new Error(`Your formulary has no ${plan.category.replace(/_/g, " ")} treatment with a dosage to prescribe.`);

  await client.post(`/v1/sandbox/encounters/${encounterId}/complete`, {
    treatments: unchosen.map((line) => ({ requested_treatment_id: line.id, status: "approved", dosage_ids: [pick.dosages![0].id] })),
  });
  return { chose: pick.name };
}

/**
 * Decline: the care plan becomes ineligible with the reason code
 * `criteria_not_met`, and every requested line is rejected with it. The
 * patient sees a declined plan; the partner gets the reason code.
 */
export async function declineAsClinician(client: LithosClient, encounterId: string): Promise<void> {
  refuseOutsideSandbox();
  if (!(await openForReview(client, encounterId))) return;
  await client.post(`/v1/sandbox/encounters/${encounterId}/complete`, {
    plan: { eligibility_status: "ineligible", ineligibility_reason_code: "criteria_not_met" },
  });
}

/**
 * Ask the patient a question: the encounter is escalated for more
 * information, and the question goes to the patient as a message (an inquiry
 * the partner can answer through the API). The encounter waits for the reply.
 */
export async function askPatientAsClinician(client: LithosClient, encounterId: string, question: string): Promise<void> {
  refuseOutsideSandbox();
  if (!(await openForReview(client, encounterId))) return;
  await client.post(`/v1/sandbox/encounters/${encounterId}/escalate`, {
    escalation_reason: "patient_information_required",
    message_for_patient: question,
  });
}
