import type { Metadata } from "next";
import { headers } from "next/headers";
import { configWritable, DEFAULT_PROGRAM, readConfig } from "@/lib/starter-config";
import { BrandPanel } from "./brand-panel";
import { IntakeStylePicker } from "./intake-style-picker";
import { LivePreview } from "./live-preview";
import { STEP_SOURCES, carePlanRequest, encounterRequest, patientRequest, webhookEndpointRequest } from "@/lib/setup/requests";
import { readJourneyIds } from "@/lib/setup/journey-cookie";
import { readIssued } from "@/lib/setup/issued-cookie";
import { appFolder, readHandoff } from "@/lib/setup/handoff";
import { evaluateSetup, type Exchange, type JourneyIds, type StepKey, type StepState } from "@/lib/setup/steps";
import { clearProgramAction, declineReviewAction, driveReviewAction, onboardSamplePatientAction, seeAsPatientAction, sendTestEventAction } from "./actions";
import { ReviewCard } from "./review-card";
import Link from "next/link";
import { KeepItButtons } from "./email-app";
import { Connected, ConnectForm, NewSecretForm, ProgramPicker, RepointForm, RunAgainButton, StepAction, WebhookForm } from "./step-actions";
import { DeliveryGuide, EndpointGuide } from "./webhook-guide";

export const metadata: Metadata = { title: "Set up your sandbox" };
export const dynamic = "force-dynamic";

/** Lithos's API reference — the same link Lithos sends with sandbox credentials. */
const API_DOCS_URL = "https://docs.lithoshealth.com";
/** The Lithos console: where the partner learned the steps, and where its sandbox checklist ticks as this app makes them. */
const CONSOLE_URL = process.env.LITHOS_CONSOLE_URL || "https://app-sandbox.lithoshealth.com/launch";

// Written so the page reads the same whatever the app is called — the starter
// may be rebranded per prospect, so nothing here says "Eucardia".
/** What each finished step amounts to, for the closing recap. */
const WINS: Record<StepKey, string> = {
  connect: "Connected to Lithos",
  program: "A program to offer",
  patient: "A patient created",
  review: "A clinician’s decision",
  updates: "Webhooks received",
};

// Short on purpose: the Lithos console's "Discover the steps" explains the
// journey. This page is for doing it with this app's own code.
const STEPS: Record<StepKey, { title: string; what: string }> = {
  connect: {
    title: "Connect to Lithos",
    what: "Paste the client ID and secret from your Lithos console, or get a new sandbox here. They stay on your server; the browser never sees them. Then choose which of your programs this app offers: it decides your site's copy and the intake your patients answer.",
  },
  program: {
    title: "Choose what you offer",
    what: "",
  },
  patient: {
    title: "Create a patient",
    what: "Fill in your app's intake yourself, as a patient would. Sending it creates the patient, a care plan and an encounter: the request a clinician reviews.",
  },
  review: {
    title: "Get a clinician’s decision",
    what: "In production a Lithos clinician reviews the encounter. In the sandbox, you decide for them, and your app reads the outcome back.",
  },
  updates: {
    title: "Receive a webhook",
    what: "Lithos tells your app when something changes, with a signed webhook your app verifies before re-reading the resource. Webhooks need a public HTTPS address: a deploy or a tunnel.",
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
      return [
        { method: "POST", path: "/v1/patients", body: patientRequest("<timestamp>") },
        { method: "POST", path: "/v1/care_plans", body: carePlanRequest(ids.patientId ?? "<patient id>", ids.program ?? "<your program>") },
        { method: "POST", path: "/v1/encounters", body: encounterRequest(ids.program ?? DEFAULT_PROGRAM, ids.patientId ?? "<patient id>", "<care plan id>", "<first treatment in your program>") },
      ];
    case "review": {
      // Opening the review, then the call behind each of the three decisions.
      const base = `/v1/sandbox/encounters/${ids.encounterId ?? "<encounter id>"}`;
      return [
        { method: "POST", path: `${base}/start_review`, body: {} },
        { method: "POST", path: `${base}/complete  ← Simulate approval`, body: {} },
        { method: "POST", path: `${base}/complete  ← Simulate denial`, body: { plan: { eligibility_status: "ineligible", ineligibility_reason_code: "criteria_not_met" } } },
        { method: "POST", path: `${base}/escalate  ← Ask a question`, body: { escalation_reason: "patient_information_required", message_for_patient: "<your question>" } },
      ];
    }
    case "updates":
      return [
        { method: "POST", path: "/v1/webhook_endpoints", body: webhookEndpointRequest("https://<your app>/api/webhooks/lithos") },
        { method: "POST", path: "/v1/webhook_endpoints/<endpoint id>/test", body: {} },
      ];
    default:
      return null;
  }
}

/**
 * A list call that came back empty — labelled "nothing yet", so a folded
 * `{ "data": [] }` isn't mistaken for a result worth opening.
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
  const issued = await readIssued();
  const handoff = await readHandoff();
  const config = await readConfig();
  const brand = config.brand;

  const host = (await headers()).get("host");
  const isLocal = !host || /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
  const evaluated = await evaluateSetup(ids);
  // Choosing a program is part of step 1 here: shown inside it, not as a step of its own.
  const programStep = evaluated.find((s) => s.key === "program");
  const steps = evaluated
    .filter((s) => s.key !== "program")
    .map((s) =>
      s.key === "connect" && s.status === "done" && programStep && programStep.status !== "done"
        ? { ...s, status: programStep.status, summary: "Connected. Now choose the program this app offers." }
        : s,
    );
  // Progress counts the steps a first encounter needs; the optional one is extra.
  const required = steps.filter((s) => !s.optional);
  const done = required.filter((s) => s.status === "done").length;
  const current = required.find((s) => s.status === "ready" || s.status === "blocked");
  const connected = steps[0]?.status === "done";
  // All four done: every call the console's sandbox checklist looks for.
  const finished = done === required.length;
  // The endpoint, when it reaches this app — step 4 can re-register it for a new secret.
  const endpointHere = steps.find((s) => s.key === "updates")?.endpoint;
  const endpointHereOk = endpointHere?.pointsHere ? endpointHere : undefined;

  return (
    <section className="stack setup">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Lithos sandbox · setup</p>
          <h1>Connect this app to Lithos.</h1>
          <p className="lede">
            Four steps, the ones your Lithos console&rsquo;s sandbox checklist looks for: connect, create a patient, get a
            clinician&rsquo;s decision, receive a webhook. Each is checked against the live API, and{" "}
            <a href={CONSOLE_URL} target="_blank" rel="noopener">your console</a> ticks as this app makes the calls.
          </p>
        </div>
      </div>

      <BrandPanel brand={brand} program={config.program} writable={configWritable()} />

      <div className="setup-progress" aria-label={`${done} of ${required.length} steps done`}>
        <div className="setup-progress-bar" style={{ width: `${(done / required.length) * 100}%` }} />
      </div>
      <p className="muted">
        {done === required.length
          ? `All ${required.length} steps done: ${brand.name} makes every call your sandbox checklist needs.`
          : `${done} of ${required.length} done${current ? ` — next: ${STEPS[current.key].title.toLowerCase()}.` : "."}`}
      </p>

      <ol className="setup-steps">
        {steps.map((step, index) => {
          const meta = STEPS[step.key];
          const badge = step.optional && step.status !== "done" && step.status !== "locked" ? { label: "Optional", className: "badge-outline" } : BADGE[step.status];
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
                        <details className="setup-detail setup-detail-api">
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

              {step.diagnosis && step.key !== "updates" && (
                <div className={step.status === "blocked" ? "error-box" : "demo-note"}>
                  <h2>{step.diagnosis.title}</h2>
                  <p>{step.diagnosis.fix}</p>
                  {step.diagnosis.command && <pre className="setup-command">{step.diagnosis.command}</pre>}
                  {step.diagnosis.then && <p>{step.diagnosis.then}</p>}
                </div>
              )}

              {step.key === "connect" && step.needsCredentials && <ConnectForm companyName={brand.name} email={handoff?.email} handedOver={Boolean(handoff)} />}
              {/* After a signup the dev server reloads the page; the masked credentials come back from a cookie. */}
              {step.key === "connect" && step.status === "done" && issued && <Connected issued={issued} />}

              {step.key === "connect" && programStep?.programs && programStep.status !== "done" && programStep.status !== "locked" && (
                <ProgramPicker programs={programStep.programs} />
              )}
              {step.key === "connect" && programStep?.programs && programStep.status === "done" && programStep.chosenProgram && (
                <div className="form-actions">
                  <p className="notes">
                    Offering <strong>{programStep.programs.find((p) => p.key === programStep.chosenProgram)?.label}</strong>.
                  </p>
                  <form action={clearProgramAction}>
                    <button type="submit" className="btn btn-ghost">Change program</button>
                  </form>
                </div>
              )}

              {step.key === "patient" && step.status !== "locked" && (
                <>
                  <IntakeStylePicker current={config.intakeStyle} writable={configWritable()} />
                  <LivePreview
                    key={`${config.program}-${config.intakeStyle}`} path="/start" interactive refreshOn="/care/"
                    caption="Your patients' intake. Sample details are filled in — answer the questions and send it."
                  />
                </>
              )}

              {preview && (
                <details className="setup-detail setup-detail-api">
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
                <StepAction step="patient" action={onboardSamplePatientAction} label="Or skip: use a sample patient" pendingLabel="Sending to Lithos…" />
              )}
              {step.key === "review" && step.review && <ReviewCard review={step.review} />}
              {step.status === "ready" && step.key === "review" && (
                <div className="review-standin">
                  <p>Sandbox only: stand in for the clinician</p>
                  <div className="review-decisions">
                    <StepAction step="review" action={driveReviewAction} label="Simulate approval" pendingLabel="Simulating approval…" />
                    <StepAction step="review" action={declineReviewAction} label="Simulate denial" pendingLabel="Simulating denial…" variant="ghost" />
                  </div>
                </div>
              )}
              {step.key === "updates" && step.status !== "locked" && (
                <>
                  {step.setupDone && process.env.LITHOS_WEBHOOK_SECRET && (
                    <StepAction step="updates" action={sendTestEventAction} label="Send a test event" pendingLabel="Asking Lithos to send one…" variant={step.status === "done" ? "ghost" : "primary"} />
                  )}

                  {(step.feed?.length ?? 0) > 0 && (
                    <details className="setup-detail">
                      <summary>Everything your app heard about your patient ({step.feed!.length})</summary>
                      <ol className="updates-feed">
                        {step.feed!.map((item, i) => (
                          <li key={`${item.at}-${i}`}>
                            <time dateTime={item.at}>{new Date(item.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}</time>
                            <span>{item.label}</span>
                            <code>{item.type}</code>
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}

                  {/* A public address for this app, and the signing secret. Open until it's set up. */}
                  <details id="webhook-setup" className="setup-detail" open={!step.setupDone || step.status === "blocked"}>
                    <summary>{step.setupDone ? "Your endpoint" : "Set up your endpoint"}</summary>
                    <p className="muted">{step.endpointSummary}</p>
                    {step.diagnosis && (
                      <div className={step.status === "blocked" ? "error-box" : "demo-note"}>
                        <h2>{step.diagnosis.title}</h2>
                        <p>{step.diagnosis.fix}</p>
                        {step.diagnosis.command && <pre className="setup-command">{step.diagnosis.command}</pre>}
                        {step.diagnosis.then && <p>{step.diagnosis.then}</p>}
                      </div>
                    )}
                    {!step.endpoint && (
                      <>
                        <EndpointGuide />
                        <WebhookForm defaultUrl={isLocal ? "" : `https://${host}`} />
                      </>
                    )}
                    {step.endpoint && !step.endpoint.pointsHere && (
                      <RepointForm currentId={step.endpoint.id} currentUrl={step.endpoint.url} defaultUrl={isLocal ? "" : `https://${host}`}>
                        <EndpointGuide />
                      </RepointForm>
                    )}
                    {step.setupDone && !process.env.LITHOS_WEBHOOK_SECRET && (
                      <>
                        <DeliveryGuide />
                        {endpointHereOk && <NewSecretForm currentId={endpointHereOk.id} url={endpointHereOk.url} />}
                      </>
                    )}
                  </details>
                </>
              )}

              {/* Folded by default: the step's plain-language result is what most
                  people need. The real request and response are one click away. */}
              {[step.exchange, ...(step.moreExchanges ?? [])].filter((x): x is Exchange => Boolean(x)).map((exchange) => (
                <details key={`${exchange.method} ${exchange.path}`} className="setup-detail setup-detail-api">
                  <summary>
                    {exchange.direction === "inbound" ? "What Lithos sent" : "What Lithos returned"} — <code>{exchange.method} {exchange.path}</code>
                    {exchange.status ? ` · ${exchange.status}` : ""}
                    {isEmptyResponse(exchange.response) ? " · nothing yet" : ""}
                  </summary>
                  {exchange.note && <p className="muted">{exchange.note}</p>}
                  <Json value={exchange.response} />
                </details>
              ))}

              {step.status !== "locked" && <p className="fine-print">Code: <code>{STEP_SOURCES[step.key]}</code></p>}
            </li>
          );
        })}

        {/* Once a patient has reached a decision: go round again, or look back at the patients already run. */}
        {connected && ids.encounterId && (
          <li id="step-again" className="card setup-step setup-step-again">
            <div className="setup-step-head">
              <span className="setup-step-num">{steps.length + 1}</span>
              <div className="setup-step-title">
                <h2>Try it again</h2>
                <p className="muted">Run the walkthrough with a new sample patient, or look back at every patient you&rsquo;ve run so far.</p>
              </div>
              <span className="badge badge-outline">Optional</span>
            </div>
            <div className="setup-again-actions">
              <RunAgainButton />
              <Link href="/journeys" className="btn btn-ghost">See every journey</Link>
            </div>
          </li>
        )}
      </ol>

      {/* Where to go from here: the app itself, a copy to keep, and the full API. */}
      <section className={`setup-next${finished ? " setup-finale" : ""}`} aria-label={finished ? "You're on Lithos" : "What's next"}>
        {finished ? (
          <div className="setup-finale-head">
            <span className="setup-finale-mark" aria-hidden="true">✓</span>
            <p className="eyebrow">All {required.length} steps done</p>
            <h2>Congratulations — {brand.name} is on Lithos.</h2>
            <p className="lede">
              This isn&rsquo;t a mock-up. It&rsquo;s a working app: patients sign up on your site, a Lithos clinician
              reviews them, and the decision comes back to you. It runs on the sandbox for now, with sample patients.
            </p>
            <ul className="setup-finale-wins">
              {steps.filter((s) => s.status === "done").map((s) => <li key={s.key}>{WINS[s.key]}</li>)}
            </ul>
          </div>
        ) : (
          <h2>What&rsquo;s next</h2>
        )}
        <div className="setup-next-cards">
          <div className="setup-next-card">
            <h3>Your Lithos console</h3>
            <p className="muted">Your sandbox checklist ticks as this app makes the calls. Then apply to go live there.</p>
            <div className="setup-next-stack"><a className="btn btn-ghost" href={CONSOLE_URL} target="_blank" rel="noopener">Open your console&nbsp;↗</a></div>
          </div>
          <div className="setup-next-card">
            {/* Once a patient has a decision, the app has two sides: the site a visitor finds, and the patient's own app. */}
            {finished && ids.patientId ? (
              <>
                <h3>Use it</h3>
                <p className="muted">Your app two ways: as someone finding you for the first time, and as a patient coming back.</p>
                <div className="setup-next-stack">
                  <Link href="/" className="btn btn-ghost">As a visitor</Link>
                  <form action={seeAsPatientAction}><button className="btn btn-ghost">As a patient</button></form>
                </div>
              </>
            ) : (
              <>
                <h3>Open your site</h3>
                <p className="muted">
                  {connected
                    ? "Your site, as a new patient finds it. Its forms make the same calls this walkthrough made."
                    : "Look around now; once you connect in step 1, its forms create real sandbox patients."}
                </p>
                <div className="setup-next-stack"><Link href="/" className="btn btn-ghost">Open app</Link></div>
              </>
            )}
          </div>

          {/* A local copy only: it zips this working folder. */}
          {process.env.NODE_ENV === "development" && (
            <div className="setup-next-card">
              <h3>{finished ? "Keep it" : "Take it with you"}</h3>
              <p className="muted">
                Your app as you&rsquo;ve made it, to run on any machine. Credentials aren&rsquo;t included: whoever opens it
                gets their own in step 1.
              </p>
              <KeepItButtons to={process.env.LITHOS_SIGNUP_EMAIL || undefined} brandName={brand.name} folder={appFolder(brand.name)} docsUrl={API_DOCS_URL} />
            </div>
          )}

          <div className="setup-next-card">
            <h3>{finished ? "Grow it" : "Build on the API"}</h3>
            <p className="muted">Every endpoint, field and webhook — follow-ups, refills, labs, messaging, visits.</p>
            <div className="setup-next-stack"><a className="btn btn-ghost" href={API_DOCS_URL} target="_blank" rel="noopener">API documentation&nbsp;↗</a></div>
          </div>
        </div>
      </section>

      <p className="fine-print">
        This page runs against the sandbox only and refuses anything else. Nothing on it reports back to Lithos — every
        step already goes through Lithos&rsquo;s API, so there&rsquo;s nothing extra to send.
      </p>
    </section>
  );
}
