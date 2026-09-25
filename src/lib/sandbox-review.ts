/**
 * Play the clinician, in the sandbox.
 *
 * In production a licensed clinician reviews an encounter in the Lithos ops
 * portal. The sandbox lets a partner script that part, so the loop — request
 * care, get a decision, receive the webhooks — closes without waiting on
 * anyone. Used by the setup walkthrough and by the app's own care page.
 *
 * One wrinkle it handles: a "clinician's choice" line (no treatment named)
 * can't be approved with an empty sign-off — someone has to choose. Here the
 * sandbox chooses the first active treatment in the encounter's category, at
 * its starting dose, and says so in the returned note.
 */

import type { LithosClient } from "./lithos/client";

type RequestedLine = { id: string; catalog_treatment_id: string | null; status: string };
type EncounterRead = { id: string; status: string; care_plan_id: string; requested_treatments: RequestedLine[]; modality?: string };
type CatalogTreatment = { id: string; name: string; status?: string; categories?: string[]; dosages?: Array<{ id: string }> };

export type SignOffResult = { chose?: string };

export function isSandboxBaseUrl(baseUrl: string | undefined): boolean {
  return Boolean(baseUrl && /\/\/api\.sandbox\./.test(baseUrl));
}

export async function signOffAsClinician(client: LithosClient, encounterId: string): Promise<SignOffResult> {
  if (!isSandboxBaseUrl(process.env.LITHOS_API_BASE_URL)) {
    throw new Error("Refusing to script a clinician sign-off outside the Lithos sandbox.");
  }

  const encounter = await client.get<EncounterRead>(`/v1/encounters/${encounterId}`);
  if (encounter.status === "completed") return {};
  if (encounter.status === "pending_review") {
    // A sync encounter's review starts when both people join the visit's room.
    if (encounter.modality === "sync") throw new Error("This encounter needs its video visit first — book it and play it out with the test clock.");
    await client.post(`/v1/sandbox/encounters/${encounterId}/start_review`, {});
  }

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
