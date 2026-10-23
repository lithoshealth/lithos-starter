"use client";

import { useScrollToFeedback } from "@/lib/use-scroll-to-feedback";
import { Fragment, startTransition, useActionState, useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { createJourneyAction } from "../actions";
import { INITIAL_JOURNEY_STATE } from "@/lib/journey";
import { NotConnected } from "../not-connected";
import { VisitStep } from "../_visit/visit-step";
import { intakeKey, type ProgramKey } from "@/lib/setup/programs";
import type { IntakeStyle } from "@/lib/intake/styles";
import { WEIGHT_COMORBIDITIES, WEIGHT_SCREENING_HEALTH, WEIGHT_SCREENING_ORGANS } from "@/lib/intake/weight";
import { LIPID_SCREENING } from "@/lib/intake/lipid";
import { GENERIC_SCREENING } from "@/lib/intake/generic";
import {
  ACNE_AREAS, ACNE_IMPACT, ACNE_LESIONS, ACNE_SCARRING, ACNE_SCREENING_HEALTH, ACNE_SCREENING_SKIN, DURATIONS, FITZPATRICK,
  HP_AREAS, HP_ATYPICAL_SIGNS, HP_CONCERNS, HP_SCREENING_HEALTH, HP_SCREENING_RECENT, HP_SKIN_CANCER, HP_TRIGGERS,
  ISOTRETINOIN_USE, photosFor, SPOT_PHOTO, TRUNK_PHOTO, type PhotoField,
} from "@/lib/intake/derm";
import {
  EYE_COLORS, EYELASH_CONSENT, EYELASH_SCREENING_EYES, EYELASH_SCREENING_HEALTH, EYELASH_SCREENING_LIDS, EYES_AFFECTED,
  LASH_GOALS, LASH_ONSETS, LASH_SERVICES,
} from "@/lib/intake/eyelash";
import {
  B12_SCREENING_ABSORPTION, B12_SCREENING_HEALTH, B12_SYMPTOMS, GLUTATHIONE_GOALS, GLUTATHIONE_SCREENING, NAD_GOALS,
  NAD_SCREENING, OXYTOCIN_CONCERNS, OXYTOCIN_CONSENT,
  OXYTOCIN_SCREENING_HEALTH, OXYTOCIN_SCREENING_MENTAL, OXYTOCIN_SLEEP_DISORDERS, OXYTOCIN_SUICIDE_SCREEN,
  SERMORELIN_GOALS, SERMORELIN_INTERACTIONS, SERMORELIN_SCREENING,
} from "@/lib/intake/wellness";
import {
  BLOOD_PRESSURE_SETTINGS, CARDIOVASCULAR_RISK_FACTORS, CLIMBS_TWO_FLIGHTS, ED_CONSISTENCY, ED_GOALS, ED_HISTORY, ED_ONSETS,
  ED_SCREENING_HEALTH, ED_SCREENING_HEART, ED_SCREENING_MEDICINES, NITRATE_ACKNOWLEDGMENT, RELATED_MEDICATIONS,
} from "@/lib/intake/ed";
import {
  FINASTERIDE_RISKS, HAIR_AREAS, HAIR_CHANGES, HAIR_FERTILITY, HAIR_GOALS, HAIR_PACES, HAIR_SCREENING_HEALTH,
  HAIR_SCREENING_MEDICINES, HAIR_SCREENING_MOOD, HAIR_SCREENING_SIGNS,
} from "@/lib/intake/hair-loss";
import {
  HSV_DIAGNOSIS_METHODS, HSV_GOALS, HSV_IMPACTS, HSV_ONSETS, HSV_SCREENING_EPISODE, HSV_SCREENING_HEALTH,
  HSV_SCREENING_MEDICINES, HSV_SCREENING_URGENT, HSV_WANTS,
} from "@/lib/intake/hsv";
import { newAttemptKey } from "../../idempotency-field";

const FORM_ID = "intake-form";

// A sample blood pressure reading from a month ago: Lithos wants one from the last 6 months.
const RECENT_READING = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

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
  /**
   * How the answer reads back as a chat reply, with `{field}` for a field's
   * value — e.g. "{height_ft} ft {height_in} in, {weight_lb} lbs". Unset: the
   * choice picked, the boxes ticked, or the values entered.
   */
  reply?: string;
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
 * `style` is the intake style chosen in /setup. Both ask one screen at a time:
 * "quiz" as a page per question with a progress bar; "chat" as a conversation,
 * each question a message and each answer a reply bubble. Same screens, same
 * fields, same validation either way — only the presentation differs.
 */
export function IntakeForm({ brandName, program, style }: { brandName: string; program: ProgramKey; style: IntakeStyle }) {
  const chat = style === "chat";
  const [state, action, pending] = useActionState(createJourneyAction, INITIAL_JOURNEY_STATE);
  const attempt = useRef("");
  useEffect(() => { attempt.current = ""; }, [state]);
  const failed = state.status === "failed";
  const feedbackRef = useScrollToFeedback(state, failed);
  const retrying = failed && Boolean(state.patientId);
  const choosingVisit = state.status === "needs_visit";
  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const headingRefs = useRef<Array<HTMLElement | null>>([]);
  const screenRefs = useRef<Array<HTMLDivElement | null>>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const [screen, setScreen] = useState(0);
  // Chat only: each answered screen's reply, as it reads in the transcript.
  const [replies, setReplies] = useState<Record<number, string>>({});
  // Which checklist screens have something ticked — keyed by screen index.
  const [ticked, setTicked] = useState<Record<number, boolean>>({});

  // A fresh sample email per visit — the shared sandbox rejects one that was already used.
  // Filled after mount so the server and client render the same (empty) initial value.
  useEffect(() => {
    const input = emailRef.current;
    if (input && !input.value) input.value = `sample.patient+${Date.now()}@example.com`;
  }, []);

  /** Read an answered screen back as a sentence, for the chat transcript. */
  function replyFor(index: number): string {
    const el = screenRefs.current[index];
    const form = formRef.current;
    if (!el || !form) return "";
    // Read from the element, not the screen list — this runs before the list is built.
    const template = el.dataset.reply;
    if (template) {
      const data = new FormData(form);
      return template.replace(/\{(\w+)\}/g, (_, name: string) => String(data.get(name) ?? "").trim());
    }
    const label = (input: Element) => input.closest("label")?.textContent?.trim() ?? "";
    const picked = [...el.querySelectorAll("input[type=radio]:checked")].map(label);
    if (picked.length > 0) return picked.join(", ");
    const boxes = [...el.querySelectorAll<HTMLInputElement>("input[type=checkbox]")];
    if (boxes.length > 0) return boxes.filter((b) => b.checked).map(label).join("; ") || "None of these";
    return [...el.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select")].map((i) => i.value).filter(Boolean).join(" · ");
  }

  function go(to: number) {
    if (chat && to > screen) {
      // Moving on: record every answer between here and there as a reply.
      const answered = Object.fromEntries(Array.from({ length: to - screen }, (_, i) => [screen + i, replyFor(screen + i)]));
      setReplies((r) => ({ ...r, ...answered }));
    }
    setScreen(to);
    if (chat) {
      requestAnimationFrame(() => {
        const log = logRef.current;
        if (log) log.scrollTop = log.scrollHeight;
        screenRefs.current[to]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        screenRefs.current[to]?.querySelector<HTMLElement>("input, select, button")?.focus({ preventScroll: true });
      });
      return;
    }
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

  // One answer from a list: picking it moves on.
  const pickOne = (name: string, options: readonly (readonly [string, string])[]) => (
    <div className="quiz-options">
      {options.map(([value, label], i) => (
        <Option key={value} name={name} value={value} onPick={autoAdvance} required={i === 0}>{label}</Option>
      ))}
    </div>
  );
  // Several answers to one field, sent as a list (`affected_areas`, `lesion_types`, …).
  // Nothing is ticked to start with: a pre-ticked box reads as an answer the patient gave.
  const pickSome = (name: string, options: readonly (readonly [string, string])[]) => (
    <div className="quiz-options">
      {options.map(([value, label]) => (
        <label key={value} className="quiz-option quiz-option-multi">
          <input type="checkbox" name={name} value={value} /> <span>{label}</span>
        </label>
      ))}
    </div>
  );
  const yesNoScreen = (name: string) => (
    <div className="quiz-options">
      <Option name={name} value="true" onPick={autoAdvance} required>Yes</Option>
      <Option name={name} value="false" onPick={autoAdvance}>No</Option>
    </div>
  );
  const freeText = (
    <div className="field-grid">
      <label className="field wide">Medicines and allergies <small>(optional, one per line)</small><textarea name="medications_allergies" rows={3} maxLength={4000} /></label>
      <label className="field wide">Skin products you&rsquo;ve tried <small>(optional, one per line: the product, how long, whether it helped)</small><textarea name="prior_products" rows={3} maxLength={4000} defaultValue="Over-the-counter benzoyl peroxide wash, 2 months, helped a little" /></label>
    </div>
  );
  // The longevity programs' shared screens.
  const medicinesText = (label: string) => (
    <label className="field wide">{label} <small>(one per line; leave empty for none)</small><textarea name="medications_allergies" rows={3} maxLength={4000} /></label>
  );
  const heightWeightScreen = (hint: string): Screen => ({
    fields: ["height_ft", "height_in", "weight_lb", "height_cm", "weight_kg"], reply: "{height_ft} ft {height_in} in, {weight_lb} lbs",
    title: "What's your height and weight?", hint,
    body: (
      <div className="field-grid">
        <label className="field">Height (feet)<input name="height_ft" type="number" min="3" max="8" step="1" defaultValue="5" required /></label>
        <label className="field">Height (inches)<input name="height_in" type="number" min="0" max="11" step="1" defaultValue="10" required /></label>
        <label className="field">Weight (lbs)<input name="weight_lb" type="number" min="70" max="1100" step="1" defaultValue="180" required /></label>
      </div>
    ),
  });
  const selfInjectionScreen: Screen = {
    fields: ["can_self_administer"], autoAdvance: true,
    title: "Can you give yourself an injection under the skin, or do you have someone who will?",
    hint: "The medication is a small injection under the skin, a few times a week.",
    body: yesNoScreen("can_self_administer"),
  };
  const cancerTreatmentScreen: Screen = {
    fields: ["cancer_treatment_last_3_years", "oncologist_approval"], reply: "Cancer treatment in the last 3 years: {cancer_treatment_last_3_years}",
    title: "Have you had treatment for cancer in the last 3 years?",
    hint: "If you have, your clinician needs your oncologist's approval. This sandbox sends a sample approval letter.",
    body: (
      <div className="field-grid">
        <label className="field">Cancer treatment in the last 3 years?<select name="cancer_treatment_last_3_years" defaultValue="false" required><option value="false">No</option><option value="true">Yes</option></select></label>
        <label className="field">Has your oncologist approved this treatment? <small>(if yes)</small><select name="oncologist_approval" defaultValue="false"><option value="false">No</option><option value="true">Yes</option></select></label>
      </div>
    ),
  };
  const photoScreen = (photos: PhotoField[], note?: string): Screen => ({
    fields: photos.map((p) => p.field), reply: `${photos.length} sample photos`,
    title: "Photos of your skin",
    hint: "In your app, the patient takes these with their phone. This sandbox sends the sample images below instead — never upload a photo of a real person here.",
    body: (
      <div className="stack">
        <div className="sample-photos">
          {photos.map((p) => (
            <figure key={p.field}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a small static sample */}
              <img src={`/samples/${p.sample}`} alt="" width={90} height={112} />
              <figcaption>{p.label}</figcaption>
            </figure>
          ))}
        </div>
        {note && <p className="muted">{note}</p>}
      </div>
    ),
  });

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
          fields: ["height_ft", "height_in", "weight_lb", "height_cm", "weight_kg"], reply: "{height_ft} ft {height_in} in, {weight_lb} lbs",
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
    : intakeKey(program) === "lipid_management" ? [
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
          fields: ["ldl_c", "ldl_c_date"], reply: "{ldl_c} mg/dL, measured {ldl_c_date}",
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
      ]
    : program === "acne" ? [
        {
          fields: ["affected_areas"],
          title: `Welcome to ${brandName}. Where is your acne?`,
          hint: "Select all that apply.",
          body: pickSome("affected_areas", ACNE_AREAS),
        },
        { fields: ["lesion_types"], title: "What kinds of spots do you get?", hint: "Select all that apply.", body: pickSome("lesion_types", ACNE_LESIONS) },
        { fields: ["condition_duration"], autoAdvance: true, title: "How long have you had acne?", body: pickOne("condition_duration", DURATIONS) },
        { fields: ["scarring"], autoAdvance: true, title: "Has it left any scars?", body: pickOne("scarring", ACNE_SCARRING) },
        { fields: ["daily_life_impact"], autoAdvance: true, title: "How much does it affect your daily life?", body: pickOne("daily_life_impact", ACNE_IMPACT) },
        { fields: ["isotretinoin_use"], autoAdvance: true, title: "Have you ever taken isotretinoin (Accutane)?", body: pickOne("isotretinoin_use", ISOTRETINOIN_USE) },
        {
          fields: ["oral_antibiotic_last_3_months", "oral_antibiotic_courses"], reply: "Antibiotic in the last 3 months: {oral_antibiotic_last_3_months}. Courses so far: {oral_antibiotic_courses}",
          title: "Antibiotic pills for acne",
          body: (
            <div className="field-grid">
              <label className="field">In the last 3 months?<select name="oral_antibiotic_last_3_months" defaultValue="false" required><option value="false">No</option><option value="true">Yes</option></select></label>
              <label className="field">Courses you&rsquo;ve had in total<input name="oral_antibiotic_courses" type="number" min="0" step="1" defaultValue="0" required /></label>
            </div>
          ),
        },
        { fields: ["benzoyl_peroxide_attested"], autoAdvance: true, title: "Do you use a benzoyl peroxide wash every morning?", hint: "An over-the-counter acne wash, such as PanOxyl.", body: yesNoScreen("benzoyl_peroxide_attested") },
        { fields: ACNE_SCREENING_SKIN.map(([n]) => n), checklist: ACNE_SCREENING_SKIN, title: "Do any of these apply?", hint: "Select all that apply.", body: null },
        { fields: ACNE_SCREENING_HEALTH.map(([n]) => n), checklist: ACNE_SCREENING_HEALTH, title: "And any of these?", hint: "These help your clinician choose a treatment that's safe for you. Select all that apply.", body: null },
        { fields: ["medications_allergies", "prior_products"], title: "What do you take, and what have you tried?", body: freeText },
        photoScreen([...photosFor("acne", {}), TRUNK_PHOTO], "The chest, back or shoulders photo is only sent if you picked one of those."),
      ]
    : program === "hyperpigmentation_photoaging" ? [
        {
          fields: ["main_concerns"],
          title: `Welcome to ${brandName}. What would you like to treat?`,
          hint: "Select all that apply.",
          body: pickSome("main_concerns", HP_CONCERNS),
        },
        { fields: ["affected_areas"], title: "Where?", hint: "Select all that apply.", body: pickSome("affected_areas", HP_AREAS) },
        { fields: ["condition_duration"], autoAdvance: true, title: "How long have you had it?", body: pickOne("condition_duration", DURATIONS) },
        { fields: ["triggers"], title: "What brought it on, or makes it worse?", hint: "Select any that apply, or none.", body: pickSome("triggers", HP_TRIGGERS) },
        { fields: ["fitzpatrick_skin_type"], autoAdvance: true, title: "How does your skin react to the sun?", body: pickOne("fitzpatrick_skin_type", FITZPATRICK) },
        { fields: ["isotretinoin_use"], autoAdvance: true, title: "Have you ever taken isotretinoin (Accutane)?", body: pickOne("isotretinoin_use", ISOTRETINOIN_USE) },
        { fields: ["daily_sunscreen_use"], autoAdvance: true, title: "Do you wear sunscreen every day?", body: yesNoScreen("daily_sunscreen_use") },
        { fields: ["sunscreen_attested"], autoAdvance: true, title: "Will you wear SPF 30 or higher every day during treatment?", hint: "Treatment works far better, and is safer, with daily sunscreen.", body: yesNoScreen("sunscreen_attested") },
        { fields: ["atypical_spot", "atypical_spot_signs"], title: "Do you have a spot that…", hint: "Select any that apply, or none.", body: pickSome("atypical_spot_signs", HP_ATYPICAL_SIGNS) },
        { fields: ["skin_cancer_history"], autoAdvance: true, title: "Have you ever had skin cancer?", body: pickOne("skin_cancer_history", HP_SKIN_CANCER) },
        { fields: HP_SCREENING_RECENT.map(([n]) => n), checklist: HP_SCREENING_RECENT, title: "Any of these recently?", hint: "Select all that apply.", body: null },
        { fields: HP_SCREENING_HEALTH.map(([n]) => n), checklist: HP_SCREENING_HEALTH, title: "And any of these?", hint: "These help your clinician choose a treatment that's safe for you. Select all that apply.", body: null },
        { fields: ["medications_allergies", "prior_products"], title: "What do you take, and what have you tried?", body: freeText },
        photoScreen([...photosFor("acne", {}), SPOT_PHOTO]),
      ]
    : program === "eyelash_growth" ? [
        {
          fields: ["treatment_goals"],
          title: `Welcome to ${brandName}. What would you like for your lashes?`,
          hint: "Select all that apply.",
          body: pickSome("treatment_goals", LASH_GOALS),
        },
        { fields: ["condition_duration"], autoAdvance: true, title: "How long have your lashes been short or sparse?", body: pickOne("condition_duration", DURATIONS) },
        { fields: ["lash_loss_onset"], autoAdvance: true, title: "Did it happen gradually or suddenly?", body: pickOne("lash_loss_onset", LASH_ONSETS) },
        { fields: ["eyes_affected"], autoAdvance: true, title: "Is it both eyes, or one?", body: pickOne("eyes_affected", EYES_AFFECTED) },
        {
          fields: ["eye_color"], autoAdvance: true, title: "What color are your eyes?",
          hint: "The treatment can permanently darken the colored part of the eye. It shows most in hazel, green, blue, gray and mixed eyes.",
          body: pickOne("eye_color", EYE_COLORS),
        },
        { fields: EYELASH_SCREENING_LIDS.map(([n]) => n), checklist: EYELASH_SCREENING_LIDS, title: "Do any of these apply to your lashes or eyelids?", hint: "Select all that apply.", body: null },
        { fields: EYELASH_SCREENING_EYES.map(([n]) => n), checklist: EYELASH_SCREENING_EYES, title: "And to your eyes?", hint: "These help your clinician decide whether the treatment is safe for you. Select all that apply.", body: null },
        { fields: EYELASH_SCREENING_HEALTH.map(([n]) => n), checklist: EYELASH_SCREENING_HEALTH, title: "And any of these?", hint: "Select all that apply.", body: null },
        {
          fields: ["chemotherapy_history", "chemotherapy_current", "chemotherapy_last_dose_on"],
          reply: "Chemotherapy, ever: {chemotherapy_history}",
          title: "Have you ever had chemotherapy for cancer?",
          hint: "If you have, your clinician needs the date of your last dose and a clearance letter from your treating doctor. This sandbox sends a sample letter.",
          body: (
            <div className="field-grid">
              <label className="field">Chemotherapy, ever?<select name="chemotherapy_history" defaultValue="false" required><option value="false">No</option><option value="true">Yes</option></select></label>
              <label className="field">Still receiving it? <small>(if yes)</small><select name="chemotherapy_current" defaultValue="false"><option value="false">No</option><option value="true">Yes</option></select></label>
              <label className="field">Date of your last dose <small>(if yes)</small><input name="chemotherapy_last_dose_on" type="date" /></label>
            </div>
          ),
        },
        {
          fields: ["medications_allergies", "prior_lash_products"], title: "What do you take, and what have you tried?",
          body: (
            <div className="field-grid">
              <label className="field wide">Medicines, including every eye drop, and allergies <small>(one per line; leave empty for none)</small><textarea name="medications_allergies" rows={3} maxLength={4000} /></label>
              <label className="field wide">Lash serums you&rsquo;ve tried <small>(optional, one per line: the product, how long, whether it helped)</small><textarea name="prior_lash_products" rows={3} maxLength={4000} defaultValue="Over-the-counter lash serum, 2 months, no change" /></label>
            </div>
          ),
        },
        { fields: ["lash_cosmetic_services"], title: "Do you have lash extensions, a lift or tinting?", hint: "Select any that apply, or none.", body: pickSome("lash_cosmetic_services", LASH_SERVICES) },
        { fields: ["side_effects_consent_attested"], autoAdvance: true, title: "Do you understand the side effects?", hint: EYELASH_CONSENT, body: yesNoScreen("side_effects_consent_attested") },
      ]
    : program === "nad_plus" ? [
        {
          fields: ["treatment_goals", "baseline_symptoms"],
          title: `Welcome to ${brandName}. What would you like help with?`,
          hint: "Select all that apply.",
          body: (
            <div className="stack">
              {pickSome("treatment_goals", NAD_GOALS)}
              <label className="field wide">In your own words <small>(optional)</small><textarea name="baseline_symptoms" rows={2} maxLength={2000} /></label>
            </div>
          ),
        },
        { fields: NAD_SCREENING.map(([n]) => n), checklist: NAD_SCREENING, title: "Do any of these apply to you?", hint: "These help your clinician decide whether NAD+ is safe for you. Select all that apply.", body: null },
        {
          fields: ["nephrologist_approval"], autoAdvance: true,
          title: "If you have kidney disease, has a kidney specialist (nephrologist) approved this treatment?",
          hint: "Skip with “No” if you don't have kidney disease.",
          body: yesNoScreen("nephrologist_approval"),
        },
        selfInjectionScreen,
        { fields: ["medications_allergies"], title: "What do you take, and what are you allergic to?", body: medicinesText("Medicines, supplements and allergies") },
      ]
    : program === "glutathione" ? [
        {
          fields: ["treatment_goals", "baseline_symptoms"],
          title: `Welcome to ${brandName}. What would you like help with?`,
          hint: "Select all that apply.",
          body: (
            <div className="stack">
              {pickSome("treatment_goals", GLUTATHIONE_GOALS)}
              <label className="field wide">In your own words <small>(optional)</small><textarea name="baseline_symptoms" rows={2} maxLength={2000} /></label>
            </div>
          ),
        },
        { fields: GLUTATHIONE_SCREENING.map(([n]) => n), checklist: GLUTATHIONE_SCREENING, title: "Do any of these apply to you?", hint: "These help your clinician decide whether glutathione is safe for you. Select all that apply.", body: null },
        cancerTreatmentScreen,
        selfInjectionScreen,
        { fields: ["medications_allergies"], title: "What do you take, and what are you allergic to?", body: medicinesText("Medicines, supplements and allergies") },
      ]
    : program === "sermorelin" ? [
        {
          fields: ["treatment_goals"],
          title: `Welcome to ${brandName}. What would you like from treatment?`,
          hint: "Select all that apply.",
          body: pickSome("treatment_goals", SERMORELIN_GOALS),
        },
        heightWeightScreen("Your clinician tracks these to see how treatment is working."),
        { fields: SERMORELIN_SCREENING.map(([n]) => n), checklist: SERMORELIN_SCREENING, title: "Do any of these apply to you?", hint: "These help your clinician decide whether sermorelin is safe for you. Select all that apply.", body: null },
        { fields: ["interacting_medications"], title: "Do you take any of these?", hint: "Some medicines change how sermorelin works. Select any that apply, or none.", body: pickSome("interacting_medications", SERMORELIN_INTERACTIONS) },
        selfInjectionScreen,
        { fields: ["medications_allergies"], title: "What else do you take, and what are you allergic to?", body: medicinesText("Medicines, supplements and allergies") },
      ]
    : program === "vitamin_b12" ? [
        {
          fields: ["treatment_goals", "baseline_symptoms"],
          title: `Welcome to ${brandName}. What would you like help with?`,
          hint: "Select all that apply. This isn't treatment for a known B12 deficiency.",
          body: (
            <div className="stack">
              {pickSome("treatment_goals", B12_SYMPTOMS)}
              <label className="field wide">Describe your symptoms <small>(needed if you picked something else)</small><textarea name="baseline_symptoms" rows={2} maxLength={2000} /></label>
            </div>
          ),
        },
        { fields: ["condition_duration"], autoAdvance: true, title: "How long have you had these symptoms?", body: pickOne("condition_duration", DURATIONS) },
        { fields: B12_SCREENING_ABSORPTION.map(([n]) => n), checklist: B12_SCREENING_ABSORPTION, title: "Do any of these apply to you?", hint: "These affect how your body absorbs B12. Select all that apply.", body: null },
        { fields: B12_SCREENING_HEALTH.map(([n]) => n), checklist: B12_SCREENING_HEALTH, title: "And any of these?", hint: "These help your clinician decide whether B12 injections are safe for you. Select all that apply.", body: null },
        cancerTreatmentScreen,
        selfInjectionScreen,
        { fields: ["medications_allergies"], title: "What do you take, and what are you allergic to?", body: medicinesText("Medicines, including acid reducers (PPIs), metformin or colchicine, and allergies") },
      ]
    : program === "oxytocin" ? [
        {
          fields: ["treatment_goals"],
          title: `Welcome to ${brandName}. What would you like help with?`,
          hint: "Select all that apply.",
          body: pickSome("treatment_goals", OXYTOCIN_CONCERNS),
        },
        {
          fields: ["sleep_history"], reply: "{sleep_history}",
          title: "Tell us how you sleep",
          hint: "Your usual bedtime and wake time, how long it takes to fall asleep, how often you wake, how you feel during the day, and habits like screens, caffeine or alcohol.",
          body: <label className="field wide">How you sleep<textarea name="sleep_history" rows={4} maxLength={2000} defaultValue="Bed around 11pm, up at 7am. About 45 minutes to fall asleep, wake twice most nights, tired in the afternoon. Phone in bed, coffee until 3pm." required /></label>,
        },
        { fields: ["sleep_disorders"], title: "Do you have, or think you might have, any of these?", hint: "Select any that aren't being treated, or none.", body: pickSome("sleep_disorders", OXYTOCIN_SLEEP_DISORDERS) },
        {
          fields: ["psychiatric_history"], reply: "{psychiatric_history}",
          title: "Your mental health history",
          hint: "Any diagnoses and current treatment. Write “None reported” if there are none.",
          body: <label className="field wide">Diagnoses and treatment<textarea name="psychiatric_history" rows={3} maxLength={2000} defaultValue="None reported" required /></label>,
        },
        {
          fields: OXYTOCIN_SUICIDE_SCREEN.map(([n]) => n), checklist: OXYTOCIN_SUICIDE_SCREEN,
          title: "A few questions about how you've been feeling",
          hint: "Select any that apply. If you're thinking about suicide right now, call or text 988, or call 911 in an emergency.",
          body: null,
        },
        { fields: OXYTOCIN_SCREENING_MENTAL.map(([n]) => n), checklist: OXYTOCIN_SCREENING_MENTAL, title: "Do any of these apply to you?", hint: "Select all that apply.", body: null },
        { fields: OXYTOCIN_SCREENING_HEALTH.map(([n]) => n), checklist: OXYTOCIN_SCREENING_HEALTH, title: "And any of these?", hint: "These help your clinician decide whether oxytocin is safe for you. Select all that apply.", body: null },
        cancerTreatmentScreen,
        {
          fields: ["medications_allergies", "nasal_sinus_history"], title: "What do you take, and anything about your nose?",
          body: (
            <div className="field-grid">
              <label className="field wide">Medicines, including sleep aids and supplements, and allergies <small>(one per line; leave empty for none)</small><textarea name="medications_allergies" rows={3} maxLength={4000} /></label>
              <label className="field wide">Nose or sinus surgery, with the date <small>(optional)</small><textarea name="nasal_sinus_history" rows={2} maxLength={2000} /></label>
            </div>
          ),
        },
        { fields: ["off_label_understanding_attested"], autoAdvance: true, title: "Do you understand how oxytocin is used here?", hint: OXYTOCIN_CONSENT, body: yesNoScreen("off_label_understanding_attested") },
      ]
    : program === "erectile_dysfunction" ? [
        {
          fields: ["treatment_goals"],
          title: `Welcome to ${brandName}. What would you like from treatment?`,
          hint: "Select all that apply.",
          body: pickSome("treatment_goals", ED_GOALS),
        },
        { fields: ["condition_duration"], autoAdvance: true, title: "How long have you had trouble with erections?", body: pickOne("condition_duration", DURATIONS) },
        { fields: ["ed_onset"], autoAdvance: true, title: "Did it come on gradually or suddenly?", body: pickOne("ed_onset", ED_ONSETS) },
        { fields: ["erection_consistency"], autoAdvance: true, title: "How often does it happen?", body: pickOne("erection_consistency", ED_CONSISTENCY) },
        { fields: ["morning_erections"], autoAdvance: true, title: "Do you still get erections in the morning or on their own?", body: yesNoScreen("morning_erections") },
        {
          fields: ["blood_pressure_systolic", "blood_pressure_diastolic", "blood_pressure_measured_on", "blood_pressure_setting"],
          reply: "{blood_pressure_systolic}/{blood_pressure_diastolic} on {blood_pressure_measured_on}, {blood_pressure_setting}",
          title: "What was your most recent blood pressure?",
          hint: "From the last 6 months: at home, at a pharmacy or at a clinic. If you don't have one, get a reading first.",
          body: (
            <div className="field-grid">
              <label className="field">Top number<input name="blood_pressure_systolic" type="number" min="50" max="260" step="1" defaultValue="124" required /></label>
              <label className="field">Bottom number<input name="blood_pressure_diastolic" type="number" min="30" max="160" step="1" defaultValue="78" required /></label>
              <label className="field">Date<input name="blood_pressure_measured_on" type="date" defaultValue={RECENT_READING} required /></label>
              <label className="field">Taken<select name="blood_pressure_setting" defaultValue="pharmacy" required>{BLOOD_PRESSURE_SETTINGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            </div>
          ),
        },
        { fields: ["climbs_two_flights"], autoAdvance: true, title: "Can you climb two flights of stairs without chest pain or getting out of breath?", body: pickOne("climbs_two_flights", CLIMBS_TWO_FLIGHTS) },
        { fields: ED_SCREENING_HEART.map(([n]) => n), checklist: ED_SCREENING_HEART, title: "Do any of these apply to your heart or blood pressure?", hint: "These decide whether these medicines are safe for you. Select all that apply.", body: null },
        { fields: ED_SCREENING_MEDICINES.map(([n]) => n), checklist: ED_SCREENING_MEDICINES, title: "Do you take any of these, or have these allergies?", hint: "Select all that apply.", body: null },
        { fields: ED_SCREENING_HEALTH.map(([n]) => n), checklist: ED_SCREENING_HEALTH, title: "And any of these?", hint: "Select all that apply.", body: null },
        { fields: ["cardiovascular_risk_factors"], title: "Do any of these apply to you?", hint: "Select any that apply, or none.", body: pickSome("cardiovascular_risk_factors", CARDIOVASCULAR_RISK_FACTORS) },
        { fields: ["related_medications"], title: "Do you take any of these?", hint: "They can affect erections. Select any that apply, or none.", body: pickSome("related_medications", RELATED_MEDICATIONS) },
        { fields: ED_HISTORY.map(([n]) => n), checklist: ED_HISTORY, title: "And any of these?", hint: "Select all that apply.", body: null },
        {
          fields: ["heavy_drinking_days_past_year"], reply: "{heavy_drinking_days_past_year} times",
          title: "In the past year, how many times have you had 5 or more drinks in a day?",
          hint: "4 or more for women and anyone over 65. Enter 0 if never.",
          body: (
            <div className="field-grid">
              <label className="field">Times in the past year<input name="heavy_drinking_days_past_year" type="number" min="0" step="1" defaultValue="0" required /></label>
            </div>
          ),
        },
        {
          fields: ["medications_allergies", "prior_ed_medications"], title: "What do you take, and what have you tried?",
          body: (
            <div className="field-grid">
              {medicinesText("Medicines and supplements, including sexual-enhancement ones, and allergies")}
              <label className="field wide">ED medicines you&rsquo;ve tried <small>(optional, one per line: the medicine, dose, how many tries, whether it worked, side effects)</small><textarea name="prior_ed_medications" rows={3} maxLength={4000} /></label>
            </div>
          ),
        },
        {
          fields: ["nitrate_acknowledgment_attested"], autoAdvance: true, title: "Do you understand the one thing you must never do?",
          hint: (
            <>
              {NITRATE_ACKNOWLEDGMENT} An erection lasting 4 hours or more, chest pain during or after sex, or fainting: call 911,
              and don&rsquo;t take nitroglycerin. Sudden vision or hearing loss: stop the medicine and get care the same day.
            </>
          ),
          body: yesNoScreen("nitrate_acknowledgment_attested"),
        },
      ]
    : program === "hair_loss" ? [
        {
          fields: ["treatment_goals"],
          title: `Welcome to ${brandName}. What would you like from treatment?`,
          hint: "Select all that apply.",
          body: pickSome("treatment_goals", HAIR_GOALS),
        },
        { fields: ["thinning_areas"], title: "Where is your hair thinning?", hint: "Select all that apply.", body: pickSome("thinning_areas", HAIR_AREAS) },
        { fields: ["condition_duration"], autoAdvance: true, title: "When did it start?", body: pickOne("condition_duration", DURATIONS) },
        { fields: ["thinning_pace"], autoAdvance: true, title: "How fast is it going?", body: pickOne("thinning_pace", HAIR_PACES) },
        { fields: ["shedding_or_thinning"], autoAdvance: true, title: "Do you notice thinning, shedding, or both?", body: pickOne("shedding_or_thinning", HAIR_CHANGES) },
        { fields: ["family_history"], autoAdvance: true, title: "Does a parent or sibling have pattern hair loss?", body: yesNoScreen("family_history") },
        { fields: HAIR_SCREENING_SIGNS.map(([n]) => n), checklist: HAIR_SCREENING_SIGNS, title: "Do any of these apply?", hint: "Some signs mean it isn't pattern hair loss and needs an in-person visit. Select all that apply.", body: null },
        {
          fields: HAIR_SCREENING_MOOD.map(([n]) => n), checklist: HAIR_SCREENING_MOOD,
          title: "How has your mood been?",
          hint: "Two of these medicines can affect mood. If you're having thoughts of suicide, call or text 988, or call 911. Select all that apply.",
          body: null,
        },
        {
          fields: ["can_become_pregnant", "reliable_contraception", "contraception_method"],
          reply: "Could become pregnant: {can_become_pregnant}",
          title: "Could you become pregnant?",
          hint: "Some of these medicines can harm a pregnancy, so we ask everyone.",
          body: (
            <div className="field-grid">
              <label className="field">Could you become pregnant?<select name="can_become_pregnant" defaultValue="" required><option value="" disabled>Choose</option><option value="false">No</option><option value="true">Yes</option></select></label>
              <label className="field">Do you use reliable contraception? <small>(if yes)</small><select name="reliable_contraception" defaultValue="false"><option value="false">No</option><option value="true">Yes</option></select></label>
              <label className="field wide">Which contraception? <small>(optional)</small><input name="contraception_method" autoComplete="off" /></label>
            </div>
          ),
        },
        { fields: HAIR_FERTILITY.map(([n]) => n), checklist: HAIR_FERTILITY, title: "And any of these?", hint: "Select all that apply.", body: null },
        { fields: HAIR_SCREENING_MEDICINES.map(([n]) => n), checklist: HAIR_SCREENING_MEDICINES, title: "Do you take any of these, or have these allergies?", hint: "Select all that apply.", body: null },
        { fields: HAIR_SCREENING_HEALTH.map(([n]) => n), checklist: HAIR_SCREENING_HEALTH, title: "Do you have any of these?", hint: "These decide which medicines are safe for you. Select all that apply.", body: null },
        {
          fields: ["medications_allergies", "prior_hair_treatments"], title: "What do you take, and what have you tried?",
          body: (
            <div className="field-grid">
              {medicinesText("Medicines and supplements, including high-dose biotin, and allergies")}
              <label className="field wide">Hair treatments you&rsquo;ve tried or use now <small>(optional, one per line: what, how long, whether it helped)</small><textarea name="prior_hair_treatments" rows={3} maxLength={4000} /></label>
            </div>
          ),
        },
        {
          fields: ["finasteride_12_months_without_stabilization"], autoAdvance: true,
          title: "Have you taken finasteride for 12 months or more, and your hair loss kept going?",
          hint: "Dutasteride is only an option after that.",
          body: yesNoScreen("finasteride_12_months_without_stabilization"),
        },
        { fields: ["finasteride_risks_attested"], autoAdvance: true, title: "Do you understand these side effects?", hint: `${FINASTERIDE_RISKS} If you say no, your clinician won't offer finasteride or dutasteride.`, body: yesNoScreen("finasteride_risks_attested") },
      ]
    : program === "herpes_simplex" ? [
        {
          fields: ["requested_treatment", "sore_site"], autoAdvance: true,
          title: `Welcome to ${brandName}. What would you like?`,
          hint: "This is for herpes a clinician has already diagnosed in the same place.",
          body: pickOne("requested_treatment", HSV_WANTS),
        },
        { fields: ["prior_diagnosis_method"], autoAdvance: true, title: "How was it diagnosed?", hint: "A blood test alone isn't enough: it can't say where the sores are.", body: pickOne("prior_diagnosis_method", HSV_DIAGNOSIS_METHODS) },
        {
          fields: ["prior_diagnosis_details", "prior_diagnosis_unclear"], title: "Who diagnosed it, and when?",
          body: (
            <div className="field-grid">
              <label className="field wide">Who and when, or the test and its date <small>(skip if it&rsquo;s never been diagnosed)</small><textarea name="prior_diagnosis_details" rows={2} maxLength={1000} /></label>
              <label className="quiz-option quiz-option-multi field wide"><input type="checkbox" name="prior_diagnosis_unclear" /> <span>I don&rsquo;t remember exactly who or when</span></label>
            </div>
          ),
        },
        { fields: HSV_SCREENING_EPISODE.map(([n]) => n), checklist: HSV_SCREENING_EPISODE, title: "Do any of these apply?", hint: "A first or unusual sore needs an in-person exam and a test. Select all that apply.", body: null },
        {
          fields: ["sores_onset", "episode_description"], title: "If you're treating an outbreak now, when did it start?",
          hint: "Treatment works best at the first tingle or within a day of sores. Skip this if you want a daily medicine.",
          body: (
            <div className="field-grid">
              <label className="field wide">When it started<select name="sores_onset" defaultValue=""><option value="">Not treating an outbreak now</option>{HSV_ONSETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              <label className="field wide">What the sores look like now, and how they&rsquo;re healing<textarea name="episode_description" rows={2} maxLength={1000} /></label>
            </div>
          ),
        },
        {
          fields: ["outbreaks_last_12_months", "outbreak_impact"], reply: "{outbreaks_last_12_months} outbreaks, affect me: {outbreak_impact}",
          title: "How often do you get outbreaks?",
          body: (
            <div className="field-grid">
              <label className="field">Outbreaks in the last 12 months<input name="outbreaks_last_12_months" type="number" min="0" max="100" step="1" required /></label>
              <label className="field">How much they affect you<select name="outbreak_impact" defaultValue="" required><option value="" disabled>Choose</option>{HSV_IMPACTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            </div>
          ),
        },
        { fields: ["suppression_goals"], title: "If you want a daily medicine, what should it do?", hint: "Select all that apply. Skip this if you're treating an outbreak.", body: pickSome("suppression_goals", HSV_GOALS) },
        { fields: HSV_SCREENING_URGENT.map(([n]) => n), checklist: HSV_SCREENING_URGENT, title: "Do you have any of these now?", hint: "Eye symptoms need same-day eye care. For the others, call 911 or go to the nearest emergency department. Select all that apply.", body: null },
        { fields: HSV_SCREENING_HEALTH.map(([n]) => n), checklist: HSV_SCREENING_HEALTH, title: "Do any of these apply?", hint: "These decide whether the medicine is safe for you. Select all that apply.", body: null },
        { fields: HSV_SCREENING_MEDICINES.map(([n]) => n), checklist: HSV_SCREENING_MEDICINES, title: "And any of these?", hint: "Select all that apply.", body: null },
        { fields: ["new_sexual_exposure_or_sti_symptoms"], autoAdvance: true, title: "Any new sexual partner or exposure, or other STI symptoms?", body: yesNoScreen("new_sexual_exposure_or_sti_symptoms") },
        {
          fields: ["medications_allergies", "antiviral_history"], title: "What do you take, and what have you taken for herpes?",
          body: (
            <div className="field-grid">
              {medicinesText("Medicines and supplements, and allergies with the reaction")}
              <label className="field wide">Herpes medicines you take or have taken <small>(optional, one per line: the medicine, dose, when, whether it helped)</small><textarea name="antiviral_history" rows={3} maxLength={4000} /></label>
            </div>
          ),
        },
      ]
    // Any other program: the illustrative intake (src/lib/intake/generic.ts) — general questions, not the protocol's own.
    : [
        {
          fields: ["reason_for_visit"], reply: "{reason_for_visit}",
          title: `Welcome to ${brandName}. What would you like help with?`,
          hint: "A few minutes of questions, then a licensed clinician reviews your answers and decides on treatment.",
          body: (
            <label className="field wide">In your own words<textarea name="reason_for_visit" rows={3} maxLength={2000} defaultValue="I'd like to talk to a clinician about treatment options." required /></label>
          ),
        },
        {
          fields: ["current_medications", "allergies"], reply: "Taking: {current_medications}. Allergies: {allergies}",
          title: "What do you take, and what do you react to?",
          hint: "Prescriptions, over-the-counter medicines and supplements — so a new treatment is safe alongside them.",
          body: (
            <div className="field-grid">
              <label className="field wide">Medicines and supplements you take now<textarea name="current_medications" rows={2} maxLength={2000} defaultValue="None" /></label>
              <label className="field wide">Allergies<textarea name="allergies" rows={2} maxLength={2000} defaultValue="None known" /></label>
            </div>
          ),
        },
        {
          fields: GENERIC_SCREENING.map(([name]) => name), checklist: GENERIC_SCREENING,
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
      fields: ["first_name", "last_name", "date_of_birth", "sex"], reply: "{first_name} {last_name}, born {date_of_birth}, {sex}",
      title: "Tell us about you",
      hint: "Sample details only — use a Sample or Test name.",
      body: (
        <div className="field-grid">
          <label className="field">First name<input name="first_name" defaultValue="Sample" autoComplete="off" required /></label>
          <label className="field">Last name<input name="last_name" defaultValue="Patient" autoComplete="off" required /></label>
          <label className="field">Date of birth<input name="date_of_birth" type="date" defaultValue="1990-01-15" required /></label>
          <label className="field">Sex at birth<select name="sex" defaultValue={program === "erectile_dysfunction" ? "male" : "female"} required><option value="female">Female</option><option value="male">Male</option></select></label>
        </div>
      ),
    },
    {
      fields: ["email", "phone", "address_line1", "address_line2", "city", "state", "postal_code", "address"], reply: "{email} · {phone} · {address_line1}, {city} {state}",
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
        if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement || input instanceof HTMLTextAreaElement) {
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
    if (screenValid(screen)) go(Math.min(screen + 1, last));
  }

  // Enter on an earlier screen means "continue", not "submit the whole intake".
  // On the last one, check every screen first — a hidden field can't show its own error.
  // Submitting by hand (rather than via the form's action) also keeps the answers
  // in place if Lithos rejects the intake; a form action would reset them.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (screen < last) return next();
    for (let i = 0; i < screens.length; i++) if (!screenValid(i)) return;
    const data = new FormData(event.currentTarget);
    // One attempt per sent intake (lib/lithos/idempotency.ts): stamped when it's
    // sent, kept for a double submit, cleared by the answer below.
    attempt.current ||= newAttemptKey();
    data.set("idempotency_key", attempt.current);
    startTransition(() => action(data));
  }

  // When the intake comes back rejected, open the screen the first error is about.
  const fieldsKey = screens.map((s) => s.fields.join()).join("|");
  useEffect(() => {
    if (state.status !== "failed" || state.stage === "connection") return;
    const target = state.errors.map((e) => screenForPointer(screens, e.source?.pointer)).find((i) => i !== null);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the server's answer, once per response
    if (target !== undefined && target !== null) setScreen(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the screens are rebuilt every render; their fields are what matter
  }, [state, fieldsKey]);

  const current = screens[screen];

  return (
    <>
    <form id={FORM_ID} ref={formRef} action={action} onSubmit={onSubmit} noValidate className={chat ? "quiz quiz-chat" : "quiz"}>
      <input type="hidden" name="program" value={program} />
      {!chat && (
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
            <h2>
              {state.stage === "validation" ? "Please check your details" : "We couldn't complete your intake"}
            </h2>
            {state.httpStatus && <p className="muted">The clinical service responded with HTTP {state.httpStatus}.</p>}
            <ul>
              {state.errors.map((error, index) => {
                const target = screenForPointer(screens, error.source?.pointer);
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

      {(failed || choosingVisit) && state.patientId && <input type="hidden" name="resume_patient_id" value={state.patientId} />}
      {(failed || choosingVisit) && state.carePlanId && <input type="hidden" name="resume_care_plan_id" value={state.carePlanId} />}

      {/* Hidden, not unmounted, while a time is picked: the form still sends every answer. */}
      <div hidden={choosingVisit} className="quiz-body">

      {chat && (
        // The conversation so far: each answered question, then the one being asked.
        <div ref={logRef} className="chat-log" aria-live="polite">
          <Bubble from="bot" brandName={brandName}>Hi! A few quick questions, then a licensed clinician reviews your answers.</Bubble>
          {screens.slice(0, screen).map((s, index) => (
            <Fragment key={index}>
              <Bubble from="bot" brandName={brandName}>{s.title}</Bubble>
              <Bubble from="me">{replies[index] || "…"}</Bubble>
            </Fragment>
          ))}
          <Bubble from="bot" brandName={brandName}>
            {current.title}
            {current.hint && <small>{current.hint}</small>}
          </Bubble>
        </div>
      )}

      {/* Every screen stays mounted, so the form always holds every answer. In
          chat, the current screen's inputs are the reply box under the log. */}
      {screens.map((s, index) => (
        <div key={index} ref={(el) => { screenRefs.current[index] = el; }} className={chat ? "quiz-screen chat-composer" : "quiz-screen"} hidden={screen !== index} data-reply={s.reply}>
          {!chat && (
            <header className="quiz-question">
              <h2 tabIndex={-1} ref={(el) => { headingRefs.current[index] = el; }}>{s.title}</h2>
              {s.hint && <p className="hint">{s.hint}</p>}
            </header>
          )}
          {s.checklist ? checklist(index, s.checklist) : s.body}
        </div>
      ))}

      {chat ? <div className="quiz-nav">
        {screen === last ? (
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Sending to our clinical team…" : retrying ? "Try again" : "Send to a clinician"}
          </button>
        ) : (
          !current.autoAdvance && (
            <button type="submit" className="btn btn-primary">
              {current.checklist && !ticked[screen] ? "None of these" : "Send"}
            </button>
          )
        )}
        {screen > 0 && (
          <button type="button" className="link-button" onClick={() => go(screen - 1)} disabled={pending}>Change my last answer</button>
        )}
      </div> : <div className="quiz-nav">
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
      </div>
    </form>
    {choosingVisit && state.offer && (
      <VisitStep
        formId={FORM_ID}
        patientId={state.patientId}
        carePlanId={state.carePlanId}
        initialOffer={state.offer}
        submitting={pending}
      />
    )}
    </>
  );
}

/** One message in the chat intake: the company's question, or the patient's reply. */
function Bubble({ from, brandName, children }: { from: "bot" | "me"; brandName?: string; children: ReactNode }) {
  return (
    <div className={`chat-row chat-row-${from}`}>
      {from === "bot" && <span className="chat-avatar" aria-hidden="true">{brandName?.trim().charAt(0).toUpperCase()}</span>}
      <p className={`chat-bubble chat-bubble-${from}`}>
        <span className="visually-hidden">{from === "bot" ? `${brandName}: ` : "You: "}</span>
        {children}
      </p>
    </div>
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
