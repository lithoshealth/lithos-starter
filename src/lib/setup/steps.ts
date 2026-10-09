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
import { reachesThisApp, type Reachability } from "./reachability";
import { readWebhookAttempts } from "../webhooks/attempts";
import { getLithosClient } from "../lithos/client";
import { LithosApiError } from "../lithos/errors";
import type { ApiError } from "../lithos/types";
import { PROGRAMS, programFor, type ProgramKey, type ProgramOption } from "./programs";
import { isSandboxBaseUrl as isSandbox } from "@/lib/lithos/sandbox";

export type StepKey = "connect" | "program" | "updates";

/**
 * "Connect" is one step with three checks. Adding credentials is the only thing
 * a person does; minting a token and reading the formulary are how the app
 * proves it worked. They used to be steps 2 and 3, which went green the moment
 * step 1 did — steps nobody took.
 */
type ConnectCheckKey = "credentials" | "token" | "organization";

export type ConnectCheck = {
  key: ConnectCheckKey;
  label: string;
  status: "done" | "blocked" | "skipped";
  summary: string;
  exchange?: Exchange;
};

/** What each connection check returns before it's folded into the Connect step. */
type InternalCheck = { key: ConnectCheckKey; status: StepStatus; summary: string; exchange?: Exchange; diagnosis?: Diagnosis; catalog?: CatalogTreatment[] };

export type StepStatus = "done" | "ready" | "blocked" | "locked";

/** A real exchange with Lithos, shown next to the step so the prospect sees the call they'll write. */
export type Exchange = {
  method: "GET" | "POST";
  path: string;
  status?: number;
  response?: unknown;
  /** Anything done to the response before showing it, said plainly. */
  note?: string;
  /** "inbound": Lithos called us (a webhook), rather than us calling Lithos. */
  direction?: "inbound";
};

/** When something is wrong: what, and exactly what to do about it. */
/** When something is wrong: what, and what to do. `command`, if set, is shown as its own copyable block between `fix` and `then`. */
export type Diagnosis = { title: string; fix: string; command?: string; then?: string };

export type StepState = {
  key: StepKey;
  status: StepStatus;
  summary: string;
  exchange?: Exchange;
  /** Further calls the step made, after `exchange` — step 3 makes three. */
  moreExchanges?: Exchange[];
  diagnosis?: Diagnosis;
  /** The webhook endpoint step only: the organization's active endpoint, so the page can offer to re-point it. */
  endpoint?: { id: string; url: string; pointsHere: boolean };
  /** The Connect step only: its three checks, each with its own exchange. */
  checks?: ConnectCheck[];
  /** Not needed to finish the walkthrough — shown as optional, not "your turn". */
  optional?: boolean;
  /** The updates step only: what the app heard about the patient, and the questions waiting on it. */
  feed?: FeedItem[];
  inbox?: QuestionThread[];
  /** The updates step only: whether the webhook setup is complete, and where it stands. */
  setupDone?: boolean;
  endpointSummary?: string;
  /** The Connect step only: the credentials are missing, so the page can offer the form. */
  needsCredentials?: boolean;
  /** The program step only: every program, and what this organization's formulary has for it. */
  programs?: ProgramOption[];
  chosenProgram?: ProgramKey;
};

/** A clinician's question to the patient (an inquiry), as the partner sees it. */
export type QuestionThread = {
  id: string;
  question: string;
  /** The patient's latest reply, relayed by the partner. */
  reply?: string;
  /** Whose turn it is: the patient's (answer it) or the care team's (the clinician reads it). */
  awaiting: "patient" | "staff" | null;
  status: string;
};

/** Ids the walkthrough has created, carried in a cookie so a reload doesn't lose the thread. */
/** What the walkthrough has chosen and created, carried in a cookie so a reload doesn't lose the thread. */
export type JourneyIds = {
  program?: ProgramKey; patientId?: string; carePlanId?: string; encounterId?: string;
  /** Step 5's own patient: a second care request the clinician asks a question about. */
  questionPatientId?: string; questionEncounterId?: string;
};

type CatalogTreatment = {
  id: string; name: string; categories?: string[]; status?: string; brand_name?: string; form?: string;
  dosages?: Array<{ id: string; strength?: string; description?: string; default_days_supply?: number }>;
};
type WebhookEndpoint = { id: string; url: string; status: string; last_success_at: string | null };
type WebhookDelivery = {
  id: string; status: string; event_type: string; resource_id: string; last_response_code: number | null;
  last_error_class: string | null; created_at: string;
};

const REQUIRED_ENV = ["LITHOS_API_BASE_URL", "LITHOS_TOKEN_URL", "LITHOS_CLIENT_ID", "LITHOS_CLIENT_SECRET"] as const;

/** The walkthrough creates patients. It must never do that against production. */
export { isSandbox };

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

function checkCredentials(): InternalCheck {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    // With no .env.local at all, every variable is missing — including the two
    // URLs the template fills in. Listing all four would contradict "the URLs
    // come prefilled", so say what's actually true.
    const noFile = missing.includes("LITHOS_API_BASE_URL") && missing.includes("LITHOS_CLIENT_ID");
    return {
      key: "credentials", status: "blocked",
      summary: noFile ? "none yet" : `missing ${missing.join(", ")}`,
      diagnosis: process.env.NODE_ENV === "development"
        ? {
            title: "Connect this app to your Lithos sandbox",
            fix: "Get sandbox credentials below with your email and company name — a new sandbox organization is created for this app — or paste a client ID and secret you already have. Either way they're checked with Lithos before anything is saved, and written to .env.local, which git ignores.",
            then: "If this starter is your app, use the credentials from your Lithos console: its sandbox checklist then ticks as this app makes the calls. If you're building your own app on that sandbox and only want to see this one working, get new credentials here instead: an organization has one webhook endpoint and one shared set of patients.",
          }
        : {
            title: "Connect this app to your Lithos sandbox",
            fix: "A deployed copy has no .env.local to write, so set these in your host's environment settings, then redeploy:",
            command: "LITHOS_API_BASE_URL=https://api.sandbox.lithoshealth.com\nLITHOS_TOKEN_URL=https://api.sandbox.lithoshealth.com/v1/oauth2/token\nLITHOS_CLIENT_ID=…\nLITHOS_CLIENT_SECRET=…",
            then: "No credentials yet? Get them from a local copy's setup page, which creates a sandbox organization for you.",
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
  return { key: "credentials", status: "done", summary: `sandbox, client ${process.env.LITHOS_CLIENT_ID!.slice(0, 18)}…` };
}

// ---------------------------------------------------------------- 2. token

/**
 * Mints directly rather than through TokenManager, because the walkthrough
 * needs the raw status and body to explain a failure — TokenManager, rightly,
 * only throws.
 */
/**
 * A successful token check is reused for a few minutes. The setup page
 * re-renders on every choice made in it (a colour, a font, a step), and minting
 * a fresh token each time runs into Lithos's rate limit mid-demo. A token
 * minted minutes ago with the same credentials proves the same thing.
 */
const TOKEN_CHECK_TTL_MS = 5 * 60_000;
const tokenCheckCache = globalThis as typeof globalThis & { __setupTokenCheck?: { key: string; at: number; result: InternalCheck } };

async function checkToken(): Promise<InternalCheck> {
  const key = `${process.env.LITHOS_TOKEN_URL}|${process.env.LITHOS_CLIENT_ID}|${process.env.LITHOS_CLIENT_SECRET}`;
  const cached = tokenCheckCache.__setupTokenCheck;
  if (cached && cached.key === key && Date.now() - cached.at < TOKEN_CHECK_TTL_MS) return cached.result;
  const result = await mintTokenCheck();
  if (result.status === "done") tokenCheckCache.__setupTokenCheck = { key, at: Date.now(), result };
  return result;
}

async function mintTokenCheck(): Promise<InternalCheck> {
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
      return { key: "token", status: "done", summary: expires ? `valid for ${Math.round(expires / 60)} minutes` : "issued", exchange };
    }
    if (response.status === 429) {
      return {
        key: "token", status: "blocked", summary: "Token endpoint answered 429 — too many requests.", exchange,
        diagnosis: {
          title: "Lithos is rate-limiting token requests",
          fix: "Your credentials are probably fine — too many tokens were requested in a short time. Wait a minute and reload. Once a token is issued, this page reuses it for a few minutes.",
        },
      };
    }
    return {
      key: "token", status: "blocked", summary: `Token endpoint answered ${response.status}.`, exchange,
      diagnosis: {
        title: "Lithos rejected your client credentials",
        fix: response.status === 401
          ? "Either they were mistyped, or the sandbox organization they belong to was archived — archiving deletes its credentials. Get new sandbox credentials below, or paste another pair."
          : "Check LITHOS_CLIENT_ID and LITHOS_CLIENT_SECRET for a stray space or a truncated paste. The secret is shown once when your organization is provisioned — if it's lost, ask for it to be rotated rather than re-sent.",
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

/** The first active treatment in this organization's formulary for a program — what the walkthrough's encounter requests. */
export async function readProgramTreatment(program: ProgramKey): Promise<CatalogTreatment | undefined> {
  const catalog = await getLithosClient().get<{ data: CatalogTreatment[] }>("/v1/catalog_treatments");
  return catalog.data.find((t) => t.status !== "inactive" && t.categories?.includes(program));
}

async function checkOrganization(): Promise<InternalCheck> {
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
          fix: "Provisioning chooses which programs you can prescribe in, and none were chosen. Ask your Lithos contact to add a program to your sandbox organization.",
        },
      };
    }
    return {
      key: "organization", status: "done",
      summary: `${catalog.data.length} treatments available`, exchange, catalog: catalog.data,
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

// ---------------------------------------------------------------- question threads

type InquiryRead = {
  id: string; patient_id: string; status: string; awaiting: "patient" | "staff" | null;
  references?: Array<{ type?: string; id?: string }>;
  messages?: Array<{ sender?: { type?: string }; body?: string }>;
};

export function threadFrom(inquiry: InquiryRead): QuestionThread {
  const messages = inquiry.messages ?? [];
  const fromCareTeam = messages.filter((m) => m.sender?.type !== "patient");
  const fromPatient = messages.filter((m) => m.sender?.type === "patient");
  return {
    id: inquiry.id,
    question: fromCareTeam.at(-1)?.body ?? "(no message)",
    reply: fromPatient.at(-1)?.body,
    awaiting: inquiry.awaiting,
    status: inquiry.status,
  };
}

// ---------------------------------------------------------------- webhooks

/** A part of the updates step: the endpoint check, or the deliveries check. */
type Check = Omit<StepState, "key">;

/** One thing that happened to the patient, as the app heard it. */
export type FeedItem = { at: string; type: string; label: string };

/** Plain words for each event this walkthrough can cause. */
const EVENT_LABELS: Record<string, string> = {
  "encounter.created": "Care requested",
  "encounter.in_review": "The clinician opened the review",
  "encounter.escalated": "The clinician paused to ask your patient a question",
  "encounter.completed": "The clinician signed off",
  "encounter.canceled": "The care request was canceled",
  "care_plan.active": "Plan approved — treatment starts",
  "care_plan.ineligible": "Plan declined",
  "care_plan.refill_due": "A refill is due",
  "order.created": "Prescription order created",
  "order.processing": "The order is being routed to a pharmacy",
  "order.placed": "A pharmacy accepted the order",
  "order.completed": "Your patient received their order",
  "order.canceled": "The order was canceled",
  "inquiry.created": "A question for your patient arrived",
  "inquiry.message_added": "A new message in the question thread",
  "inquiry.resolved": "The clinician read the reply and resolved the question",
  "inquiry.closed": "The question thread was closed",
  "webhook.test": "A test event",
};

/**
 * What the app has heard about this walkthrough's patient: the verified events
 * about their patient, care plan and encounter, plus their question threads.
 *
 * Inquiry events name the inquiry, not the patient — so, as the API docs
 * prescribe, the app re-reads each one to see whose it is and whose turn it
 * is. That re-read is also what fills the care-team inbox.
 */
async function readUpdates(ids: JourneyIds): Promise<{ feed: FeedItem[]; inbox: QuestionThread[]; heardAt?: string; thread?: QuestionThread }> {
  const ours = new Set([ids.patientId, ids.carePlanId, ids.encounterId, ids.questionPatientId, ids.questionEncounterId].filter(Boolean) as string[]);
  const patients = new Set([ids.patientId, ids.questionPatientId].filter(Boolean) as string[]);
  let events: Awaited<ReturnType<ReturnType<typeof getEventStore>["list"]>> = [];
  try {
    events = await getEventStore().list(200);
  } catch {
    return { feed: [], inbox: [] };
  }

  const inquiryIds = [...new Set(events.filter((e) => String(e.payload.type).startsWith("inquiry.")).map((e) => String(e.payload.resource_id)))];
  const inquiries = new Map<string, InquiryRead>();
  await Promise.all(inquiryIds.map(async (id) => {
    try {
      const inquiry = await getLithosClient().get<InquiryRead>(`/v1/inquiries/${id}`);
      if (patients.has(inquiry.patient_id)) inquiries.set(id, inquiry);
    } catch {
      /* not ours to read, or gone — leave it out */
    }
  }));

  const feed = events
    .filter((e) => ours.has(String(e.payload.resource_id)) || inquiries.has(String(e.payload.resource_id)))
    .map((e) => ({ at: e.receivedAt, type: String(e.payload.type), label: EVENT_LABELS[String(e.payload.type)] ?? String(e.payload.type) }))
    .sort((a, b) => a.at.localeCompare(b.at));
  const inbox = [...inquiries.values()].filter((i) => i.status === "open").map(threadFrom);

  // Step 5's question: the first inquiry event about its patient is the moment the app heard it.
  const asked = [...inquiries.values()].find((i) => i.patient_id === ids.questionPatientId);
  const heardAt = asked && events.filter((e) => e.payload.resource_id === asked.id).map((e) => e.receivedAt).sort()[0];
  return { feed, inbox, heardAt, thread: asked && threadFrom(asked) };
}

/**
 * How the partner's app stays in step with care: Lithos posts an event the
 * moment something happens, and the app re-reads what it names. Done once an
 * event about this walkthrough's patient, or a test event, has been received
 * here and its signature verified — the same thing the Lithos console's
 * sandbox checklist asks for.
 */
async function checkUpdates(ids: JourneyIds): Promise<StepState> {
  const endpointRead = await readEndpoint();
  // One proof check, shared by the endpoint and delivery checks.
  const reach = endpointRead.endpoint
    ? await reachesThisApp(endpointRead.endpoint.url.replace(/\/api\/webhooks\/lithos$/, ""))
    : null;
  const endpoint = checkEndpoint(endpointRead, reach);
  const { feed } = await readUpdates(ids);
  const base = {
    key: "updates" as const, feed,
    endpoint: endpoint.endpoint, setupDone: endpoint.status === "done", endpointSummary: endpoint.summary,
  };

  if (endpoint.status !== "done") {
    return {
      ...base, status: endpoint.status === "blocked" ? "blocked" : "ready",
      summary: endpoint.status === "blocked" ? endpoint.summary : "Not set up yet: your app hears nothing until it is.",
      diagnosis: endpoint.diagnosis, exchange: endpoint.exchange,
    };
  }
  const received = await checkReceived(ids, endpointRead.endpoint, reach?.ok === true);
  if (received.status === "done") {
    return { ...base, status: "done", summary: received.summary, exchange: received.exchange };
  }
  return {
    ...base, status: received.status === "blocked" ? "blocked" : "ready",
    summary: received.status === "blocked" ? received.summary : "Listening. Send a test event, or approve a patient in step 3: Lithos tells your app either way.",
    diagnosis: received.diagnosis, exchange: received.exchange ?? endpoint.exchange,
  };
}

async function readEndpoint(): Promise<{ endpoint?: WebhookEndpoint; exchange: Exchange }> {
  const path = "/v1/webhook_endpoints";
  try {
    const list = await getLithosClient().get<{ data: WebhookEndpoint[] }>(path);
    return { endpoint: list.data.find((e) => e.status === "active"), exchange: { method: "GET", path, status: 200, response: list } };
  } catch (error) {
    return { exchange: exchangeFromError("GET", path, error) };
  }
}

/**
 * "Is the registered endpoint this app?" is answered the same way registration
 * checks it — by fetching the endpoint's ping and comparing the proof — not by
 * comparing hostnames. A tunnel or a deployment never shares the page's host,
 * so the hostname version flagged every correctly registered tunnel as someone
 * else's. The proof also catches what hostnames can't: a tunnel that has since
 * restarted under a new address.
 */
function checkEndpoint(read: { endpoint?: WebhookEndpoint; exchange: Exchange }, reach: Reachability | null): Check {
  if (!read.endpoint) {
    return { status: "ready", summary: "No webhook endpoint registered.", exchange: read.exchange };
  }
  const pointsHere = reach?.ok === true;
  if (pointsHere) {
    return {
      status: "done",
      summary: `Registered, and it reaches this app: ${read.endpoint.url}`, exchange: read.exchange,
      endpoint: { id: read.endpoint.id, url: read.endpoint.url, pointsHere },
    };
  }
  return {
    status: "blocked",
    summary: `Registered: ${read.endpoint.url} — but it doesn't reach this app.`, exchange: read.exchange,
    endpoint: { id: read.endpoint.id, url: read.endpoint.url, pointsHere },
    diagnosis: {
      title: "Lithos is delivering to an address that doesn't reach this app",
      fix: `${reach && !reach.ok ? reach.message + " " : ""}If it was your tunnel, it has probably restarted under a new address — point the endpoint at the new one below. If it belongs to another app using these credentials, don't re-point it: ask your Lithos contact for a separate sandbox organization for this starter.`,
    },
  };
}

/**
 * Done only when an event about *this walkthrough's* patient, care plan or
 * encounter, or a test event to this endpoint, has been verified here.
 * Counting "any event in the store" was the first version, and it lied: a
 * store holding old or replayed events reported success before this
 * walkthrough had caused a single delivery.
 */
async function checkReceived(ids: JourneyIds, endpoint: WebhookEndpoint | undefined, pointsHere: boolean): Promise<Check> {
  if (!endpoint) return { status: "locked", summary: "Needs a registered endpoint first." };
  // A test event's resource is the endpoint itself.
  const ours = new Set([ids.patientId, ids.carePlanId, ids.encounterId, endpoint.id].filter(Boolean) as string[]);

  let received: Awaited<ReturnType<ReturnType<typeof getEventStore>["list"]>> = [];
  try {
    const events = await getEventStore().list(200);
    received = events.filter((e) => typeof e.payload.resource_id === "string" && ours.has(e.payload.resource_id));
  } catch {
    /* no event store on this deployment — Lithos's delivery log below still tells the story */
  }
  if (received.length > 0) {
    return {
      status: "done",
      summary: `${received.length} event${received.length === 1 ? "" : "s"} delivered, signature verified, stored.`,
      // The reveal for the last step: what Lithos actually sent. Thin on
      // purpose — a type and a resource id, not the new state.
      exchange: {
        method: "POST", path: "/api/webhooks/lithos", status: 200, direction: "inbound",
        note: "Each event says what changed and which resource — not the new state. An integration re-reads that resource with a GET. Headers (including the signature) aren't stored, only the verified payloads.",
        response: { data: received.map((e) => ({ received_at: e.receivedAt, ...e.payload })) },
      },
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
      // No box here: step 5 has already proved the endpoint reaches this app,
      // and the guide below says what's actually missing — an event since then.
      status: "ready", summary: "Lithos hasn't delivered anything to this app yet.", exchange,
    };
  }

  // Lithos delivered successfully, just not to this copy of the app.
  if (deliveries.some((d) => d.status === "succeeded") && !pointsHere) {
    return {
      status: "ready",
      summary: `Lithos delivered ${deliveries.length} event${deliveries.length === 1 ? "" : "s"}, to ${endpoint.url}.`,
      exchange,
      diagnosis: {
        title: "Delivered, but to another copy of this app",
        fix: `Lithos's log shows the delivery succeeded, so your endpoint works. It went to ${endpoint.url}, which doesn't reach this copy. Open /setup on that deployment to see it verified there — or run this copy behind a tunnel and register that URL instead.`,
      },
    };
  }

  const failing = deliveries.find((d) => d.status !== "succeeded" && d.last_response_code !== null);
  return {
    status: failing ? "blocked" : "ready",
    summary: `Lithos has attempted ${deliveries.length} deliver${deliveries.length === 1 ? "y" : "ies"}; this app has verified none.`,
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
      fix: "Send a test event, or approve a patient in step 3: each fires one. Webhooks need a public HTTPS URL: localhost can't receive them. Deploy this app, or run a tunnel (e.g. `cloudflared tunnel --url http://localhost:3001`) and register that URL.",
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
const CHECK_LABELS: Record<ConnectCheckKey, string> = {
  credentials: "Credentials in .env.local",
  token: "Access token minted",
  organization: "Your organization's formulary read",
};

/** Run the three connection checks in order; stop at the first that fails. */
async function checkConnect(): Promise<{ step: StepState; catalog: CatalogTreatment[] }> {
  const results: InternalCheck[] = [];
  const credentials = checkCredentials();
  results.push(credentials);
  if (credentials.status === "done") {
    let token = await checkToken();
    let organization = token.status === "done" ? await checkOrganization() : undefined;
    // The token check is cached; if the app's own call then couldn't get a
    // token, the credentials changed under it (revoked, archived) — check again.
    if (organization && organization.status !== "done" && /token mint failed with status 401/.test(JSON.stringify(organization.exchange?.response ?? ""))) {
      delete tokenCheckCache.__setupTokenCheck;
      token = await checkToken();
      organization = token.status === "done" ? organization : undefined;
    }
    results.push(token);
    if (organization) results.push(organization);
  }

  const order: ConnectCheckKey[] = ["credentials", "token", "organization"];
  const checks: ConnectCheck[] = order.map((key) => {
    const r = results.find((x) => x.key === key);
    return r
      ? { key, label: CHECK_LABELS[key], status: r.status === "done" ? "done" : "blocked", summary: r.summary, exchange: r.exchange }
      : { key, label: CHECK_LABELS[key], status: "skipped", summary: "Not checked yet." };
  });

  const failed = results.find((r) => r.status !== "done");
  if (failed) {
    const summary = failed.key === "credentials" ? "Not connected yet." : failed.summary;
    // Only the "no credentials yet" failure has a form to offer; a rejected
    // pair or a non-sandbox URL needs its own diagnosis, not another text box.
    const missing = failed.key === "credentials" && REQUIRED_ENV.some((name) => !process.env[name]);
    // Rejected credentials (401: mistyped, or their organization archived)
    // need new ones — offer the same forms, under the diagnosis.
    const rejected = failed.key === "token" && failed.exchange?.status === 401;
    const needsCredentials = missing || rejected;
    // No credentials yet isn't a fault — it's where everyone starts. It reads
    // as "your turn", like any other step waiting on the reader, not a red
    // "needs a fix" before they've done anything.
    if (missing) {
      const waiting = checks.map((c) => (c.key === "credentials" ? { ...c, status: "skipped" as const } : c));
      return { step: { key: "connect", status: "ready", summary, diagnosis: failed.diagnosis, checks: waiting, needsCredentials }, catalog: [] };
    }
    return { step: { key: "connect", status: "blocked", summary, diagnosis: failed.diagnosis, checks, needsCredentials: rejected || undefined }, catalog: [] };
  }
  return { step: { key: "connect", status: "done", summary: "Connected to your sandbox organization.", checks }, catalog: results[2].catalog ?? [] };
}

// ---------------------------------------------------------------- 2. program

/**
 * The programs this app offers come from the live formulary: every category
 * the organization's treatments belong to — the protocols it chose when it
 * signed up. No list to keep in sync, and nothing to pick.
 */
/** Every program, with what this organization's formulary has for it. */
export async function readProgramOptions(): Promise<ProgramOption[]> {
  const catalog = await getLithosClient().get<{ data: CatalogTreatment[] }>("/v1/catalog_treatments?limit=100");
  return programOptions(catalog.data);
}

/** The programs a patient can ask for here: the ones in the formulary. */
export async function readOfferedPrograms(): Promise<ProgramOption[]> {
  // Every patient-facing page asks (src/lib/app-meta.ts), so the answer is kept
  // for half a minute per connection; a protocol added in the console shows
  // up within that.
  const connection = process.env.LITHOS_CLIENT_ID ?? "";
  if (offered && offered.connection === connection && Date.now() - offered.at < 30_000) return offered.programs;
  const programs = (await readProgramOptions()).filter((p) => p.selectable);
  offered = { connection, at: Date.now(), programs };
  return programs;
}

let offered: { connection: string; at: number; programs: ProgramOption[] } | null = null;

/**
 * The two written-out programs, then every other category in the formulary —
 * so a protocol the organization chose shows up here without a code change.
 */
function programOptions(catalog: CatalogTreatment[]): ProgramOption[] {
  const active = catalog.filter((t) => t.status !== "inactive");
  const others = [...new Set(active.flatMap((t) => t.categories ?? []))]
    .filter((key) => !PROGRAMS.some((p) => p.key === key))
    .sort()
    .map((key) => programFor(key))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  return [...PROGRAMS, ...others].map((program) => {
    const treatments = catalog.filter((t) => t.status !== "inactive" && t.categories?.includes(program.key)).map((t) => t.name);
    return { ...program, treatments, inFormulary: treatments.length > 0, selectable: program.supported && treatments.length > 0 };
  });
}

function checkProgram(ids: JourneyIds, catalog: CatalogTreatment[]): StepState {
  const programs = programOptions(catalog);

  if (!programs.some((p) => p.selectable)) {
    return {
      key: "program", status: "blocked", summary: "No program in your formulary yet.", programs,
      diagnosis: {
        title: "Your formulary has no active treatments yet",
        fix: "The programs come from the protocols your organization chose. Ask your Lithos contact to provision at least one for your sandbox organization — nothing ships from the sandbox, so there's no reason to hold it back.",
      },
    };
  }

  // Nothing to choose: the app offers every program the organization was
  // provisioned for, and the patient picks one when they start. The lead
  // program only decides what the home page talks about.
  const offered = programs.filter((p) => p.selectable);
  const lead = offered.find((p) => p.key === ids.program) ?? offered[0];
  const treatments = catalog.filter((t) => t.status !== "inactive" && offered.some((p) => t.categories?.includes(p.key)));
  return {
    key: "program", status: "done", programs, chosenProgram: lead.key,
    summary: `Your app offers ${offered.map((p) => p.label.toLowerCase()).join(" and ")} — the protocols your organization chose.`,
    exchange: {
      method: "GET", path: "/v1/catalog_treatments", status: 200,
      note: "Trimmed to the fields that matter here. Each treatment's categories are the programs it belongs to — the endpoint itself has no program filter.",
      response: {
        data: treatments.map((t) => ({
          id: t.id, name: t.name, brand_name: t.brand_name, form: t.form, categories: t.categories,
          dosages: (t.dosages ?? []).map((d) => ({ id: d.id, strength: d.strength, default_days_supply: d.default_days_supply, description: d.description })),
        })),
      },
    },
  };
}

export async function evaluateSetup(ids: JourneyIds): Promise<StepState[]> {
  const steps: StepState[] = [];
  const { step: connect, catalog } = await checkConnect();
  steps.push(connect);
  if (connect.status !== "done") {
    steps.push({ key: "program", status: "locked", summary: "Waiting on the connection." });
    steps.push({ key: "updates", status: "locked", summary: "Waiting on the connection." });
    return steps;
  }
  steps.push(checkProgram(ids, catalog));
  steps.push(await checkUpdates(ids));
  return steps;
}
