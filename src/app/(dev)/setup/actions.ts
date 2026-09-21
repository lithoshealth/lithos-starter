"use server";

import { revalidatePath } from "next/cache";
import { getLithosClient } from "@/lib/lithos/client";
import { LithosApiError } from "@/lib/lithos/errors";
import type { SetupActionState } from "@/lib/setup/action-state";
import { carePlanRequest, encounterRequest, patientRequest, webhookEndpointRequest } from "@/lib/setup/requests";
import { clearJourneyIds, readJourneyIds as readIds, writeJourneyIds as writeIds } from "@/lib/setup/journey-cookie";
import { isSandbox, readLipidTreatment } from "@/lib/setup/steps";

function failure(error: unknown, hint?: string): SetupActionState {
  if (error instanceof LithosApiError) return { status: "error", httpStatus: error.status, errors: error.errors, hint };
  return { status: "error", errors: [{ code: "setup.unexpected", message: error instanceof Error ? error.message : String(error) }], hint };
}

/** Belt and braces: every action re-checks, so a changed env can't slip a write through to production. */
function refuseOutsideSandbox(): SetupActionState | null {
  if (isSandbox(process.env.LITHOS_API_BASE_URL)) return null;
  return { status: "error", errors: [{ code: "setup.not_sandbox", message: "The walkthrough only writes to the Lithos sandbox." }] };
}

export async function createPatientAction(): Promise<SetupActionState> {
  const refused = refuseOutsideSandbox();
  if (refused) return refused;

  const now = new Date().toISOString();
  const body = { ...patientRequest(String(Date.now())), telehealth_consented_at: now, identity_verified_at: now };
  try {
    const patient = await getLithosClient().post<{ id: string }>("/v1/patients", body);
    // A new patient starts a new thread: drop any encounter from a previous run.
    await writeIds({ patientId: patient.id });
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/setup");
  return { status: "ok" };
}

export async function createEncounterAction(): Promise<SetupActionState> {
  const refused = refuseOutsideSandbox();
  if (refused) return refused;

  const ids = await readIds();
  if (!ids.patientId) return { status: "error", errors: [{ code: "setup.no_patient", message: "Create a patient first." }] };

  const client = getLithosClient();
  try {
    const treatment = await readLipidTreatment();
    if (!treatment) return { status: "error", errors: [{ code: "setup.no_lipid_treatment", message: "Your formulary has no lipid management treatment to request." }] };

    // Reuse a care plan from a run that failed at the encounter, rather than piling up empty plans.
    const carePlanId = ids.carePlanId ?? (await client.post<{ id: string }>("/v1/care_plans", carePlanRequest(ids.patientId))).id;
    await writeIds({ ...ids, carePlanId });

    const encounter = await client.post<{ id: string }>("/v1/encounters", encounterRequest(ids.patientId, carePlanId, treatment.id));
    await writeIds({ ...ids, carePlanId, encounterId: encounter.id });
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/setup");
  return { status: "ok" };
}

/**
 * In production a licensed clinician does this, in the Lithos ops portal. The
 * sandbox lets a partner play that part, so the whole loop closes without
 * waiting on a person — which is what makes an unattended walkthrough possible.
 */
export async function driveReviewAction(): Promise<SetupActionState> {
  const refused = refuseOutsideSandbox();
  if (refused) return refused;

  const { encounterId } = await readIds();
  if (!encounterId) return { status: "error", errors: [{ code: "setup.no_encounter", message: "Create an encounter first." }] };

  const client = getLithosClient();
  try {
    const current = await client.get<{ status: string }>(`/v1/encounters/${encounterId}`);
    if (current.status === "pending_review") {
      await client.post(`/v1/sandbox/encounters/${encounterId}/start_review`, {});
    }
    // Empty body: approve every requested line and activate the plan.
    await client.post(`/v1/sandbox/encounters/${encounterId}/complete`, {});
  } catch (error) {
    const invalidCompletion = error instanceof LithosApiError && error.errors.some((e) => e.code === "sandbox.completion_invalid");
    return failure(error, invalidCompletion
      ? "An empty completion only works when every requested line names a treatment. A \"clinician's choice\" line needs explicit dosage_ids."
      : undefined);
  }
  revalidatePath("/setup");
  return { status: "ok" };
}

export async function registerWebhookAction(_prev: SetupActionState, formData: FormData): Promise<SetupActionState> {
  const refused = refuseOutsideSandbox();
  if (refused) return refused;

  const base = String(formData.get("public_url") ?? "").trim().replace(/\/+$/, "");
  if (!/^https:\/\//.test(base)) {
    return { status: "error", errors: [{ code: "setup.not_https", message: "Lithos only delivers to https:// URLs — localhost won't work. Use your deployed URL or a tunnel." }] };
  }
  const url = base.endsWith("/api/webhooks/lithos") ? base : `${base}/api/webhooks/lithos`;

  try {
    const created = await getLithosClient().post<{ id: string; url: string; signing_secret: string }>(
      "/v1/webhook_endpoints", webhookEndpointRequest(url),
    );
    revalidatePath("/setup");
    return { status: "secret", endpointId: created.id, url: created.url, signingSecret: created.signing_secret };
  } catch (error) {
    const exists = error instanceof LithosApiError && error.errors.some((e) => e.code === "webhook_endpoint.already_exists");
    return failure(error, exists ? "Your organization already has an active endpoint, and only one is allowed. The step above shows where it points." : undefined);
  }
}

export async function resetSetupAction(): Promise<void> {
  await clearJourneyIds();
  revalidatePath("/setup");
}
