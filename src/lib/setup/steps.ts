/**
 * The setup walkthrough's step engine.
 *
 * One rule governs this file: **a step is done when the API says so, never
 * because someone clicked.** Every state below is derived from a live call —
 * a token mint, a GET, the webhook delivery log — so the checklist can't drift
 * from reality, and a prospect who does a step by hand (curl, their own code)
 * sees it tick over just the same.
 *
 * Nothing here reports anywhere. Every step already touches Lithos's API, so
 * Lithos can measure the funnel from its own side; a reference app that phoned
 * home would be the wrong thing to hand a prospect evaluating a health vendor.
 */

import { getEventStore } from "../events/factory";
import { readWebhookAttempts } from "../webhooks/attempts";
import { getLithosClient } from "../lithos/client";
import { LithosApiError } from "../lithos/errors";
import type { ApiError } from "../lithos/types";

export type StepKey =
  | "credentials" | "token" | "organization" | "patient"
  | "encounter" | "review" | "webhook_endpoint" | "webhook_received";

export type StepStatus = "done" | "ready" | "blocked" | "locked";

/** A real exchange with Lithos, shown next to the step so the prospect sees the call they'll write. */
export type Exchange = {
  method: "GET" | "POST";
  path: string;
  status?: number;
  response?: unknown;
};

/** When something is wrong: what, and exactly what to do about it. */
export type Diagnosis = { title: string; fix: string };

export type StepState = {
  key: StepKey;
  status: StepStatus;
  summary: string;
  exchange?: Exchange;
  diagnosis?: Diagnosis;
};

/** Ids the walkthrough has created, carried in a cookie so a reload doesn't lose the thread. */
export type JourneyIds = { patientId?: string; carePlanId?: string; encounterId?: string };

type CatalogTreatment = { id: string; name: string; categories?: string[]; status?: string };
type WebhookEndpoint = { id: string; url: string; status: string; last_success_at: string | null };
type WebhookDelivery = {
  id: string; status: string; event_type: string; resource_id: string; last_response_code: number | null;
  last_error_class: string | null; created_at: string;
};

const REQUIRED_ENV = ["LITHOS_API_BASE_URL", "LITHOS_TOKEN_URL", "LITHOS_CLIENT_ID", "LITHOS_CLIENT_SECRET"] as const;

/** The walkthrough creates patients. It must never do that against production. */
export function isSandbox(baseUrl: string | undefined): boolean {
  return Boolean(baseUrl && /\/\/api\.sandbox\./.test(baseUrl));
}

function redactToken(body: unknown): unknown {
  if (typeof body !== "object" || body === null) return body;
  const copy = { ...(body as Record<string, unknown>) };
  if (typeof copy.access_token === "string") copy.access_token = `${copy.access_token.slice(0, 12)}… (redacted)`;
  return copy;
}

function errorCodes(error: unknown): string[] {
  return error instanceof LithosApiError ? error.errors.map((e: ApiError) => e.code) : [];
}

function exchangeFromError(method: "GET" | "POST", path: string, error: unknown): Exchange {
  if (error instanceof LithosApiError) return { method, path, status: error.status, response: { errors: error.errors } };
  return { method, path, response: { error: error instanceof Error ? error.message : String(error) } };
}

// ---------------------------------------------------------------- 1. credentials

function checkCredentials(): StepState {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    return {
      key: "credentials", status: "blocked",
      summary: `Missing ${missing.join(", ")}.`,
      diagnosis: {
        title: "Your Lithos sandbox credentials aren't configured",
        fix: "Copy .env.example to .env.local and fill in the four LITHOS_ values you were sent, then restart `npm run dev`. No credentials yet? Ask your Lithos contact for a sandbox organization — it takes minutes once someone is on it.",
      },
    };
  }
  if (!isSandbox(process.env.LITHOS_API_BASE_URL)) {
    return {
      key: "credentials", status: "blocked",
      summary: `LITHOS_API_BASE_URL is ${process.env.LITHOS_API_BASE_URL}.`,
      diagnosis: {
        title: "This walkthrough only runs against the sandbox",
        fix: "It creates sample patients and drives clinician reviews, so it refuses anything but https://api.sandbox.lithoshealth.com. Point LITHOS_API_BASE_URL and LITHOS_TOKEN_URL at the sandbox.",
      },
    };
  }
  return { key: "credentials", status: "done", summary: `Sandbox, client ${process.env.LITHOS_CLIENT_ID!.slice(0, 18)}…` };
}

// ---------------------------------------------------------------- 2. token

/**
 * Mints directly rather than through TokenManager, because the walkthrough
 * needs the raw status and body to explain a failure — TokenManager, rightly,
 * only throws.
 */
async function checkToken(): Promise<StepState> {
  const path = "/v1/oauth2/token";
  try {
    const response = await fetch(process.env.LITHOS_TOKEN_URL!, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.LITHOS_CLIENT_ID!,
        client_secret: process.env.LITHOS_CLIENT_SECRET!,
      }),
      cache: "no-store",
    });
    const body: unknown = await response.json().catch(() => undefined);
    const exchange: Exchange = { method: "POST", path, status: response.status, response: redactToken(body) };
    if (response.ok) {
      const expires = (body as { expires_in?: number })?.expires_in;
      return { key: "token", status: "done", summary: `Token minted${expires ? `, valid ${Math.round(expires / 60)} min` : ""}.`, exchange };
    }
    return {
      key: "token", status: "blocked", summary: `Token endpoint answered ${response.status}.`, exchange,
      diagnosis: {
        title: "Lithos rejected your client credentials",
        fix: "Check LITHOS_CLIENT_ID and LITHOS_CLIENT_SECRET for a stray space or a truncated paste. The secret is shown once when your organization is provisioned — if it's lost, ask for it to be rotated rather than re-sent.",
      },
    };
  } catch (error) {
    return {
      key: "token", status: "blocked", summary: "Couldn't reach the token endpoint.",
      exchange: exchangeFromError("POST", path, error),
      diagnosis: { title: "The token URL didn't answer", fix: "Check LITHOS_TOKEN_URL is https://api.sandbox.lithoshealth.com/v1/oauth2/token and that you're online." },
    };
  }
}

// ---------------------------------------------------------------- 3. organization

export async function readLipidTreatment(): Promise<CatalogTreatment | undefined> {
  const catalog = await getLithosClient().get<{ data: CatalogTreatment[] }>("/v1/catalog_treatments");
  return catalog.data.find((t) => t.status !== "inactive" && t.categories?.includes("lipid_management"));
}

async function checkOrganization(): Promise<StepState> {
  const path = "/v1/catalog_treatments";
  try {
    const catalog = await getLithosClient().get<{ data: CatalogTreatment[] }>(path);
    const exchange: Exchange = {
      method: "GET", path, status: 200,
      response: { data: catalog.data.map((t) => ({ id: t.id, name: t.name, categories: t.categories })) },
    };
    if (catalog.data.length === 0) {
      return {
        key: "organization", status: "blocked", summary: "Your formulary is empty.", exchange,
        diagnosis: {
          title: "Your organization exists but no programs are switched on",
          fix: "Provisioning chooses which treatments you can prescribe, and none were chosen. Ask your Lithos contact to add a formulary — this walkthrough needs a lipid management treatment.",
        },
      };
    }
    const lipid = catalog.data.filter((t) => t.categories?.includes("lipid_management"));
    if (lipid.length === 0) {
      return {
        key: "organization", status: "blocked",
        summary: `${catalog.data.length} treatments, none for lipid management.`, exchange,
        diagnosis: {
          title: "This walkthrough uses the lipid management program, and yours doesn't include it",
          fix: "Your organization is working — it just isn't set up for the program this walkthrough demonstrates. Ask your Lithos contact to add a lipid treatment to your sandbox formulary.",
        },
      };
    }
    return {
      key: "organization", status: "done",
      summary: `${catalog.data.length} treatments available — lipid: ${lipid.map((t) => t.name).join(", ")}.`, exchange,
    };
  } catch (error) {
    const codes = errorCodes(error);
    return {
      key: "organization", status: "blocked", summary: "The first API call failed.",
      exchange: exchangeFromError("GET", path, error),
      diagnosis: codes.includes("auth.org_not_provisioned")
        ? {
            title: "Your credentials aren't attached to a Lithos organization",
            fix: "The token is valid, but it doesn't name an organization Lithos knows about — usually because the client was created in WorkOS directly. Provisioning has to go through Lithos (the ops wizard creates both halves together). Send your Lithos contact this error code.",
          }
        : { title: "The API refused the call", fix: "The error above names the code; your Lithos contact can look it up by the request id in `meta`." },
    };
  }
}

// ---------------------------------------------------------------- 4–6. patient, encounter, review

async function checkPatient(ids: JourneyIds): Promise<StepState> {
  if (!ids.patientId) return { key: "patient", status: "ready", summary: "No patient yet." };
  const path = `/v1/patients/${ids.patientId}`;
  try {
    const patient = await getLithosClient().get<{ id: string; first_name: string; last_name: string }>(path);
    return { key: "patient", status: "done", summary: `${patient.first_name} ${patient.last_name} — ${patient.id}`, exchange: { method: "GET", path, status: 200, response: patient } };
  } catch (error) {
    return { key: "patient", status: "ready", summary: "The patient this walkthrough made can't be read — start again.", exchange: exchangeFromError("GET", path, error) };
  }
}

type EncounterRead = { id: string; status: string; care_plan: { status: string }; requested_treatments: unknown[]; patient_message: unknown };

async function readEncounter(ids: JourneyIds): Promise<{ encounter?: EncounterRead; exchange?: Exchange }> {
  if (!ids.encounterId) return {};
  const path = `/v1/encounters/${ids.encounterId}`;
  try {
    const encounter = await getLithosClient().get<EncounterRead>(path);
    return { encounter, exchange: { method: "GET", path, status: 200, response: encounter } };
  } catch (error) {
    return { exchange: exchangeFromError("GET", path, error) };
  }
}

function checkEncounter(ids: JourneyIds, read: { encounter?: EncounterRead; exchange?: Exchange }, patientDone: boolean): StepState {
  if (!patientDone) return { key: "encounter", status: "locked", summary: "Needs a patient first." };
  if (!ids.encounterId) return { key: "encounter", status: "ready", summary: "No encounter yet." };
  if (!read.encounter) return { key: "encounter", status: "ready", summary: "The encounter can't be read — create another.", exchange: read.exchange };
  return { key: "encounter", status: "done", summary: `${read.encounter.id} — ${read.encounter.status.replace("_", " ")}`, exchange: read.exchange };
}

function checkReview(read: { encounter?: EncounterRead; exchange?: Exchange }): StepState {
  if (!read.encounter) return { key: "review", status: "locked", summary: "Needs an encounter first." };
  if (read.encounter.status === "completed") {
    return {
      key: "review", status: "done",
      summary: `Signed off — care plan ${read.encounter.care_plan.status}.`,
      exchange: read.exchange,
    };
  }
  return { key: "review", status: "ready", summary: `Encounter is ${read.encounter.status.replace("_", " ")}, waiting for a clinician.` };
}

// ---------------------------------------------------------------- 7–8. webhooks

async function readEndpoint(): Promise<{ endpoint?: WebhookEndpoint; exchange: Exchange }> {
  const path = "/v1/webhook_endpoints";
  try {
    const list = await getLithosClient().get<{ data: WebhookEndpoint[] }>(path);
    return { endpoint: list.data.find((e) => e.status === "active"), exchange: { method: "GET", path, status: 200, response: list } };
  } catch (error) {
    return { exchange: exchangeFromError("GET", path, error) };
  }
}

function checkEndpoint(read: { endpoint?: WebhookEndpoint; exchange: Exchange }, thisHost: string | null): StepState {
  if (!read.endpoint) {
    return { key: "webhook_endpoint", status: "ready", summary: "No webhook endpoint registered.", exchange: read.exchange };
  }
  const pointsHere = thisHost ? read.endpoint.url.includes(thisHost) : false;
  return {
    key: "webhook_endpoint", status: "done",
    summary: `Registered: ${read.endpoint.url}`, exchange: read.exchange,
    diagnosis: pointsHere || !thisHost ? undefined : {
      title: "Your endpoint points somewhere other than this app",
      fix: `Lithos will deliver to ${read.endpoint.url}, but you're viewing this on ${thisHost}. That's fine if that's your deployed copy — open /setup there to see deliveries arrive. Your organization can have one active endpoint at a time.`,
    },
  };
}

/**
 * Done only when an event about *this walkthrough's* patient, care plan or
 * encounter has been verified here. Counting "any event in the store" was the
 * first version, and it lied: a store holding old or replayed events reported
 * success before this walkthrough had caused a single delivery.
 */
async function checkReceived(ids: JourneyIds, endpoint: WebhookEndpoint | undefined, thisHost: string | null): Promise<StepState> {
  if (!endpoint) return { key: "webhook_received", status: "locked", summary: "Needs a registered endpoint first." };
  if (!ids.encounterId) {
    return { key: "webhook_received", status: "locked", summary: "Deliveries follow real events — create the encounter first." };
  }
  const ours = new Set([ids.patientId, ids.carePlanId, ids.encounterId].filter(Boolean) as string[]);

  let receivedHere = 0;
  try {
    const events = await getEventStore().list(200);
    receivedHere = events.filter((e) => typeof e.payload.resource_id === "string" && ours.has(e.payload.resource_id)).length;
  } catch {
    /* no event store on this deployment — Lithos's delivery log below still tells the story */
  }
  if (receivedHere > 0) {
    return {
      key: "webhook_received", status: "done",
      summary: `${receivedHere} event${receivedHere === 1 ? "" : "s"} about your encounter delivered, signature verified, stored.`,
    };
  }

  const path = "/v1/webhook_deliveries?limit=25";
  let deliveries: WebhookDelivery[] = [];
  let exchange: Exchange | undefined;
  try {
    const list = await getLithosClient().get<{ data: WebhookDelivery[] }>(path);
    deliveries = list.data.filter((d) => ours.has(d.resource_id));
    exchange = {
      method: "GET", path, status: 200,
      response: { data: deliveries.map(({ id, status, event_type, resource_id, last_response_code, last_error_class }) => ({ id, status, event_type, resource_id, last_response_code, last_error_class })) },
    };
  } catch (error) {
    exchange = exchangeFromError("GET", path, error);
  }

  if (deliveries.length === 0) {
    return {
      key: "webhook_received", status: "ready", summary: "Lithos hasn't delivered anything about your encounter yet.", exchange,
      diagnosis: diagnoseDelivery(undefined, readWebhookAttempts()),
    };
  }

  // Lithos delivered successfully, just not to this copy of the app.
  const pointsHere = thisHost ? endpoint.url.includes(thisHost) : false;
  if (deliveries.some((d) => d.status === "succeeded") && !pointsHere) {
    return {
      key: "webhook_received", status: "ready",
      summary: `Lithos delivered ${deliveries.length} event${deliveries.length === 1 ? "" : "s"} about your encounter — to ${endpoint.url}.`,
      exchange,
      diagnosis: {
        title: "Delivered, but to another copy of this app",
        fix: `Lithos's log shows the delivery succeeded, so your endpoint works. It went to ${endpoint.url}, not to ${thisHost}. Open /setup on that deployment to see it verified there — or run this copy behind a tunnel and register that URL instead.`,
      },
    };
  }

  const failing = deliveries.find((d) => d.status !== "succeeded" && d.last_response_code !== null);
  return {
    key: "webhook_received", status: failing ? "blocked" : "ready",
    summary: `Lithos has attempted ${deliveries.length} deliver${deliveries.length === 1 ? "y" : "ies"} about your encounter; this app has verified none.`,
    exchange,
    diagnosis: diagnoseDelivery(failing, readWebhookAttempts()),
  };
}

/**
 * Turns "Lithos got a 401" into the actual cause. The distinguishing fact is
 * whether *this app* saw the attempt — Lithos can't know that, and it's the
 * whole difference between a wrong secret and a request that never arrived.
 */
function diagnoseDelivery(failing: WebhookDelivery | undefined, attempts: ReturnType<typeof readWebhookAttempts>): Diagnosis | undefined {
  if (!failing) {
    return {
      title: "Nothing has been delivered yet",
      fix: "Deliveries follow real events — create the encounter and drive the review above, and each step fires one. Webhooks need a public HTTPS URL: localhost can't receive them. Deploy this app, or run a tunnel (e.g. `cloudflared tunnel --url http://localhost:3001`) and register that URL.",
    };
  }
  const code = failing.last_response_code;
  const sawSignatureFailure = (attempts.byOutcome.invalid_signature ?? 0) > 0;
  const sawUnconfigured = (attempts.byOutcome.webhook_not_configured ?? 0) > 0;

  if (code === 401 && attempts.total === 0) {
    return {
      title: "Lithos is getting a 401 — and it isn't coming from this app",
      fix: "This app has seen no delivery attempts at all, so something in front of it is answering. On Vercel that is almost always Deployment Protection, which is on by default for new projects and returns a 401 that looks exactly like a signature failure. Turn it off for production in Project Settings → Deployment Protection, then wait for the retry.",
    };
  }
  if (code === 401 && sawSignatureFailure) {
    return {
      title: "Deliveries reach this app, but the signature doesn't verify",
      fix: "LITHOS_WEBHOOK_SECRET doesn't match the endpoint's signing secret. It's shown once, when the endpoint is registered — if it's lost, disable the endpoint and register a new one, then restart the app with the new secret.",
    };
  }
  if (code === 503 && sawUnconfigured) {
    return { title: "This app has no signing secret", fix: "Set LITHOS_WEBHOOK_SECRET to the secret shown when you registered the endpoint, and restart. The app refuses every delivery until it can verify them — deliberately." };
  }
  if (code === 404) {
    return { title: "Lithos is posting to a path that doesn't exist", fix: "The registered URL must end in /api/webhooks/lithos." };
  }
  return {
    title: `Lithos's last delivery got HTTP ${code ?? "no response"}`,
    fix: `This app has recorded ${attempts.total} attempt${attempts.total === 1 ? "" : "s"}${attempts.last ? `, the last ${attempts.last.outcome.replace(/_/g, " ")}` : ""}. Check the registered URL points at this deployment.`,
  };
}

// ---------------------------------------------------------------- the whole checklist

/**
 * Evaluate every step in order. A blocked step stops the ones after it from
 * being evaluated — there's no point minting a token with no credentials, and
 * the error it would produce would only bury the real one.
 */
export async function evaluateSetup(ids: JourneyIds, thisHost: string | null): Promise<StepState[]> {
  const steps: StepState[] = [];
  const lockedFrom = (keys: StepKey[], reason: string) =>
    keys.forEach((key) => steps.push({ key, status: "locked", summary: reason }));

  const credentials = checkCredentials();
  steps.push(credentials);
  if (credentials.status !== "done") {
    lockedFrom(["token", "organization", "patient", "encounter", "review", "webhook_endpoint", "webhook_received"], "Waiting on credentials.");
    return steps;
  }

  const token = await checkToken();
  steps.push(token);
  if (token.status !== "done") {
    lockedFrom(["organization", "patient", "encounter", "review", "webhook_endpoint", "webhook_received"], "Waiting on a token.");
    return steps;
  }

  const organization = await checkOrganization();
  steps.push(organization);
  if (organization.status !== "done") {
    lockedFrom(["patient", "encounter", "review", "webhook_endpoint", "webhook_received"], "Waiting on your organization.");
    return steps;
  }

  const patient = await checkPatient(ids);
  steps.push(patient);
  const encounterRead = await readEncounter(ids);
  steps.push(checkEncounter(ids, encounterRead, patient.status === "done"));
  steps.push(checkReview(encounterRead));

  const endpointRead = await readEndpoint();
  const endpoint = checkEndpoint(endpointRead, thisHost);
  steps.push(endpoint);
  steps.push(await checkReceived(ids, endpointRead.endpoint, thisHost));

  return steps;
}
