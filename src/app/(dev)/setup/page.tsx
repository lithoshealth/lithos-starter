import type { Metadata } from "next";
import { headers } from "next/headers";
import { APP_NAME } from "@/lib/app-meta";
import { STEP_SOURCES, carePlanRequest, encounterRequest, patientRequest, webhookEndpointRequest } from "@/lib/setup/requests";
import { readJourneyIds } from "@/lib/setup/journey-cookie";
import { evaluateSetup, type JourneyIds, type StepKey, type StepState } from "@/lib/setup/steps";
import { clearProgramAction, createEncounterAction, createPatientAction, driveReviewAction } from "./actions";
import Link from "next/link";
import { ConnectForm, NewSecretForm, ProgramPicker, RepointForm, RunAgainButton, StepAction, WebhookForm } from "./step-actions";
import { DeliveryGuide, EndpointGuide } from "./webhook-guide";

export const metadata: Metadata = { title: "Set up your sandbox" };
export const dynamic = "force-dynamic";

// Written so the page reads the same whatever the app is called — the starter
// may be rebranded per prospect, so nothing here says "Eucardia".
const STEPS: Record<StepKey, { title: string; what: string }> = {
  connect: {
    title: "Connect to Lithos",
    what: "Add your client ID and secret — two values Lithos issues when your sandbox organization is set up. They stay on your server; the browser never sees them. The app then proves they work three ways: the values are there, Lithos trades them for an access token, and that token reads your organization's formulary — the treatments you're allowed to prescribe.",
  },
  program: {
    title: "Choose your program",
    what: "Lithos organizes care into programs — each with its own protocol, intake form and treatments — and your organization is provisioned for some of them. The program you offer decides what you'll ask patients and what a clinician can prescribe. It's the one step you choose rather than do, but the options come from your live formulary.",
  },
  patient: {
    title: "Create a patient",
    what: "Patients belong to you: you send your own id as external_id, and Lithos keeps it forever so the two systems always reconcile. Sample details only.",
  },
  encounter: {
    title: "Request care — create an encounter",
    what: "Two calls. A care plan says what the patient is being treated for; an encounter carries the intake a clinician reviews and the treatment requested.",
  },
  review: {
    title: "Play the clinician",
    what: "In production a licensed clinician reviews this in Lithos's portal. The sandbox lets you sign it off yourself, so the loop closes without waiting on anyone.",
  },
  webhook_endpoint: {
    title: "Register a webhook endpoint",
    what: "Lithos tells you when things change by POSTing signed events to a URL you own. Needs a public HTTPS address.",
  },
  webhook_received: {
    title: "Receive a verified webhook",
    what: "Every delivery is signed. This app checks the signature before trusting a byte, and refuses anything that doesn't verify. Events are deliberately thin — they say what changed, not what the state is — so an integration re-reads the resource with a GET when one arrives.",
  },
};

const BADGE: Record<StepState["status"], { label: string; className: string }> = {
  done: { label: "Done", className: "badge-success" },
  ready: { label: "Your turn", className: "badge-info" },
  blocked: { label: "Needs a fix", className: "badge-error" },
  locked: { label: "Waiting", className: "badge-outline" },
};

/** What each write step will send — the same builders the actions use. */
function requestPreview(key: StepKey, ids: JourneyIds): { method: string; path: string; body: unknown }[] | null {
  switch (key) {
    case "patient":
      return [{ method: "POST", path: "/v1/patients", body: patientRequest("<timestamp>") }];
    case "encounter":
      return [
        { method: "POST", path: "/v1/care_plans", body: carePlanRequest(ids.patientId ?? "<patient id>", ids.program ?? "<your program>") },
        { method: "POST", path: "/v1/encounters", body: encounterRequest(ids.patientId ?? "<patient id>", "<care plan id>", "<first treatment in your program>") },
      ];
    case "review":
      return [
        { method: "POST", path: `/v1/sandbox/encounters/${ids.encounterId ?? "<encounter id>"}/start_review`, body: {} },
        { method: "POST", path: `/v1/sandbox/encounters/${ids.encounterId ?? "<encounter id>"}/complete`, body: {} },
      ];
    case "webhook_endpoint":
      return [{ method: "POST", path: "/v1/webhook_endpoints", body: webhookEndpointRequest("https://<your app>/api/webhooks/lithos") }];
    default:
      return null;
  }
}

/**
 * A list call that came back empty. Its response stays folded — an open
 * `{ "data": [] }` reads like a result when it's the absence of one. The reveal
 * is for when there's something to see.
 */
function isEmptyResponse(response: unknown): boolean {
  const data = (response as { data?: unknown } | null | undefined)?.data;
  return Array.isArray(data) && data.length === 0;
}

function Json({ value }: { value: unknown }) {
  return <pre className="setup-json">{JSON.stringify(value, null, 2)}</pre>;
}

export default async function SetupPage() {
  const ids = await readJourneyIds();

  const host = (await headers()).get("host");
  const isLocal = !host || /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
  const steps = await evaluateSetup(ids);
  const done = steps.filter((s) => s.status === "done").length;
  const current = steps.find((s) => s.status === "ready" || s.status === "blocked");
  const connected = steps[0]?.status === "done";
  // The endpoint, when it reaches this app — step 7 can re-register it for a new secret.
  const endpointHere = steps.find((s) => s.key === "webhook_endpoint")?.endpoint;
  const endpointHereOk = endpointHere?.pointsHere ? endpointHere : undefined;

  return (
    <section className="stack setup">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Lithos sandbox · setup</p>
          <h1>From clone to your first encounter.</h1>
          <p className="lede">
            Seven steps, each checked against the live Lithos API — nothing here is ticked by hand, so if you do a step
            your own way, it still turns green. About fifteen minutes to a first encounter.
          </p>
        </div>
        <RunAgainButton />
      </div>

      <div className="setup-progress" aria-label={`${done} of ${steps.length} steps done`}>
        <div className="setup-progress-bar" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <p className="muted">
        {done === steps.length
          ? `All ${steps.length} steps done. ${APP_NAME} is talking to Lithos end to end.`
          : `${done} of ${steps.length} done${current ? ` — next: ${STEPS[current.key].title.toLowerCase()}.` : "."}`}
      </p>

      <ol className="setup-steps">
        {steps.map((step, index) => {
          const meta = STEPS[step.key];
          const badge = BADGE[step.status];
          const preview = step.status === "ready" ? requestPreview(step.key, ids) : null;
          const isCurrent = current?.key === step.key;
          return (
            <li key={step.key} id={`step-${step.key}`} className={`card setup-step setup-step-${step.status}${isCurrent ? " setup-step-current" : ""}`}>
              <div className="setup-step-head">
                <span className="setup-step-num">{index + 1}</span>
                <div className="setup-step-title">
                  <h2>{meta.title}</h2>
                  <p className="muted">{step.summary}</p>
                </div>
                <span className={`badge ${badge.className}`}>{badge.label}</span>
              </div>

              {step.status !== "locked" && <p>{meta.what}</p>}

              {step.checks && (
                <ul className="setup-checks">
                  {step.checks.map((check) => (
                    <li key={check.key} className={`setup-check setup-check-${check.status}`}>
                      <div className="setup-check-line">
                        <span className="setup-check-mark" aria-hidden="true">{check.status === "done" ? "✓" : check.status === "blocked" ? "✗" : "–"}</span>
                        <span><strong>{check.label}</strong> <span className="muted">— {check.summary}</span></span>
                      </div>
                      {check.exchange && (
                        <details className="setup-detail" open>
                          <summary>
                            What Lithos returned — <code>{check.exchange.method} {check.exchange.path}</code>
                            {check.exchange.status ? ` · ${check.exchange.status}` : ""}
                          </summary>
                          <Json value={check.exchange.response} />
                        </details>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {step.diagnosis && (
                <div className={step.status === "blocked" ? "error-box" : "demo-note"}>
                  <h2>{step.diagnosis.title}</h2>
                  <p>{step.diagnosis.fix}</p>
                  {step.diagnosis.command && <pre className="setup-command">{step.diagnosis.command}</pre>}
                  {step.diagnosis.then && <p>{step.diagnosis.then}</p>}
                </div>
              )}

              {step.key === "connect" && step.status === "blocked" && step.needsCredentials && <ConnectForm />}

              {step.programs && step.status !== "locked" && step.status !== "done" && (
                <ProgramPicker programs={step.programs} />
              )}
              {step.programs && step.status === "done" && step.chosenProgram && (
                <>
                  <p className="notes">
                    You&rsquo;re offering <strong>{step.programs.find((p) => p.key === step.chosenProgram)?.label}</strong>. Step 4 will
                    request one of the treatments below: its <code>id</code> is what you send as <code>catalog_treatment_id</code>, and
                    its <code>dosages</code> — starting dose first — are what the clinician prescribes from.
                  </p>
                  <form action={clearProgramAction}>
                    <button type="submit" className="btn btn-ghost">Change program</button>
                  </form>
                </>
              )}

              {preview && (
                <details className="setup-detail" open={isCurrent}>
                  <summary>The call{preview.length > 1 ? "s" : ""} this step makes</summary>
                  {preview.map((p) => (
                    <div key={p.path}>
                      <p><code>{p.method} {p.path}</code></p>
                      <Json value={p.body} />
                    </div>
                  ))}
                </details>
              )}

              {step.status === "ready" && step.key === "patient" && (
                <StepAction step="patient" action={createPatientAction} label="Create a sample patient" pendingLabel="Creating…" />
              )}
              {step.status === "ready" && step.key === "encounter" && (
                <StepAction step="encounter" action={createEncounterAction} label="Create care plan and encounter" pendingLabel="Sending to Lithos…" />
              )}
              {step.status === "ready" && step.key === "review" && (
                <StepAction step="review" action={driveReviewAction} label="Sign it off as the clinician" pendingLabel="Reviewing…" />
              )}
              {step.status === "ready" && step.key === "webhook_endpoint" && (
                <>
                  <EndpointGuide />
                  <WebhookForm defaultUrl={isLocal ? "" : `https://${host}`} />
                </>
              )}
              {step.key === "webhook_endpoint" && step.endpoint && !step.endpoint.pointsHere && (
                <RepointForm currentId={step.endpoint.id} currentUrl={step.endpoint.url} defaultUrl={isLocal ? "" : `https://${host}`}>
                  <EndpointGuide />
                </RepointForm>
              )}
              {step.key === "webhook_received" && (step.status === "ready" || step.status === "blocked") && (
                <>
                  <DeliveryGuide secretSet={Boolean(process.env.LITHOS_WEBHOOK_SECRET)} />
                  {!process.env.LITHOS_WEBHOOK_SECRET && endpointHereOk && (
                    <NewSecretForm currentId={endpointHereOk.id} url={endpointHereOk.url} />
                  )}
                </>
              )}

              {/* Open by default: seeing Lithos answer with real data is the point
                  of each step. The block scrolls, so the page stays walkable. */}
              {step.exchange && (
                <details className="setup-detail" open={!isEmptyResponse(step.exchange.response)}>
                  <summary>
                    {step.exchange.direction === "inbound" ? "What Lithos sent" : "What Lithos returned"} — <code>{step.exchange.method} {step.exchange.path}</code>
                    {step.exchange.status ? ` · ${step.exchange.status}` : ""}
                    {isEmptyResponse(step.exchange.response) ? " · nothing yet" : ""}
                  </summary>
                  {step.exchange.note && <p className="muted">{step.exchange.note}</p>}
                  <Json value={step.exchange.response} />
                </details>
              )}

              {step.status !== "locked" && <p className="fine-print">Code: <code>{STEP_SOURCES[step.key]}</code></p>}
            </li>
          );
        })}
      </ol>

      {/* The point of setup is the app, not the checklist: once connected, send
          people back to use the site's own forms against real sandbox care. */}
      <section className={connected ? "setup-handoff stack" : "setup-handoff setup-handoff-locked stack"}>
        <p className="eyebrow">{connected ? "Connected" : "Once you're connected"}</p>
        <h2>Now use the app itself.</h2>
        <p>
          {connected
            ? <>Your site is connected to Lithos. What you just did by hand, it now does for every visitor: submitting the care review makes the same three calls — <code>POST /v1/patients</code>, <code>/v1/care_plans</code>, <code>/v1/encounters</code> — and lands on a live status page. No clinician picks things up in the sandbox, so that page lets you play one, like step 5.</>
            : <>Connect in step 1 and every form on the site starts creating real sandbox patients and encounters — the same calls this walkthrough makes.</>}
        </p>
        {connected && (
          <p>
            <Link href="/start" className="btn btn-primary">Submit a care review as a visitor →</Link>{" "}
            <Link href="/journeys" className="btn btn-ghost">See every journey</Link>
          </p>
        )}
      </section>

      <p className="fine-print">
        This page runs against the sandbox only and refuses anything else. Nothing on it reports back to Lithos — every
        step already goes through Lithos&rsquo;s API, so there&rsquo;s nothing extra to send.
      </p>
    </section>
  );
}
