"use client";

import { useScrollToFeedback } from "@/lib/use-scroll-to-feedback";
import { startTransition, useActionState, useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { createJourneyAction } from "../actions";
import { INITIAL_JOURNEY_STATE } from "@/lib/journey";
import { NotConnected } from "../not-connected";

/*
 * The intake as a quiz: one question per screen, a progress bar, and
 * single-choice questions that move on as soon as you answer — the shape most
 * consumer telehealth intakes take.
 *
 * It is still one <form>. Every field stays mounted (later screens are only
 * hidden), so the server action receives exactly the fields the old long form
 * sent, and the validation in src/lib/journey.ts is unchanged. When the server
 * rejects something, the quiz jumps back to the screen that holds that field.
 */

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

type Screen = {
  /** Form field names on this screen — how a server error finds its way back here. */
  fields: string[];
  /** Answering the one question moves straight on; no Continue button. */
  autoAdvance?: boolean;
};

const SCREENS: Screen[] = [
  { fields: ["indication"], autoAdvance: true },
  { fields: ["familial_hypercholesterolemia"], autoAdvance: true },
  { fields: ["ldl_c", "ldl_c_date"] },
  { fields: screenings.map(([name]) => name) },
  { fields: ["enrolled_in_government_insurance"], autoAdvance: true },
  { fields: ["first_name", "last_name", "date_of_birth", "sex"] },
  { fields: ["email", "phone", "address_line1", "address_line2", "city", "state", "postal_code", "address"] },
  { fields: ["attestations_confirmed", "attestations"] },
];
const LAST = SCREENS.length - 1;

/** "/intake_form/data/ldl_c" → the screen holding ldl_c; "/address/city" → the address screen. */
function screenForPointer(pointer: string | undefined): number | null {
  if (!pointer) return null;
  const parts = pointer.split("/").filter(Boolean);
  for (const part of [...parts].reverse()) {
    const index = SCREENS.findIndex((s) => s.fields.includes(part));
    if (index >= 0) return index;
  }
  return null;
}

const noSubscribe = () => () => {};

/**
 * Shown only if the page's JavaScript never runs — the quiz can't move without
 * it. Rendered by the server and dropped once the page hydrates; the CSS holds
 * it back a few seconds, so a normal load never flashes it. The usual cause is
 * the dev server, which only sends its scripts to localhost.
 */
function NotLoadedNotice() {
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  if (hydrated) return null;
  return (
    <p className="quiz-not-loaded" role="status">
      <strong>This page didn&rsquo;t finish loading</strong>, so the questions can&rsquo;t move on.{" "}
      {process.env.NODE_ENV === "development"
        ? <>In development, open it at <code>localhost</code> — the dev server doesn&rsquo;t send its scripts to other addresses, such as a tunnel or your laptop&rsquo;s network address.</>
        : <>Check JavaScript is enabled, then reload.</>}
    </p>
  );
}

export function IntakeForm({ brandName }: { brandName: string }) {
  const [state, action, pending] = useActionState(createJourneyAction, INITIAL_JOURNEY_STATE);
  const failed = state.status === "failed";
  const feedbackRef = useScrollToFeedback(state, failed);
  const retrying = failed && Boolean(state.patientId);
  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const headingRefs = useRef<Array<HTMLElement | null>>([]);
  const [screen, setScreen] = useState(0);
  const [anyScreening, setAnyScreening] = useState(false);

  // A fresh sample email per visit — the shared sandbox rejects one that was already used.
  // Filled after mount so the server and client render the same (empty) initial value.
  useEffect(() => {
    const input = emailRef.current;
    if (input && !input.value) input.value = `sample.patient+${Date.now()}@example.com`;
  }, []);

  function go(to: number) {
    setScreen(to);
    requestAnimationFrame(() => {
      // Move focus with the screen, so keyboard and screen-reader users land on the new question.
      headingRefs.current[to]?.focus({ preventScroll: true });
      // After a long screen, the next question would start above the fold — bring its top back into view.
      const form = formRef.current;
      const header = document.querySelector<HTMLElement>(".site-header");
      const offset = (header?.offsetHeight ?? 0) + 16;
      if (form && form.getBoundingClientRect().top < offset) {
        window.scrollTo({ top: form.getBoundingClientRect().top + window.scrollY - offset, behavior: "smooth" });
      }
    });
  }

  /** Browser validation for one screen's fields, shown on that screen. */
  function screenValid(index: number): boolean {
    const form = formRef.current;
    if (!form) return true;
    for (const name of SCREENS[index].fields) {
      const element = form.elements.namedItem(name);
      const inputs = element instanceof RadioNodeList ? [...element] : element ? [element] : [];
      for (const input of inputs) {
        if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement) {
          if (!input.checkValidity()) {
            if (index !== screen) go(index);
            requestAnimationFrame(() => input.reportValidity());
            return false;
          }
        }
      }
    }
    return true;
  }

  function next() {
    if (screenValid(screen)) go(Math.min(screen + 1, LAST));
  }

  // Enter on an earlier screen means "continue", not "submit the whole intake".
  // On the last one, check every screen first — a hidden field can't show its own error.
  // Submitting by hand (rather than via the form's action) also keeps the answers
  // in place if Lithos rejects the intake; a form action would reset them.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (screen < LAST) return next();
    for (let i = 0; i < SCREENS.length; i++) if (!screenValid(i)) return;
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  }

  // When the intake comes back rejected, open the screen the first error is about.
  useEffect(() => {
    if (state.status !== "failed" || state.stage === "connection") return;
    const target = state.errors.map((e) => screenForPointer(e.source?.pointer)).find((i) => i !== null);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the server's answer, once per response
    if (target !== undefined && target !== null) setScreen(target);
  }, [state]);

  function autoAdvance() {
    // A beat to see the choice register before the next question slides in.
    window.setTimeout(() => go(Math.min(screen + 1, LAST)), 180);
  }

  const q = (index: number, title: ReactNode, hint?: ReactNode) => (
    <header className="quiz-question">
      <h2 tabIndex={-1} ref={(el) => { headingRefs.current[index] = el; }}>{title}</h2>
      {hint && <p className="hint">{hint}</p>}
    </header>
  );

  return (
    <form ref={formRef} action={action} onSubmit={onSubmit} noValidate className="quiz">
      <div className="quiz-progress" role="progressbar" aria-label="Intake progress" aria-valuemin={1} aria-valuemax={SCREENS.length} aria-valuenow={screen + 1}>
        <span style={{ width: `${((screen + 1) / SCREENS.length) * 100}%` }} />
      </div>

      <NotLoadedNotice />

      <div ref={feedbackRef} className="feedback-anchor">
        {failed && state.stage === "connection" && (
          <NotConnected
            action="Submitting this form creates a patient, a care plan and an encounter"
            outcome="a licensed clinician reviews the intake and decides on treatment"
          />
        )}

        {failed && state.stage !== "connection" && (
          <section className="error-box" aria-live="polite">
            <h2>{state.stage === "validation" ? "Please check your details" : "We couldn't complete your intake"}</h2>
            {state.httpStatus && <p className="muted">The clinical service responded with HTTP {state.httpStatus}.</p>}
            <ul>
              {state.errors.map((error, index) => {
                const target = screenForPointer(error.source?.pointer);
                return (
                  <li key={`${error.code}-${index}`}>
                    {error.message}
                    {error.source?.pointer && <code className="muted"> {error.source.pointer}</code>}
                    {target !== null && target !== screen && (
                      <> <button type="button" className="link-button" onClick={() => go(target)}>Fix this</button></>
                    )}
                  </li>
                );
              })}
            </ul>
            {retrying && <p className="muted">Your details were saved — retrying will pick up where it left off.</p>}
          </section>
        )}
      </div>

      {failed && state.patientId && <input type="hidden" name="resume_patient_id" value={state.patientId} />}
      {failed && state.carePlanId && <input type="hidden" name="resume_care_plan_id" value={state.carePlanId} />}

      <div className="quiz-screen" hidden={screen !== 0}>
        {q(0, `What brings you to ${brandName}?`, "A care review adds a clinician to your membership. Start with what you want help with.")}
        <div className="quiz-options">
          <Option name="indication" value="hypercholesterolemia" onPick={autoAdvance} required>My cholesterol is high</Option>
          <Option name="indication" value="cardiovascular_risk_reduction" onPick={autoAdvance}>I want to lower my heart-disease risk</Option>
        </div>
      </div>

      <div className="quiz-screen" hidden={screen !== 1}>
        {q(1, "Has a doctor ever told you that you have familial hypercholesterolemia?", "An inherited condition that keeps LDL cholesterol high from birth.")}
        <div className="quiz-options">
          <Option name="familial_hypercholesterolemia" value="none" onPick={autoAdvance} required>No</Option>
          <Option name="familial_hypercholesterolemia" value="heterozygous" onPick={autoAdvance}>Yes — heterozygous</Option>
          <Option name="familial_hypercholesterolemia" value="homozygous" onPick={autoAdvance}>Yes — homozygous</Option>
          <Option name="familial_hypercholesterolemia" value="unknown" onPick={autoAdvance}>I&rsquo;m not sure</Option>
        </div>
      </div>

      <div className="quiz-screen" hidden={screen !== 2}>
        {q(2, "What was your most recent LDL cholesterol?", "Use your latest lab result. If you don’t have one, enter your best estimate and we’ll order labs.")}
        <div className="field-grid">
          <label className="field">LDL-C (mg/dL)<input name="ldl_c" type="number" min="1" step="1" defaultValue="160" required /></label>
          <label className="field">Date of that result<input name="ldl_c_date" type="date" defaultValue="2025-01-15" required /></label>
        </div>
      </div>

      <div className="quiz-screen" hidden={screen !== 3}>
        {q(3, "Do any of these apply to you?", "These help your clinician choose a treatment that’s safe for you. Select all that apply.")}
        <div className="quiz-options" onChange={() => setAnyScreening(screenings.some(([name]) => (formRef.current?.elements.namedItem(name) as HTMLInputElement | null)?.checked))}>
          {screenings.map(([name, label]) => (
            <label key={name} className="quiz-option quiz-option-multi">
              <input type="checkbox" name={name} /> <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="quiz-screen" hidden={screen !== 4}>
        {q(4, "Are you enrolled in Medicare, Medicaid, or another government insurance plan?")}
        <div className="quiz-options">
          <Option name="enrolled_in_government_insurance" value="false" onPick={autoAdvance} required>No</Option>
          <Option name="enrolled_in_government_insurance" value="true" onPick={autoAdvance}>Yes</Option>
        </div>
      </div>

      <div className="quiz-screen" hidden={screen !== 5}>
        {q(5, "Tell us about you", "Sample details only — use a Sample or Test name.")}
        <div className="field-grid">
          <label className="field">First name<input name="first_name" defaultValue="Sample" autoComplete="off" required /></label>
          <label className="field">Last name<input name="last_name" defaultValue="Patient" autoComplete="off" required /></label>
          <label className="field">Date of birth<input name="date_of_birth" type="date" defaultValue="1990-01-15" required /></label>
          <label className="field">Sex at birth<select name="sex" defaultValue="female" required><option value="female">Female</option><option value="male">Male</option></select></label>
        </div>
      </div>

      <div className="quiz-screen" hidden={screen !== 6}>
        {q(6, "Where can your care team reach you?", "Sample details only — an example.com email and a 555 phone number.")}
        <div className="field-grid">
          <label className="field">Email<input ref={emailRef} name="email" type="email" placeholder="you@example.com" autoComplete="off" required /></label>
          <label className="field">Phone<input name="phone" type="tel" defaultValue="+12025550123" autoComplete="off" required /></label>
          <label className="field wide">Street address<input name="address_line1" defaultValue="123 Sample Street" autoComplete="off" required /></label>
          <label className="field">Apt / unit <small>(optional)</small><input name="address_line2" autoComplete="off" /></label>
          <label className="field">City<input name="city" defaultValue="Washington" autoComplete="off" required /></label>
          <label className="field">State<input name="state" defaultValue="DC" maxLength={2} autoComplete="off" required /></label>
          <label className="field">ZIP code<input name="postal_code" defaultValue="20001" autoComplete="off" required /></label>
        </div>
      </div>

      <div className="quiz-screen" hidden={screen !== LAST}>
        {q(LAST, "Last step: your consent", "Your intake goes to a licensed clinician in your state, who reviews it and decides on treatment.")}
        <label className="consent">
          <input type="checkbox" name="attestations_confirmed" required />
          <span>I consent to receive care through telehealth and confirm that the identity details I gave are mine. <span className="muted">(Demo: this records a sample consent and sample identity verification.)</span></span>
        </label>
      </div>

      <div className="quiz-nav">
        {screen > 0 && (
          <button type="button" className="btn btn-ghost" onClick={() => go(screen - 1)} disabled={pending}>Back</button>
        )}
        {screen === LAST ? (
          <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
            {pending ? "Sending to our clinical team…" : retrying ? "Try again" : "Start my care plan"}
          </button>
        ) : (
          !SCREENS[screen].autoAdvance && (
            <button type="submit" className="btn btn-primary btn-lg">
              {screen === 3 && !anyScreening ? "None of these apply" : "Continue"}
            </button>
          )
        )}
        <span className="muted quiz-count">{screen + 1} of {SCREENS.length}</span>
      </div>
    </form>
  );
}

/** One answer to a single-choice question: a full-width pill that answers and moves on. */
function Option({ name, value, onPick, required, children }: { name: string; value: string; onPick: () => void; required?: boolean; children: ReactNode }) {
  return (
    <label className="quiz-option">
      {/* onClick, not onChange: tapping the answer you already gave (after going Back) should still move on. */}
      <input type="radio" name={name} value={value} required={required} onClick={onPick} />
      <span>{children}</span>
    </label>
  );
}
