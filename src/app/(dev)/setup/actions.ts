"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLithosClient } from "@/lib/lithos/client";
import { LithosApiError } from "@/lib/lithos/errors";
import type { SetupActionState } from "@/lib/setup/action-state";
import { carePlanRequest, encounterRequest, patientRequest, webhookEndpointRequest } from "@/lib/setup/requests";
import { clearJourneyIds, readJourneyIds as readIds, writeJourneyIds as writeIds } from "@/lib/setup/journey-cookie";
import { formularyHas, isSandbox, readProgramTreatment } from "@/lib/setup/steps";
import { programFor } from "@/lib/setup/programs";
import { signOffAsClinician } from "@/lib/sandbox-review";
import { reachesThisApp } from "@/lib/setup/reachability";
import { saveToEnvLocal } from "@/lib/setup/env-file";

function failure(error: unknown, hint?: string): SetupActionState {
  if (error instanceof LithosApiError) return { status: "error", httpStatus: error.status, errors: error.errors, hint };
  return { status: "error", errors: [{ code: "setup.unexpected", message: error instanceof Error ? error.message : String(error) }], hint };
}

/** Belt and braces: every action re-checks, so a changed env can't slip a write through to production. */
function refuseOutsideSandbox(): SetupActionState | null {
  if (isSandbox(process.env.LITHOS_API_BASE_URL)) return null;
  return { status: "error", errors: [{ code: "setup.not_sandbox", message: "The walkthrough only writes to the Lithos sandbox." }] };
}

/** Step 2: the program this organization will offer. Checked against the live formulary, not just the list. */
export async function chooseProgramAction(_prev: SetupActionState, formData: FormData): Promise<SetupActionState> {
  const program = programFor(String(formData.get("program") ?? ""));
  if (!program) return { status: "error", errors: [{ code: "setup.no_program", message: "Pick a program." }] };
  if (!program.supported) return { status: "error", errors: [{ code: "setup.program_coming_soon", message: `${program.label} is coming soon — this walkthrough runs lipid management for now.` }] };
  try {
    if (!(await formularyHas(program.key))) {
      return { status: "error", errors: [{ code: "setup.program_not_in_formulary", message: `Your organization isn't provisioned for ${program.label.toLowerCase()}. Ask your Lithos contact to add it.` }] };
    }
  } catch (error) {
    return failure(error);
  }
  await writeIds({ ...(await readIds()), program: program.key });
  revalidatePath("/setup");
  return { status: "ok" };
}

/**
 * "Change program" goes back to the choice itself: step 2 returns to the picker
 * and the steps after it wait again. The patient and encounter are kept — they
 * reappear once a program is chosen again.
 */
export async function clearProgramAction(): Promise<void> {
  const { program: _dropped, ...rest } = await readIds();
  await writeIds(rest);
  revalidatePath("/setup");
  // Back to the picker, not the top of the page — with or without JavaScript.
  redirect("/setup#step-program");
}

export async function createPatientAction(): Promise<SetupActionState> {
  const refused = refuseOutsideSandbox();
  if (refused) return refused;

  const now = new Date().toISOString();
  const body = { ...patientRequest(String(Date.now())), telehealth_consented_at: now, identity_verified_at: now };
  try {
    const patient = await getLithosClient().post<{ id: string }>("/v1/patients", body);
    // A new patient starts a new thread: drop any encounter from a previous run,
    // but keep the program — that's a choice about the organization, not the patient.
    const { program } = await readIds();
    await writeIds({ program, patientId: patient.id });
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
  const program = programFor(ids.program);
  if (!program?.supported) return { status: "error", errors: [{ code: "setup.no_program", message: "Choose a program in step 2 first." }] };

  const client = getLithosClient();
  try {
    const treatment = await readProgramTreatment(program.key);
    if (!treatment) return { status: "error", errors: [{ code: "setup.no_treatment", message: `Your formulary has no ${program.label.toLowerCase()} treatment to request.` }] };

    // Reuse a care plan from a run that failed at the encounter, rather than piling up empty plans.
    const carePlanId = ids.carePlanId ?? (await client.post<{ id: string }>("/v1/care_plans", carePlanRequest(ids.patientId, program.key))).id;
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

  try {
    // Shared with the app's care page, so the walkthrough and the site sign off the same way.
    await signOffAsClinician(getLithosClient(), encounterId);
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

  // Prove the address reaches this app before Lithos starts delivering to it —
  // Lithos keeps delivering to a bad address without telling anyone.
  const reach = await reachesThisApp(url.replace(/\/api\/webhooks\/lithos$/, ""));
  if (!reach.ok) return { status: "error", errors: [{ code: "setup.address_unreachable", message: reach.message }] };

  try {
    const created = await getLithosClient().post<{ id: string; url: string; signing_secret: string }>(
      "/v1/webhook_endpoints", webhookEndpointRequest(url),
    );
    revalidatePath("/setup");
    const saved = await saveToEnvLocal("LITHOS_WEBHOOK_SECRET", created.signing_secret);
    return { status: "secret", endpointId: created.id, url: created.url, signingSecret: created.signing_secret, saved };
  } catch (error) {
    const exists = error instanceof LithosApiError && error.errors.some((e) => e.code === "webhook_endpoint.already_exists");
    return failure(error, exists ? "Your organization already has an active endpoint, and only one is allowed. The step above shows where it points." : undefined);
  }
}

/**
 * Point the organization's one webhook endpoint at a new address. Lithos allows
 * a single active endpoint, and disabling is one-way — so this disables the
 * current one and registers the new address, which issues a new signing secret.
 * Needed more often than it sounds: a free tunnel's URL changes every restart.
 */
export async function repointWebhookAction(_prev: SetupActionState, formData: FormData): Promise<SetupActionState> {
  const refused = refuseOutsideSandbox();
  if (refused) return refused;

  if (formData.get("confirm_repoint") !== "on") {
    return { status: "error", errors: [{ code: "setup.confirm_repoint", message: "Tick the box to confirm the current endpoint will stop receiving deliveries." }] };
  }
  const currentId = String(formData.get("current_endpoint_id") ?? "");
  const base = String(formData.get("public_url") ?? "").trim().replace(/\/+$/, "");
  if (!/^https:\/\//.test(base)) {
    return { status: "error", errors: [{ code: "setup.not_https", message: "Lithos only delivers to https:// URLs — localhost won't work. Use your deployed URL or a tunnel." }] };
  }
  const url = base.endsWith("/api/webhooks/lithos") ? base : `${base}/api/webhooks/lithos`;

  // Check first: disabling the current endpoint is one-way, so never trade a
  // working address for one that doesn't reach this app.
  const reach = await reachesThisApp(url.replace(/\/api\/webhooks\/lithos$/, ""));
  if (!reach.ok) return { status: "error", errors: [{ code: "setup.address_unreachable", message: reach.message }] };

  const client = getLithosClient();
  try {
    await client.post(`/v1/webhook_endpoints/${currentId}/disable`, {});
    const created = await client.post<{ id: string; url: string; signing_secret: string }>("/v1/webhook_endpoints", webhookEndpointRequest(url));
    revalidatePath("/setup");
    const saved = await saveToEnvLocal("LITHOS_WEBHOOK_SECRET", created.signing_secret);
    return { status: "secret", endpointId: created.id, url: created.url, signingSecret: created.signing_secret, saved };
  } catch (error) {
    return failure(error, "If the old endpoint was disabled but the new one failed, your organization now has no active endpoint — register one in step 6.");
  }
}

export async function resetSetupAction(): Promise<void> {
  // "Run again with new patient" forgets the patient and encounter, not the program.
  const { program } = await readIds();
  await clearJourneyIds();
  if (program) await writeIds({ program });
  revalidatePath("/setup");
  // Land on step 3, where the new run starts. A redirect to the anchor works
  // with or without JavaScript — the browser scrolls to it either way.
  redirect("/setup#step-patient");
}
