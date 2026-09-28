"use client";

import { useActionState } from "react";
import { useScrollToFeedback } from "@/lib/use-scroll-to-feedback";
import { requestCareAction } from "../actions";
import { INITIAL_CARE_REQUEST_STATE } from "@/lib/care-request-state";
import { NOT_CONNECTED_CODE } from "@/lib/lithos/connection";
import { NotConnected } from "../../../not-connected";
import { VisitStep } from "../../../_visit/visit-step";

const FORM_ID = "care-review-form";

// Same eight fields the protocol requires, in the member's own words. The field
// names are the Lithos intake contract — don't rename them.
const SCREENING: Array<[string, string]> = [
  ["established_atherosclerotic_cardiovascular_disease", "I've been diagnosed with heart disease, a stroke or TIA, or peripheral artery disease"],
  ["recent_cardiac_condition", "I've had a cardiac event or hospital stay in the last 12 months, or a heart condition that isn't being actively managed"],
  ["drug_hypersensitivity", "I've had a serious reaction to a PCSK9 inhibitor, rosuvastatin, or something in them"],
  ["cirrhosis", "I have cirrhosis"],
  ["severe_hepatic_impairment", "I have severe liver impairment"],
  ["severe_renal_impairment", "I have severe kidney impairment"],
  ["pregnancy", "I'm pregnant, planning a pregnancy, or breastfeeding"],
  ["currently_taking_cyclosporine", "I currently take cyclosporine"],
];

const OPTIONS: Array<[string, string, string]> = [
  ["lerochol", "Lerochol (lerodalcibep)", "A once-monthly injection you give yourself"],
  ["repatha", "Repatha (evolocumab)", "An injection every two weeks"],
  ["rosuvastatin", "Rosuvastatin (Crestor)", "A daily tablet, starting at 20 mg"],
  ["", "I'd rather the clinician decide", "They'll choose based on your history"],
];

export function CareReviewForm({ memberId, askInsurance }: { memberId: string; askInsurance: boolean }) {
  const [state, action, pending] = useActionState(requestCareAction, INITIAL_CARE_REQUEST_STATE);
  const feedbackRef = useScrollToFeedback(state, state.status !== "idle");
  const choosingVisit = state.status === "needs_visit";

  return (
    <>
    <form id={FORM_ID} action={action} className="stack">
      <input type="hidden" name="member_id" value={memberId} />

      <div ref={feedbackRef} className="feedback-anchor">
      {state.status === "blocked" && (
        <section className="error-box" aria-live="polite">
          <h2>We can&rsquo;t start a care review right now</h2>
          <p className="muted">
            Based on your answers, this program isn&rsquo;t the right fit. Nothing has been sent to a clinician. Your
            coach will follow up about care outside Eucardia.
          </p>
          <ul>{state.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        </section>
      )}
      {state.status === "error" && state.errors.some((e) => e.code === NOT_CONNECTED_CODE) && (
        <NotConnected
          action="Sending this request escalates you from coaching into medical care"
          outcome="a licensed clinician reads your history and decides with you what to add"
        />
      )}
      {state.status === "error" && !state.errors.some((e) => e.code === NOT_CONNECTED_CODE) && (
        <section className="error-box" aria-live="polite">
          <h2>We couldn&rsquo;t send your request</h2>
          {state.httpStatus && <p className="muted">The clinical service responded with HTTP {state.httpStatus}.</p>}
          <ul>
            {state.errors.map((error, index) => (
              <li key={`${error.code}-${index}`}>
                {error.message}
                {error.source?.pointer && <code className="muted"> {error.source.pointer}</code>}
              </li>
            ))}
          </ul>
        </section>
      )}
      </div>

      {/* Hidden, not unmounted, while a time is picked: the form still sends every answer. */}
      <div className="stack" hidden={choosingVisit}>
      <fieldset className="form-section">
        <h2>What you&rsquo;d like to start</h2>
        <p className="hint">
          You choose, and the clinician confirms it&rsquo;s right for you — they may suggest something different after
          reading your history.
        </p>
        <div className="check-list">
          {OPTIONS.map(([value, label, hint], index) => (
            <label key={value || "provider"} className="check">
              <input type="radio" name="catalog_treatment_id" value={value} defaultChecked={index === 0} />
              <span><strong>{label}</strong> <span className="muted">— {hint}</span></span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="form-section">
        <h2>A few health questions</h2>
        <p className="hint">Tick anything that applies to you. Leave the rest blank.</p>
        <div className="check-list">
          {SCREENING.map(([name, label]) => (
            <label key={name} className="check"><input type="checkbox" name={name} /> <span>{label}</span></label>
          ))}
        </div>
      </fieldset>

      <fieldset className="form-section">
        <h2>Your insurance</h2>
        <p className="hint">
          {askInsurance
            ? "We have to ask once: this program can't be offered to people on government insurance."
            : "You've answered this before — confirm it's still right."}
        </p>
        <div className="choice-row">
          <span>Are you enrolled in Medicare, Medicaid, or Tricare?</span>
          <label className="choice"><input type="radio" name="enrolled_in_government_insurance" value="false" /> No</label>
          <label className="choice"><input type="radio" name="enrolled_in_government_insurance" value="true" /> Yes</label>
        </div>
      </fieldset>

      <label className="consent">
        <input type="checkbox" name="attested" />
        <span>
          I consent to telehealth care and confirm the details above are mine.{" "}
          <span className="muted">This is separate from my membership agreement.</span>
        </span>
      </label>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
          {pending ? "Sending to the clinical team…" : "Send for clinician review"}
        </button>
      </div>
      </div>
    </form>
    {choosingVisit && (
      <VisitStep
        formId={FORM_ID}
        patientId={state.patientId}
        carePlanId={state.carePlanId}
        initialOffer={state.offer}
        submitting={pending}
        submitLabel="Book this time and send my request"
      />
    )}
    </>
  );
}
