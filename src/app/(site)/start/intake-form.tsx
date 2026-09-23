"use client";

import { useScrollToFeedback } from "@/lib/use-scroll-to-feedback";
import { startTransition, useActionState, useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { createJourneyAction } from "../actions";
import { INITIAL_JOURNEY_STATE } from "@/lib/journey";
import { NotConnected } from "../not-connected";
import type { ProgramKey } from "@/lib/setup/programs";
import type { IntakeStyle } from "@/lib/intake/styles";
import { WEIGHT_COMORBIDITIES, WEIGHT_SCREENING_HEALTH, WEIGHT_SCREENING_ORGANS } from "@/lib/intake/weight";

/*
 * The intake as a quiz: one question per screen, a progress bar, and
 * single-choice questions that move on as soon as you answer — the shape most
 * consumer telehealth intakes take.
 *
 * The first screens are the program's own — lipid management asks about LDL-C,
 * weight management about height, weight and GLP-1s — followed by the screens
 * every program shares: insurance, about you, contact, consent. The program
 * comes from starter.config.json, so switching it in /setup changes the quiz.
 *
 * It is still one <form>. Every field stays mounted (later screens are only
 * hidden), so the server action receives every answer at once, and the
 * validation in src/lib/journey.ts decides what's valid. When the server
 * rejects something, the quiz jumps back to the screen that holds that field.
 */

// Field names are the Lithos lipid_management intake contract — keep them as-is.
const LIPID_SCREENING = [
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
  /** Form field names on this screen — and the API field names an error can point at. */
  fields: string[];
  /** Answering the one question moves straight on; no Continue button. */
  autoAdvance?: boolean;
  /** A "select all that apply" list: the button reads "None of these apply" until something is ticked. */
  checklist?: readonly (readonly [string, string])[];
  title: ReactNode;
  hint?: ReactNode;
  body: ReactNode;
};

/** "/intake_form/data/ldl_c" → the screen holding ldl_c; "/address/city" → the address screen. */
function screenForPointer(screens: Screen[], pointer: string | undefined): number | null {
  if (!pointer) return null;
  const parts = pointer.split("/").filter(Boolean);
  for (const part of [...parts].reverse()) {
    const index = screens.findIndex((s) => s.fields.includes(part));
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

/**
 * `style` is the intake style chosen in /setup: "quiz" shows one screen at a
 * time; "form" shows every screen at once as sections of one page. Same
 * screens, same fields, same validation either way.
 */
export function IntakeForm({ brandName, program, style }: { brandName: string; program: ProgramKey; style: IntakeStyle }) {
  const quiz = style === "quiz";
  const [state, action, pending] = useActionState(createJourneyAction, INITIAL_JOURNEY_STATE);
  const failed = state.status === "failed";
  const feedbackRef = useScrollToFeedback(state, failed);
  const retrying = failed && Boolean(state.patientId);
  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const headingRefs = useRef<Array<HTMLElement | null>>([]);
  const screenRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [screen, setScreen] = useState(0);
  // Which checklist screens have something ticked — keyed by screen index.
  const [ticked, setTicked] = useState<Record<number, boolean>>({});

  // A fresh sample email per visit — the shared sandbox rejects one that was already used.
  // Filled after mount so the server and client render the same (empty) initial value.
  useEffect(() => {
    const input = emailRef.current;
    if (input && !input.value) input.value = `sample.patient+${Date.now()}@example.com`;
  }, []);

  function go(to: number) {
    if (!quiz) {
      // One page: "going to" a section means scrolling to it.
      screenRefs.current[to]?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
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

  function autoAdvance() {
    if (!quiz) return;
    // A beat to see the choice register before the next question slides in.
    // Never the last screen — that's consent, which has its own button.
    window.setTimeout(() => go(screen + 1), 180);
  }

  const checklist = (index: number, items: readonly (readonly [string, string])[]) => (
    <div
      className="quiz-options"
      onChange={() => setTicked((t) => ({ ...t, [index]: items.some(([name]) => (formRef.current?.elements.namedItem(name) as HTMLInputElement | null)?.checked) }))}
    >
      {items.map(([name, label]) => (
        <label key={name} className="quiz-option quiz-option-multi">
          <input type="checkbox" name={name} /> <span>{label}</span>
        </label>
      ))}
    </div>
  );

  const programScreens: Screen[] = program === "weight_management"
    ? [
        {
          fields: ["weight_goal"], autoAdvance: true,
          title: `Welcome to ${brandName}. How much weight do you want to lose?`,
          hint: "A few minutes of questions, then a licensed clinician reviews your answers and decides on treatment.",
          body: (
            <div className="quiz-options">
              <Option name="weight_goal" value="up_to_20" onPick={autoAdvance} required>Up to 20 lbs</Option>
              <Option name="weight_goal" value="20_to_50" onPick={autoAdvance}>20 to 50 lbs</Option>
              <Option name="weight_goal" value="over_50" onPick={autoAdvance}>More than 50 lbs</Option>
              <Option name="weight_goal" value="unsure" onPick={autoAdvance}>I&rsquo;m not sure yet</Option>
            </div>
          ),
        },
        {
          fields: ["height_ft", "height_in", "weight_lb", "height_cm", "weight_kg"],
          title: "What's your height and weight?",
          hint: "Your clinician uses these to work out your BMI — one of the things that decides whether a GLP-1 is right for you.",
          body: (
            <div className="field-grid">
              <label className="field">Height (feet)<input name="height_ft" type="number" min="3" max="8" step="1" defaultValue="5" required /></label>
              <label className="field">Height (inches)<input name="height_in" type="number" min="0" max="11" step="1" defaultValue="7" required /></label>
              <label className="field">Weight (lbs)<input name="weight_lb" type="number" min="70" max="1100" step="1" defaultValue="215" required /></label>
            </div>
          ),
        },
        {
          fields: ["already_on_glp1"], autoAdvance: true,
          title: "Are you taking a GLP-1 medication right now?",
          hint: "For example Wegovy, Zepbound, Ozempic or Mounjaro.",
          body: (
            <div className="quiz-options">
              <Option name="already_on_glp1" value="false" onPick={autoAdvance} required>No</Option>
              <Option name="already_on_glp1" value="true" onPick={autoAdvance}>Yes</Option>
            </div>
          ),
        },
        {
          fields: WEIGHT_SCREENING_ORGANS.map(([name]) => name), checklist: WEIGHT_SCREENING_ORGANS,
          title: "Have you ever had any of these?",
          hint: "These help your clinician choose a treatment that's safe for you. Select all that apply.",
          body: null,
        },
        {
          fields: WEIGHT_SCREENING_HEALTH.map(([name]) => name), checklist: WEIGHT_SCREENING_HEALTH,
          title: "And any of these?",
          hint: "Select all that apply.",
          body: null,
        },
        {
          fields: [...WEIGHT_COMORBIDITIES.map(([key]) => `comorbidity_${key}`), "comorbidities"],
          checklist: WEIGHT_COMORBIDITIES.map(([key, label]) => [`comorbidity_${key}`, label] as const),
          title: "Do you have any weight-related conditions?",
          hint: "Losing weight often improves these, so your clinician will want to know. Select all that apply.",
          body: null,
        },
      ]
    : [
        {
          fields: ["indication"], autoAdvance: true,
          title: `What brings you to ${brandName}?`,
          hint: "A care review adds a clinician to your membership. Start with what you want help with.",
          body: (
            <div className="quiz-options">
              <Option name="indication" value="hypercholesterolemia" onPick={autoAdvance} required>My cholesterol is high</Option>
              <Option name="indication" value="cardiovascular_risk_reduction" onPick={autoAdvance}>I want to lower my heart-disease risk</Option>
            </div>
          ),
        },
        {
          fields: ["familial_hypercholesterolemia"], autoAdvance: true,
          title: "Has a doctor ever told you that you have familial hypercholesterolemia?",
          hint: "An inherited condition that keeps LDL cholesterol high from birth.",
          body: (
            <div className="quiz-options">
              <Option name="familial_hypercholesterolemia" value="none" onPick={autoAdvance} required>No</Option>
              <Option name="familial_hypercholesterolemia" value="heterozygous" onPick={autoAdvance}>Yes — heterozygous</Option>
              <Option name="familial_hypercholesterolemia" value="homozygous" onPick={autoAdvance}>Yes — homozygous</Option>
              <Option name="familial_hypercholesterolemia" value="unknown" onPick={autoAdvance}>I&rsquo;m not sure</Option>
            </div>
          ),
        },
        {
          fields: ["ldl_c", "ldl_c_date"],
          title: "What was your most recent LDL cholesterol?",
          hint: "Use your latest lab result. If you don’t have one, enter your best estimate and we’ll order labs.",
          body: (
            <div className="field-grid">
              <label className="field">LDL-C (mg/dL)<input name="ldl_c" type="number" min="1" step="1" defaultValue="160" required /></label>
              <label className="field">Date of that result<input name="ldl_c_date" type="date" defaultValue="2025-01-15" required /></label>
            </div>
          ),
        },
        {
          fields: LIPID_SCREENING.map(([name]) => name), checklist: LIPID_SCREENING,
          title: "Do any of these apply to you?",
          hint: "These help your clinician choose a treatment that’s safe for you. Select all that apply.",
          body: null,
        },
      ];

  const screens: Screen[] = [
    ...programScreens,
    {
      fields: ["enrolled_in_government_insurance"], autoAdvance: true,
      title: "Are you enrolled in Medicare, Medicaid, or another government insurance plan?",
      body: (
        <div className="quiz-options">
          <Option name="enrolled_in_government_insurance" value="false" onPick={autoAdvance} required>No</Option>
          <Option name="enrolled_in_government_insurance" value="true" onPick={autoAdvance}>Yes</Option>
        </div>
      ),
    },
    {
      fields: ["first_name", "last_name", "date_of_birth", "sex"],
      title: "Tell us about you",
      hint: "Sample details only — use a Sample or Test name.",
      body: (
        <div className="field-grid">
          <label className="field">First name<input name="first_name" defaultValue="Sample" autoComplete="off" required /></label>
          <label className="field">Last name<input name="last_name" defaultValue="Patient" autoComplete="off" required /></label>
          <label className="field">Date of birth<input name="date_of_birth" type="date" defaultValue="1990-01-15" required /></label>
          <label className="field">Sex at birth<select name="sex" defaultValue="female" required><option value="female">Female</option><option value="male">Male</option></select></label>
        </div>
      ),
    },
    {
      fields: ["email", "phone", "address_line1", "address_line2", "city", "state", "postal_code", "address"],
      title: "Where can your care team reach you?",
      hint: "Sample details only — an example.com email and a 555 phone number.",
      body: (
        <div className="field-grid">
          <label className="field">Email<input ref={emailRef} name="email" type="email" placeholder="you@example.com" autoComplete="off" required /></label>
          <label className="field">Phone<input name="phone" type="tel" defaultValue="+12025550123" autoComplete="off" required /></label>
          <label className="field wide">Street address<input name="address_line1" defaultValue="123 Sample Street" autoComplete="off" required /></label>
          <label className="field">Apt / unit <small>(optional)</small><input name="address_line2" autoComplete="off" /></label>
          <label className="field">City<input name="city" defaultValue="Washington" autoComplete="off" required /></label>
          <label className="field">State<input name="state" defaultValue="DC" maxLength={2} autoComplete="off" required /></label>
          <label className="field">ZIP code<input name="postal_code" defaultValue="20001" autoComplete="off" required /></label>
        </div>
      ),
    },
    {
      fields: ["attestations_confirmed", "attestations"],
      title: "Last step: your consent",
      hint: "Your intake goes to a licensed clinician in your state, who reviews it and decides on treatment.",
      body: (
        <label className="consent">
          <input type="checkbox" name="attestations_confirmed" required />
          <span>I consent to receive care through telehealth and confirm that the identity details I gave are mine. <span className="muted">(Demo: this records a sample consent and sample identity verification.)</span></span>
        </label>
      ),
    },
  ];
  const last = screens.length - 1;

  /** Browser validation for one screen's fields, shown on that screen. */
  function screenValid(index: number): boolean {
    const form = formRef.current;
    if (!form) return true;
    for (const name of screens[index].fields) {
      const element = form.elements.namedItem(name);
      const inputs = element instanceof RadioNodeList ? [...element] : element ? [element] : [];
      for (const input of inputs) {
        if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement) {
          if (!input.checkValidity()) {
            if (quiz && index !== screen) go(index);
            requestAnimationFrame(() => input.reportValidity());
            return false;
          }
        }
      }
    }
    return true;
  }

  function next() {
    if (screenValid(screen)) go(Math.min(screen + 1, last));
  }

  // Enter on an earlier screen means "continue", not "submit the whole intake".
  // On the last one, check every screen first — a hidden field can't show its own error.
  // Submitting by hand (rather than via the form's action) also keeps the answers
  // in place if Lithos rejects the intake; a form action would reset them.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (quiz && screen < last) return next();
    for (let i = 0; i < screens.length; i++) if (!screenValid(i)) return;
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  }

  // When the intake comes back rejected, open the screen the first error is about.
  const fieldsKey = screens.map((s) => s.fields.join()).join("|");
  useEffect(() => {
    if (state.status !== "failed" || state.stage === "connection") return;
    const target = state.errors.map((e) => screenForPointer(screens, e.source?.pointer)).find((i) => i !== null);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the server's answer, once per response
    if (target !== undefined && target !== null && quiz) setScreen(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the screens are rebuilt every render; their fields are what matter
  }, [state, fieldsKey]);

  const current = screens[screen];

  return (
    <form ref={formRef} action={action} onSubmit={onSubmit} noValidate className={quiz ? "quiz" : "quiz quiz-single-page"}>
      {quiz && (
        <div className="quiz-progress" role="progressbar" aria-label="Intake progress" aria-valuemin={1} aria-valuemax={screens.length} aria-valuenow={screen + 1}>
          <span style={{ width: `${((screen + 1) / screens.length) * 100}%` }} />
        </div>
      )}

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
                const target = screenForPointer(screens, error.source?.pointer);
                return (
                  <li key={`${error.code}-${index}`}>
                    {error.message}
                    {error.source?.pointer && <code className="muted"> {error.source.pointer}</code>}
                    {target !== null && (!quiz || target !== screen) && (
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

      {screens.map((s, index) => (
        <div key={index} ref={(el) => { screenRefs.current[index] = el; }} className="quiz-screen" hidden={quiz && screen !== index}>
          <header className="quiz-question">
            <h2 tabIndex={-1} ref={(el) => { headingRefs.current[index] = el; }}>{s.title}</h2>
            {s.hint && <p className="hint">{s.hint}</p>}
          </header>
          {s.checklist ? checklist(index, s.checklist) : s.body}
        </div>
      ))}

      {!quiz && (
        <div className="quiz-nav">
          <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
            {pending ? "Sending to our clinical team…" : retrying ? "Try again" : "Start my care plan"}
          </button>
        </div>
      )}

      {quiz && <div className="quiz-nav">
        {screen > 0 && (
          <button type="button" className="btn btn-ghost" onClick={() => go(screen - 1)} disabled={pending}>Back</button>
        )}
        {screen === last ? (
          <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
            {pending ? "Sending to our clinical team…" : retrying ? "Try again" : "Start my care plan"}
          </button>
        ) : (
          !current.autoAdvance && (
            <button type="submit" className="btn btn-primary btn-lg">
              {current.checklist && !ticked[screen] ? "None of these apply" : "Continue"}
            </button>
          )
        )}
        <span className="muted quiz-count">{screen + 1} of {screens.length}</span>
      </div>}
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
