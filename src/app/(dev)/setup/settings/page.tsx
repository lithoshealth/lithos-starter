import type { Metadata } from "next";
import { configWritable, readConfig } from "@/lib/starter-config";
import { STEP_SOURCES } from "@/lib/setup/requests";
import { readJourneyIds } from "@/lib/setup/journey-cookie";
import { readIssued } from "@/lib/setup/issued-cookie";
import { readHandoff } from "@/lib/setup/handoff";
import { evaluateSetup, type StepState } from "@/lib/setup/steps";
import { BrandPanel } from "../brand-panel";
import { IntakeStylePicker } from "../intake-style-picker";
import { BADGE, Diagnosis, Exchanges, Json } from "../parts";
import { Connected, ConnectForm } from "../step-actions";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

/**
 * How this app is set up: its connection to Lithos (and a new one, when the
 * sandbox it pointed at is gone), the programs its formulary offers, and the
 * brand and intake style it wears. The first-run pop-up covers the same ground
 * the first time; this is where to come back to it.
 */
export default async function SettingsPage() {
  const ids = await readJourneyIds();
  const issued = await readIssued();
  const handoff = await readHandoff();
  const config = await readConfig();
  const brand = config.brand;
  const steps = await evaluateSetup(ids);
  const connect = steps.find((s) => s.key === "connect") as StepState;
  const program = steps.find((s) => s.key === "program");

  return (
    <section className="stack setup">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Lithos sandbox</p>
          <h1>Settings</h1>
          <p className="lede">This app&rsquo;s connection to Lithos, the programs it offers, and how it looks.</p>
        </div>
      </div>

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

    </section>
  );
}
