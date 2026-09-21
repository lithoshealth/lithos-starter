"use client";

import { useActionState, useEffect, useRef } from "react";
import { createJourneyAction } from "../actions";
import { INITIAL_JOURNEY_STATE } from "@/lib/journey";

// Field names are the Lithos lipid_management intake contract — keep them as-is.
const screenings = [
  ["established_atherosclerotic_cardiovascular_disease", "I've been diagnosed with heart disease, stroke, or peripheral artery disease"],
  ["recent_cardiac_condition", "I've had a recent cardiac event or hospitalization (heart attack, stent, bypass)"],
  ["drug_hypersensitivity", "I've had an allergic reaction to a cholesterol medication"],
  ["cirrhosis", "I have cirrhosis"],
  ["severe_hepatic_impairment", "I have severe liver impairment"],
  ["severe_renal_impairment", "I have severe kidney impairment"],
  ["pregnancy", "I'm pregnant, breastfeeding, or planning a pregnancy"],
  ["currently_taking_cyclosporine", "I currently take cyclosporine"],
] as const;

export function IntakeForm() {
  const [state, action, pending] = useActionState(createJourneyAction, INITIAL_JOURNEY_STATE);
  const retrying = state.status === "failed" && Boolean(state.patientId);
  const emailRef = useRef<HTMLInputElement>(null);

  // A fresh sample email per visit — the shared sandbox rejects one that was already used.
  // Filled after mount so the server and client render the same (empty) initial value.
  useEffect(() => {
    const input = emailRef.current;
    if (input && !input.value) input.value = `sample.patient+${Date.now()}@example.com`;
  }, []);

  return (
    <form action={action} className="stack">
      {state.status === "failed" && (
        <section className="error-box" aria-live="polite">
          <h2>{state.stage === "validation" ? "Please check your details" : "We couldn't complete your intake"}</h2>
          {state.httpStatus && <p className="muted">The clinical service responded with HTTP {state.httpStatus}.</p>}
          <ul>
            {state.errors.map((error, index) => (
              <li key={`${error.code}-${index}`}>
                {error.message}
                {error.source?.pointer && <code className="muted"> {error.source.pointer}</code>}
              </li>
            ))}
          </ul>
          {retrying && <p className="muted">Your details were saved — retrying will pick up where it left off.</p>}
        </section>
      )}

      {state.status === "failed" && state.patientId && <input type="hidden" name="resume_patient_id" value={state.patientId} />}
      {state.status === "failed" && state.carePlanId && <input type="hidden" name="resume_care_plan_id" value={state.carePlanId} />}

      <section className="form-section">
        <h2>About you</h2>
        <p className="hint">Sample details only — use a Sample/Test name, an example.com email, and a 555 phone number.</p>
        <div className="field-grid">
          <label className="field">First name<input name="first_name" defaultValue="Sample" autoComplete="off" required /></label>
          <label className="field">Last name<input name="last_name" defaultValue="Patient" autoComplete="off" required /></label>
          <label className="field">Date of birth<input name="date_of_birth" type="date" defaultValue="1990-01-15" required /></label>
          <label className="field">Sex at birth<select name="sex" defaultValue="female" required><option value="female">Female</option><option value="male">Male</option></select></label>
          <label className="field">Email<input ref={emailRef} name="email" type="email" placeholder="you@example.com" autoComplete="off" required /></label>
          <label className="field">Phone<input name="phone" type="tel" defaultValue="+12025550123" autoComplete="off" required /></label>
          <label className="field wide">Street address<input name="address_line1" defaultValue="123 Sample Street" autoComplete="off" required /></label>
          <label className="field">Apt / unit <small>(optional)</small><input name="address_line2" autoComplete="off" /></label>
          <label className="field">City<input name="city" defaultValue="Washington" autoComplete="off" required /></label>
          <label className="field">State<input name="state" defaultValue="DC" maxLength={2} autoComplete="off" required /></label>
          <label className="field">ZIP code<input name="postal_code" defaultValue="20001" autoComplete="off" required /></label>
        </div>
        <div className="choice-row">
          <span>Are you enrolled in Medicare, Medicaid, or another government insurance plan?</span>
          <label className="choice"><input type="radio" name="enrolled_in_government_insurance" value="false" required /> No</label>
          <label className="choice"><input type="radio" name="enrolled_in_government_insurance" value="true" /> Yes</label>
        </div>
      </section>

      <section className="form-section">
        <h2>Your cholesterol</h2>
        <p className="hint">Use your most recent lab result. If you don’t have one, enter your best estimate and we’ll order labs.</p>
        <div className="field-grid">
          <label className="field">What brings you to Eucardia?<select name="indication" defaultValue="hypercholesterolemia"><option value="hypercholesterolemia">My cholesterol is high</option><option value="cardiovascular_risk_reduction">I want to lower my heart-disease risk</option></select></label>
          <label className="field">Familial hypercholesterolemia<small>Has a doctor diagnosed you?</small><select name="familial_hypercholesterolemia" defaultValue="none"><option value="none">No</option><option value="heterozygous">Yes — heterozygous</option><option value="homozygous">Yes — homozygous</option><option value="unknown">Not sure</option></select></label>
          <label className="field">Most recent LDL-C (mg/dL)<input name="ldl_c" type="number" min="1" step="1" defaultValue="160" required /></label>
          <label className="field">Date of that result<input name="ldl_c_date" type="date" defaultValue="2025-01-15" required /></label>
        </div>
      </section>

      <section className="form-section">
        <h2>Do any of these apply to you?</h2>
        <p className="hint">These help your clinician choose a treatment that’s safe for you. Check all that apply.</p>
        <div className="check-list">
          {screenings.map(([name, label]) => (
            <label key={name} className="check"><input type="checkbox" name={name} /> <span>{label}</span></label>
          ))}
        </div>
      </section>

      <label className="consent">
        <input type="checkbox" name="attestations_confirmed" required />
        <span>I consent to receive care through telehealth and confirm that the identity details above are mine. <span className="muted">(Demo: this records a sample consent and sample identity verification.)</span></span>
      </label>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
          {pending ? "Sending to our clinical team…" : retrying ? "Try again" : "Start my care plan"}
        </button>
        <span className="muted">Your intake goes to a licensed clinician for review.</span>
      </div>
    </form>
  );
}
