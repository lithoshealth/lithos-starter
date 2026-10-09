import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { configWritable, readConfig } from "@/lib/starter-config";
import { BrandPanel } from "./brand-panel";
import { IntakeStylePicker } from "./intake-style-picker";
import { STEP_SOURCES } from "@/lib/setup/requests";
import { readJourneyIds } from "@/lib/setup/journey-cookie";
import { readIssued } from "@/lib/setup/issued-cookie";
import { appFolder, readHandoff } from "@/lib/setup/handoff";
import { evaluateSetup, type Exchange, type StepState } from "@/lib/setup/steps";
import { CONSOLE_URL, readDevProgress } from "@/lib/dev-progress";
import { sendTestEventAction } from "./actions";
import { KeepItButtons } from "./email-app";
import { Connected, ConnectForm, NewSecretForm, RepointForm, StepAction, WebhookForm } from "./step-actions";
import { DeliveryGuide, EndpointGuide } from "./webhook-guide";

export const metadata: Metadata = { title: "Developer" };
export const dynamic = "force-dynamic";

/** Lithos's API reference — the same link Lithos sends with sandbox credentials. */
const API_DOCS_URL = "https://docs.lithoshealth.com";

const BADGE: Record<StepState["status"], { label: string; className: string }> = {
  done: { label: "Done", className: "badge-success" },
  ready: { label: "Your turn", className: "badge-info" },
  blocked: { label: "Needs a fix", className: "badge-error" },
  locked: { label: "Waiting", className: "badge-outline" },
};

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

function Exchanges({ step }: { step: StepState }) {
  return (
    <>
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
    </>
  );
}

function Diagnosis({ step }: { step: StepState }) {
  if (!step.diagnosis) return null;
  return (
    <div className={step.status === "blocked" ? "error-box" : "demo-note"}>
      <h2>{step.diagnosis.title}</h2>
      <p>{step.diagnosis.fix}</p>
      {step.diagnosis.command && <pre className="setup-command">{step.diagnosis.command}</pre>}
      {step.diagnosis.then && <p>{step.diagnosis.then}</p>}
    </div>
  );
}

/**
 * The Developer page: this app's connection to Lithos, its program and brand,
 * and webhooks. Not a walkthrough — the journey is tried in the app itself
 * (request care as a patient, then play the clinician on the care page), and
 * the dev bar says what's next. The Lithos console's sandbox checklist ticks
 * as the app makes the calls.
 */
export default async function DeveloperPage() {
  const ids = await readJourneyIds();
  const issued = await readIssued();
  const handoff = await readHandoff();
  const config = await readConfig();
  const brand = config.brand;

  const host = (await headers()).get("host");
  const isLocal = !host || /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
  const steps = await evaluateSetup(ids);
  const connect = steps.find((s) => s.key === "connect") as StepState;
  const program = steps.find((s) => s.key === "program");
  const updates = steps.find((s) => s.key === "updates") as StepState;
  const progress = connect.status === "done" ? await readDevProgress() : null;
  // The endpoint, when it reaches this app — re-registering it gets a new secret.
  const endpointHere = updates.endpoint?.pointsHere ? updates.endpoint : undefined;

  return (
    <section className="stack setup">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Lithos sandbox</p>
          <h1>Developer</h1>
          <p className="lede">
            This app&rsquo;s connection to Lithos, its program and brand, and webhooks. Try the journey in the app itself:
            request care as a patient, then play the clinician on the care page.{" "}
            <a href={CONSOLE_URL} target="_blank" rel="noopener">Your Lithos console</a> ticks as the app makes the calls.
          </p>
        </div>
      </div>

      {progress && (
        <div className="card stack">
          <h2>Sandbox checklist</h2>
          <ul className="setup-checks">
            {progress.checks.map((c) => (
              <li key={c.key} className={`setup-check setup-check-${c.done ? "done" : "ready"}`}>
                <div className="setup-check-line">
                  <span className="setup-check-mark" aria-hidden="true">{c.done ? "✓" : "–"}</span>
                  <span><strong>{c.label}</strong></span>
                </div>
              </li>
            ))}
          </ul>
          <p>
            {progress.next.external
              ? <a className="btn btn-primary" href={progress.next.href} target="_blank" rel="noopener">{progress.next.label}&nbsp;↗</a>
              : <Link className="btn btn-primary" href={progress.next.href}>{progress.next.label}</Link>}
          </p>
        </div>
      )}

      <article id="step-connect" className={`card setup-step setup-step-${connect.status}`}>
        <div className="setup-step-head">
          <div className="setup-step-title">
            <h2>Connection</h2>
            <p className="muted">{connect.summary}</p>
          </div>
          <span className={`badge ${BADGE[connect.status].className}`}>{BADGE[connect.status].label}</span>
        </div>
        {connect.checks && (
          <ul className="setup-checks">
            {connect.checks.map((check) => (
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
        <Diagnosis step={connect} />
        {connect.needsCredentials && <ConnectForm companyName={brand.name} email={handoff?.email} handedOver={Boolean(handoff)} />}
        {connect.status === "done" && issued && <Connected issued={issued} />}
        <p className="fine-print">Code: <code>{STEP_SOURCES.connect}</code></p>
      </article>

      {program && program.status !== "locked" && (
        <article id="step-program" className={`card setup-step setup-step-${program.status}`}>
          <div className="setup-step-head">
            <div className="setup-step-title">
              <h2>Programs</h2>
              <p className="muted">{program.summary}</p>
            </div>
            <span className={`badge ${BADGE[program.status].className}`}>{BADGE[program.status].label}</span>
          </div>
          <Diagnosis step={program} />
          {program.status === "done" && program.programs && (
            <>
              <ul className="program-list">
                {program.programs.filter((p) => p.selectable).map((p) => (
                  <li key={p.key}>
                    <strong>{p.label}</strong>{p.illustrative && <> <span className="pill">Illustrative intake</span></>}
                    <span className="muted"> — {p.treatments.join(", ")}. Its intake asks {p.asks}.</span>
                  </li>
                ))}
              </ul>
              <p className="muted">
                To offer something else, add protocols or request new ones from your Lithos console; they show up here
                on the home page and on <a href="/start">/start</a> without a code change. With more than one, the
                home page is your brand&rsquo;s, with a card for each.
              </p>
            </>
          )}
          <Exchanges step={program} />
        </article>
      )}

      <BrandPanel brand={brand} program={config.program} writable={configWritable()} />
      <div className="card">
        <IntakeStylePicker current={config.intakeStyle} writable={configWritable()} />
      </div>

      <article id="webhooks" className={`card setup-step setup-step-${updates.status}`}>
        <div className="setup-step-head">
          <div className="setup-step-title">
            <h2>Webhooks</h2>
            <p className="muted">{updates.summary}</p>
          </div>
          <span className={`badge ${BADGE[updates.status].className}`}>{BADGE[updates.status].label}</span>
        </div>
        {updates.status !== "locked" && (
          <>
            <p>
              Lithos tells your app when something changes, with a signed webhook your app verifies before re-reading the
              resource. Webhooks need a public HTTPS address: a deploy or a tunnel.
            </p>
            {updates.setupDone && process.env.LITHOS_WEBHOOK_SECRET && (
              <StepAction step="updates" action={sendTestEventAction} label="Send a test event" pendingLabel="Asking Lithos to send one…" variant={updates.status === "done" ? "ghost" : "primary"} />
            )}
            {(updates.feed?.length ?? 0) > 0 && (
              <details className="setup-detail">
                <summary>What your app heard about your latest patient ({updates.feed!.length})</summary>
                <ol className="updates-feed">
                  {updates.feed!.map((item, i) => (
                    <li key={`${item.at}-${i}`}>
                      <time dateTime={item.at}>{new Date(item.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}</time>
                      <span>{item.label}</span>
                      <code>{item.type}</code>
                    </li>
                  ))}
                </ol>
              </details>
            )}
            <details id="webhook-setup" className="setup-detail" open={!updates.setupDone || updates.status === "blocked"}>
              <summary>{updates.setupDone ? "Your endpoint" : "Set up your endpoint"}</summary>
              <p className="muted">{updates.endpointSummary}</p>
              <Diagnosis step={updates} />
              {!updates.endpoint && (
                <>
                  <EndpointGuide />
                  <WebhookForm defaultUrl={isLocal ? "" : `https://${host}`} />
                </>
              )}
              {updates.endpoint && !updates.endpoint.pointsHere && (
                <RepointForm currentId={updates.endpoint.id} currentUrl={updates.endpoint.url} defaultUrl={isLocal ? "" : `https://${host}`}>
                  <EndpointGuide />
                </RepointForm>
              )}
              {updates.setupDone && !process.env.LITHOS_WEBHOOK_SECRET && (
                <>
                  <DeliveryGuide />
                  {endpointHere && <NewSecretForm currentId={endpointHere.id} url={endpointHere.url} />}
                </>
              )}
            </details>
            <Exchanges step={updates} />
            <p className="fine-print">Code: <code>{STEP_SOURCES.updates}</code></p>
          </>
        )}
      </article>

      <section className="setup-next" aria-label="More">
        <h2>More</h2>
        <div className="setup-next-cards">
          <div className="setup-next-card">
            <h3>Look inside</h3>
            <p className="muted">Every care request this app made, the webhooks it verified, and your members.</p>
            <div className="setup-next-stack">
              <Link href="/journeys" className="btn btn-ghost">Journeys</Link>
              <Link href="/events" className="btn btn-ghost">Webhook events</Link>
              <Link href="/members" className="btn btn-ghost">Members</Link>
            </div>
          </div>
          {process.env.NODE_ENV === "development" && (
            <div className="setup-next-card">
              <h3>Take it with you</h3>
              <p className="muted">Your app as you&rsquo;ve made it, to run on any machine. Credentials aren&rsquo;t included.</p>
              <KeepItButtons to={process.env.LITHOS_SIGNUP_EMAIL || undefined} brandName={brand.name} folder={appFolder(brand.name)} docsUrl={API_DOCS_URL} />
            </div>
          )}
          <div className="setup-next-card">
            <h3>Build on the API</h3>
            <p className="muted">Every endpoint, field and webhook: follow-ups, refills, labs, messaging, visits.</p>
            <div className="setup-next-stack"><a className="btn btn-ghost" href={API_DOCS_URL} target="_blank" rel="noopener">API documentation&nbsp;↗</a></div>
          </div>
        </div>
      </section>

      <p className="fine-print">
        This page runs against the sandbox only and refuses anything else. Nothing on it reports back to Lithos.
      </p>
    </section>
  );
}
