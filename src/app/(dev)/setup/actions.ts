"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLithosClient } from "@/lib/lithos/client";
import { LithosApiError } from "@/lib/lithos/errors";
import { CLIENT_ID_MASK, maskCredential, type SetupActionState } from "@/lib/setup/action-state";
import type { ApiError } from "@/lib/lithos/types";
import { carePlanRequest, encounterRequest, patientRequest, webhookEndpointRequest } from "@/lib/setup/requests";
import { clearJourneyIds, readJourneyIds as readIds, writeJourneyIds as writeIds } from "@/lib/setup/journey-cookie";
import { formularyHas, isSandbox, readProgramTreatment } from "@/lib/setup/steps";
import { programFor, type ProgramKey } from "@/lib/setup/programs";
import { askPatientAsClinician, declineAsClinician, signOffAsClinician } from "@/lib/sandbox-review";
import { reachesThisApp } from "@/lib/setup/reachability";
import { saveToEnvLocal } from "@/lib/setup/env-file";
import { rememberIssued } from "@/lib/setup/issued-cookie";
import { updateConfig } from "@/lib/starter-config";
import { verifyCredentials } from "@/lib/setup/connect";

function failure(error: unknown, hint?: string): SetupActionState {
  if (error instanceof LithosApiError) return { status: "error", httpStatus: error.status, errors: error.errors, hint };
  return { status: "error", errors: [{ code: "setup.unexpected", message: error instanceof Error ? error.message : String(error) }], hint };
}

/** Belt and braces: every action re-checks, so a changed env can't slip a write through to production. */
function refuseOutsideSandbox(): SetupActionState | null {
  if (isSandbox(process.env.LITHOS_API_BASE_URL)) return null;
  return { status: "error", errors: [{ code: "setup.not_sandbox", message: "The walkthrough only writes to the Lithos sandbox." }] };
}

/** A new sample patient requesting care: the three calls step 3 and the intake make. */
async function requestCare(program: ProgramKey, treatmentId: string): Promise<{ patientId: string; carePlanId: string; encounterId: string }> {
  const client = getLithosClient();
  const now = new Date().toISOString();
  const patientId = (await client.post<{ id: string }>("/v1/patients", { ...patientRequest(String(Date.now())), telehealth_consented_at: now, identity_verified_at: now })).id;
  const carePlanId = (await client.post<{ id: string }>("/v1/care_plans", carePlanRequest(patientId, program))).id;
  const encounterId = (await client.post<{ id: string }>("/v1/encounters", encounterRequest(program, patientId, carePlanId, treatmentId))).id;
  return { patientId, carePlanId, encounterId };
}

const SANDBOX_URLS = {
  LITHOS_API_BASE_URL: "https://api.sandbox.lithoshealth.com",
  LITHOS_TOKEN_URL: "https://api.sandbox.lithoshealth.com/v1/oauth2/token",
};

/**
 * Step 1: connect, from the page rather than the terminal.
 *
 * The starter is meant to be opened and walked around before it's configured,
 * so the credentials belong at the moment the reader hits the wall — not in a
 * terminal prompt before they've seen the app. Development only: it writes
 * .env.local, which a deployed copy doesn't have (there the step shows the
 * variables to set in the host's environment settings instead).
 *
 * Nothing is written until Lithos has accepted the pair, so a typo can't leave
 * a half-connected app behind.
 */
export async function connectAction(_prev: SetupActionState, formData: FormData): Promise<SetupActionState> {
  if (process.env.NODE_ENV !== "development") {
    return { status: "error", errors: [{ code: "setup.not_development", message: "A deployed copy has no .env.local to write. Set the variables in your host's environment settings, then redeploy." }] };
  }

  const clientId = String(formData.get("client_id") ?? "").trim();
  const clientSecret = String(formData.get("client_secret") ?? "").trim();
  if (!clientId || !clientSecret) {
    return { status: "error", errors: [{ code: "setup.missing_credentials", message: "Paste both the client ID and the client secret." }] };
  }

  // Keep whatever URLs are already set — someone pointed them at the sandbox on
  // purpose — and fill in the sandbox defaults when there are none.
  const baseUrl = process.env.LITHOS_API_BASE_URL || SANDBOX_URLS.LITHOS_API_BASE_URL;
  const tokenUrl = process.env.LITHOS_TOKEN_URL || SANDBOX_URLS.LITHOS_TOKEN_URL;

  return checkAndSave({ baseUrl, tokenUrl, clientId, clientSecret });
}

/**
 * Proves a client ID and secret with Lithos, then writes all four values to
 * .env.local. `refresh: false` leaves the page as it is — the signup path
 * shows what it just created before step 1 turns to done.
 */
async function checkAndSave(
  creds: { baseUrl: string; tokenUrl: string; clientId: string; clientSecret: string },
  { refresh = true }: { refresh?: boolean } = {},
): Promise<SetupActionState> {
  const checked = await verifyCredentials(creds);
  if (!checked.ok) return { status: "error", errors: [{ code: "setup.credentials_rejected", message: checked.message }] };

  for (const [name, value] of [
    ["LITHOS_API_BASE_URL", creds.baseUrl], ["LITHOS_TOKEN_URL", creds.tokenUrl],
    ["LITHOS_CLIENT_ID", creds.clientId], ["LITHOS_CLIENT_SECRET", creds.clientSecret],
  ]) {
    if (!(await saveToEnvLocal(name, value))) {
      return { status: "error", errors: [{ code: "setup.env_write_failed", message: `Couldn't write ${name} to .env.local. Check the folder is writable, or run npm run setup in a terminal.` }] };
    }
  }

  if (refresh) revalidatePath("/setup");
  return { status: "connected", treatments: checked.treatments };
}

/**
 * Step 1, the other way in: get sandbox credentials here and now. Lithos's
 * sandbox creates a new organization with every program for an email and a
 * company name, and returns its client ID and secret — once, in this response,
 * which goes straight into .env.local. The browser never sees the secret.
 * Unauthenticated by design; the sandbox limits it per email and per address.
 */
export async function getSandboxCredentialsAction(_prev: SetupActionState, formData: FormData): Promise<SetupActionState> {
  if (process.env.NODE_ENV !== "development") {
    return { status: "error", errors: [{ code: "setup.not_development", message: "A deployed copy has no .env.local to write. Get credentials from a local copy, then set them in your host's environment settings." }] };
  }
  const email = String(formData.get("email") ?? "").trim();
  const organizationName = String(formData.get("organization_name") ?? "").trim();
  if (!email || !organizationName) {
    return { status: "error", errors: [{ code: "setup.missing_signup", message: "Enter your email and your company's name." }] };
  }

  const baseUrl = process.env.LITHOS_API_BASE_URL || SANDBOX_URLS.LITHOS_API_BASE_URL;
  if (!isSandbox(baseUrl)) return { status: "error", errors: [{ code: "setup.not_sandbox", message: "Self-signup exists only on the Lithos sandbox." }] };

  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/sandbox/signups`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, organization_name: organizationName }),
      cache: "no-store",
    });
  } catch {
    return { status: "error", errors: [{ code: "setup.unreachable", message: `Couldn't reach ${baseUrl}. Are you online?` }] };
  }

  const body = (await response.json().catch(() => null)) as
    | { data?: { organization: { id: string; name: string }; client_id: string; client_secret: string; token_url: string; api_base_url: string }; errors?: ApiError[] }
    | null;
  if (response.status === 404) {
    return { status: "error", httpStatus: 404, errors: [{ code: "setup.signup_unavailable", message: "This sandbox doesn't offer self-signup yet. Paste the credentials your Lithos contact sent instead." }] };
  }
  if (!response.ok || !body?.data) {
    return { status: "error", httpStatus: response.status, errors: body?.errors?.length ? body.errors : [{ code: "setup.signup_failed", message: `Lithos answered ${response.status}.` }] };
  }

  // api_base_url ends in /v1; the app's base URL is the host.
  const saved = await checkAndSave({
    baseUrl: body.data.api_base_url.replace(/\/v1\/?$/, ""),
    tokenUrl: body.data.token_url,
    clientId: body.data.client_id,
    clientSecret: body.data.client_secret,
  }, { refresh: false });
  if (saved.status !== "connected") return saved;
  // What was just made, masked here: the full values stay on the server.
  const issued = {
    organizationName: body.data.organization.name,
    organizationId: body.data.organization.id,
    clientIdMasked: maskCredential(body.data.client_id, CLIENT_ID_MASK),
    clientSecretMasked: maskCredential(body.data.client_secret, { head: 0, tail: 4 }),
  };
  // Writing .env.local reloads the page in development; step 1 reads this back.
  await rememberIssued(issued);
  return { ...saved, issued };
}

/** Step 2: the program this organization will offer. Checked against the live formulary, not just the list. */
export async function chooseProgramAction(_prev: SetupActionState, formData: FormData): Promise<SetupActionState> {
  const program = programFor(String(formData.get("program") ?? ""));
  if (!program) return { status: "error", errors: [{ code: "setup.no_program", message: "Pick a program." }] };
  try {
    if (!(await formularyHas(program.key))) {
      return { status: "error", errors: [{ code: "setup.program_not_in_formulary", message: `Your organization isn't provisioned for ${program.label.toLowerCase()}. Ask your Lithos contact to add it.` }] };
    }
  } catch (error) {
    return failure(error);
  }
  if (!(await updateConfig({ program: program.key }))) {
    return { status: "error", errors: [{ code: "setup.config_write_failed", message: "Couldn't save the program to starter.config.json. On a deployed copy, change it in a local copy and redeploy." }] };
  }
  // The program changes what every page says, not just this one.
  revalidatePath("/", "layout");
  return { status: "ok" };
}

/**
 * "Change program" goes back to the choice itself: step 2 returns to the picker
 * and the steps after it wait again. The patient and encounter are kept — they
 * reappear once a program is chosen again.
 */
export async function clearProgramAction(): Promise<void> {
  await updateConfig({ program: null });
  revalidatePath("/", "layout");
  // Back to the picker, not the top of the page — with or without JavaScript.
  redirect("/setup#step-program");
}

/**
 * Step 3's shortcut: onboard a sample patient without filling in the intake —
 * the same three calls the intake makes (patient, care plan, encounter), with
 * sample answers. Picks up where a half-finished run stopped (a patient with
 * no care requested yet) rather than creating another.
 */
export async function onboardSamplePatientAction(): Promise<SetupActionState> {
  const refused = refuseOutsideSandbox();
  if (refused) return refused;

  const ids = await readIds();
  const program = programFor(ids.program);
  if (!program?.supported) return { status: "error", errors: [{ code: "setup.no_program", message: "Choose a program in step 2 first." }] };

  const client = getLithosClient();
  try {
    const treatment = await readProgramTreatment(program.key);
    if (!treatment) return { status: "error", errors: [{ code: "setup.no_treatment", message: `Your formulary has no ${program.label.toLowerCase()} treatment to request.` }] };

    let { patientId, carePlanId } = ids;
    if (!patientId || ids.encounterId) {
      const now = new Date().toISOString();
      const body = { ...patientRequest(String(Date.now())), telehealth_consented_at: now, identity_verified_at: now };
      patientId = (await client.post<{ id: string }>("/v1/patients", body)).id;
      carePlanId = undefined;
      await writeIds({ patientId });
    }
    carePlanId ??= (await client.post<{ id: string }>("/v1/care_plans", carePlanRequest(patientId, program.key))).id;
    await writeIds({ patientId, carePlanId });

    const encounter = await client.post<{ id: string }>("/v1/encounters", encounterRequest(program.key, patientId, carePlanId, treatment.id));
    await writeIds({ patientId, carePlanId, encounterId: encounter.id });
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

/** Step 4, "Decline": the plan becomes ineligible (`criteria_not_met`). */
export async function declineReviewAction(): Promise<SetupActionState> {
  const refused = refuseOutsideSandbox();
  if (refused) return refused;
  const { encounterId } = await readIds();
  if (!encounterId) return { status: "error", errors: [{ code: "setup.no_encounter", message: "Onboard a patient in step 3 first." }] };
  try {
    await declineAsClinician(getLithosClient(), encounterId);
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/setup");
  return { status: "ok" };
}

/** The longest question the escalate call accepts. */
const QUESTION_MAX = 10_000;

/**
 * Step 5, "Ask a patient a question": a new sample patient requests care, and
 * the clinician — played here, as in step 4 — asks them a question before
 * deciding. Lithos turns that into an inquiry and tells the app by webhook;
 * step 5 then shows what the app does with it. Its own patient, so the one
 * from steps 3–4 keeps whatever was decided about it.
 */
export async function askNewPatientAction(_prev: SetupActionState, formData: FormData): Promise<SetupActionState> {
  const refused = refuseOutsideSandbox();
  if (refused) return refused;
  const question = String(formData.get("question") ?? "").trim();
  if (!question) return { status: "error", errors: [{ code: "setup.empty_question", message: "Write the clinician's question first." }] };
  if (question.length > QUESTION_MAX) return { status: "error", errors: [{ code: "setup.question_too_long", message: `Keep the question under ${QUESTION_MAX.toLocaleString()} characters.` }] };

  const ids = await readIds();
  const program = programFor(ids.program);
  if (!program?.supported) return { status: "error", errors: [{ code: "setup.no_program", message: "Choose a program in step 2 first." }] };

  const client = getLithosClient();
  try {
    const treatment = await readProgramTreatment(program.key);
    if (!treatment) return { status: "error", errors: [{ code: "setup.no_treatment", message: `Your formulary has no ${program.label.toLowerCase()} treatment to request.` }] };
    const journey = await requestCare(program.key, treatment.id);
    await writeIds({ ...ids, questionPatientId: journey.patientId, questionEncounterId: journey.encounterId });
    await askPatientAsClinician(client, journey.encounterId, question);
  } catch (error) {
    return failure(error);
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
    return failure(error, "If the old endpoint was disabled but the new one failed, your organization now has no active endpoint — register one in step 5.");
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

/**
 * Step 5's inbox: relay the patient's answer to the clinician's question —
 * `POST /v1/inquiries/{id}/messages`, the call a partner makes when a patient
 * replies in their app. The thread then waits on the clinician (step 4).
 */
export async function replyToQuestionAction(_prev: SetupActionState, formData: FormData): Promise<SetupActionState> {
  const refused = refuseOutsideSandbox();
  if (refused) return refused;
  const inquiryId = String(formData.get("inquiry_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!/^inq_/.test(inquiryId)) return { status: "error", errors: [{ code: "setup.no_inquiry", message: "No question to reply to." }] };
  if (!body) return { status: "error", errors: [{ code: "setup.empty_reply", message: "Write your patient's reply first." }] };
  try {
    await getLithosClient().post(`/v1/inquiries/${inquiryId}/messages`, { body });
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/setup");
  return { status: "ok" };
}
