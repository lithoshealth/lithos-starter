"use client";

import { useActionState } from "react";
import { escalateAction, type ActionState } from "./actions";

const SCREENING: Array<[string, string]> = [
  ["established_atherosclerotic_cardiovascular_disease", "Diagnosed heart disease, stroke/TIA, or peripheral artery disease"],
  ["recent_cardiac_condition", "A cardiac event or hospitalization in the last 12 months, or a heart condition not under active management"],
  ["drug_hypersensitivity", "A serious reaction to a PCSK9 inhibitor, rosuvastatin, or their components"],
  ["cirrhosis", "Cirrhosis"],
  ["severe_hepatic_impairment", "Severe liver impairment"],
  ["severe_renal_impairment", "Severe kidney impairment"],
  ["pregnancy", "Pregnant, planning pregnancy, or breastfeeding"],
  ["currently_taking_cyclosporine", "Currently taking cyclosporine"],
];

const OPTIONS: Array<[string, string, string]> = [
  ["lerochol", "Lerochol (lerodalcibep)", "PCSK9 inhibitor · once-monthly injection · preferred"],
  ["repatha", "Repatha (evolocumab)", "PCSK9 inhibitor · injection every 2 weeks"],
  ["rosuvastatin", "Rosuvastatin (Crestor)", "Statin · once-daily tablet · start 20 mg"],
  ["", "Let the clinician choose", "Provider-choice line"],
];

export function EscalateForm({
  memberId,
  defaults,
  governmentInsurance,
}: {
  memberId: string;
  defaults?: Partial<Record<string, boolean>>;
  /** null = never asked; the escalation is a hard stop until it is. */
  governmentInsurance?: boolean | null;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(escalateAction, { status: "idle" });

  return (
    <form action={action} className="stack">
      <input type="hidden" name="member_id" value={memberId} />

      {state.status === "blocked" && (
        <div className="error-box"><h2>Not eligible — no encounter created</h2><ul>{state.reasons.map((r) => <li key={r}>{r}</li>)}</ul></div>
      )}
      {state.status === "error" && (
        <div className="error-box"><h2>Escalation failed</h2>{state.httpStatus && <p className="muted">HTTP {state.httpStatus}</p>}<ul>{state.errors.map((e, i) => <li key={`${e.code}-${i}`}>{e.message} <code className="muted">{e.code}</code></li>)}</ul></div>
      )}
      {state.status === "ok" && <div className="notes"><strong>Escalated.</strong> <p>{state.message}</p></div>}

      <section className="form-section">
        <h2>Treatment choice</h2>
        <p className="hint">The protocol has the member choose, with clinician oversight.</p>
        <div className="check-list">
          {OPTIONS.map(([value, label, hint], i) => (
            <label key={value || "provider"} className="check">
              <input type="radio" name="catalog_treatment_id" value={value} defaultChecked={i === 0} />
              <span><strong>{label}</strong> <span className="muted">— {hint}</span></span>
            </label>
          ))}
        </div>
      </section>

      <section className="form-section">
        <h2>Screening — asked now, held by nobody</h2>
        <p className="hint">Required for every encounter. A “yes” on most of these is a hard stop the partner must apply.</p>
        <div className="check-list">
          {SCREENING.map(([name, label]) => (
            <label key={name} className="check"><input type="checkbox" name={name} defaultChecked={defaults?.[name] ?? false} /> <span>{label}</span></label>
          ))}
        </div>
      </section>

      {governmentInsurance === null && (
        <section className="form-section">
          <h2>Insurance — a platform rule, not a protocol one</h2>
          <p className="hint">
            Lithos excludes Medicare, Medicaid and Tricare for every partner. It isn&rsquo;t in the API contract, so
            nothing on the Lithos side checks it — and a membership record has no reason to hold it.
          </p>
          <div className="choice-row">
            <span>Is this member enrolled in Medicare, Medicaid, or Tricare?</span>
            <label className="choice"><input type="radio" name="enrolled_in_government_insurance" value="false" /> No</label>
            <label className="choice"><input type="radio" name="enrolled_in_government_insurance" value="true" /> Yes</label>
          </div>
        </section>
      )}

      <label className="consent">
        <input type="checkbox" name="attested" />
        <span>The member consents to telehealth care and has confirmed their identity. <span className="muted">(Membership consent doesn’t count; this is recorded with a fresh timestamp.)</span></span>
      </label>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Sending to Lithos…" : "Escalate to medical care"}</button>
      </div>
    </form>
  );
}
