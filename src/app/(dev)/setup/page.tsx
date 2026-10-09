import type { Metadata } from "next";
import Link from "next/link";
import { readConfig } from "@/lib/starter-config";
import { lithosConnection } from "@/lib/lithos/connection";
import { appFolder } from "@/lib/setup/handoff";
import { CONSOLE_URL, readDevProgress } from "@/lib/dev-progress";
import { KeepItButtons } from "./email-app";
import { API_DOCS_URL } from "./parts";

export const metadata: Metadata = { title: "Developer" };
export const dynamic = "force-dynamic";

/**
 * The Developer home: where this app stands on the Lithos console's sandbox
 * checklist, and every side of the app to look at — the patient's own app,
 * the site, the records behind them — plus taking it with you. Setting things
 * up lives on its own pages: Webhooks, and Settings (connection, programs,
 * brand). The journey itself is tried in the app: request care as a patient,
 * then play the clinician on the care page.
 */
export default async function DeveloperPage() {
  const { brand } = await readConfig();
  const connected = lithosConnection().connected;
  const read = connected ? await readDevProgress() : null;
  const rejected = Boolean(read && "rejected" in read);
  const progress = read && !("rejected" in read) ? read : null;
  const dev = process.env.NODE_ENV === "development";

  return (
    <section className="stack setup">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Lithos sandbox</p>
          <h1>Your app</h1>
          <p className="lede">
            Try the journey in the app itself: request care as a patient, play the clinician on the care page, then see
            what the patient sees. <a href={CONSOLE_URL} target="_blank" rel="noopener">Your Lithos console</a> ticks as
            the app makes the calls.
          </p>
        </div>
      </div>

      {(!connected || rejected) && (
        <div className="error-box">
          <h2>{rejected ? "Lithos rejected this app’s credentials" : "Not connected to Lithos yet"}</h2>
          <p>{rejected ? "The sandbox they belong to may have been archived." : "Nothing here can reach Lithos until it is."} <Link href="/setup/settings#step-connect">Connect it in Settings →</Link></p>
        </div>
      )}

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

      <div className="setup-next-cards">
        <div className="setup-next-card">
          <h3>Your patient&rsquo;s app</h3>
          <p className="muted">
            What a patient sees once a clinician has decided: the prescription and its delivery, the plan, a chat with the
            care team, and help. Read live from Lithos.
          </p>
          <div className="setup-next-stack"><Link href="/portal" className="btn btn-primary">Open the patient app</Link></div>
        </div>
        <div className="setup-next-card">
          <h3>Your site</h3>
          <p className="muted">Where patients find {brand.name} and ask for care: the home page and the intake.</p>
          <div className="setup-next-stack">
            <Link href="/" className="btn btn-ghost">Home page</Link>
            <Link href="/start" className="btn btn-ghost">Request care</Link>
          </div>
        </div>
        <div className="setup-next-card">
          <h3>Look inside</h3>
          <p className="muted">Every care request this app made, the webhooks it verified, and your members.</p>
          <div className="setup-next-stack">
            <Link href="/journeys" className="btn btn-ghost">Journeys</Link>
            <Link href="/events" className="btn btn-ghost">Webhook events</Link>
            <Link href="/members" className="btn btn-ghost">Members</Link>
          </div>
        </div>
        {dev && (
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

      <p className="fine-print">
        These pages run against the sandbox only and refuse anything else. Nothing on them reports back to Lithos.
      </p>
    </section>
  );
}
