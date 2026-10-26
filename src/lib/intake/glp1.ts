/**
 * The Microdose GLP-1 and Weight Management Low Dose intakes, shared by the
 * patient-facing intake (which asks them) and the journey (which sends them).
 * The field names and values are Lithos's `glp1_microdose` and
 * `weight_management_low_dose` initial contracts (the Intake Schemas guide);
 * keep them as they are. The questions follow the two clinical protocols
 * (v1.0). Low Dose is Microdose with a capped step-up, so one intake serves
 * both: Microdose also asks the patient's goal, and offers no increase.
 *
 * A hard stop, or current thoughts of suicide, stops this intake before
 * anything reaches Lithos. Every hard-stop answer is still sent, as `false`:
 * an unanswered question isn't a no, so Lithos is moving to require them, as
 * it does for every other protocol (ENG-804). The rest (a BMI below the program's floor,
 * a dose above its cap) goes to Lithos, which rules the treatments out for the
 * clinician. The prescription photo and the GI clearance are added when it's
 * sent (src/lib/journey-photos.ts).
 *
 * Client-safe: no server imports.
 */

import { WEIGHT_COMORBIDITIES, WEIGHT_SCREENING_HEALTH, WEIGHT_SCREENING_ORGANS, metricHeightWeight } from "./weight";

type Options = readonly (readonly [string, string])[];

export const GLP1_PROGRAMS = ["glp1_microdose", "weight_management_low_dose"];

/** Weight management's screens, plus the two these protocols add. Any one ticked is a hard stop. */
export const GLP1_HARD_STOPS: Options = [
  ...WEIGHT_SCREENING_ORGANS,
  ...WEIGHT_SCREENING_HEALTH,
  ["drug_hypersensitivity", "A serious allergic reaction to semaglutide, tirzepatide or an ingredient"],
  ["active_other_glp1_prescription", "Another GLP-1 prescription I'll keep taking alongside this one"],
];

export const GLP1_HISTORY: Options = [
  ["cancer_treatment_or_steroids", "Cancer treatment in the last 3 years, or daily steroids"],
  ["ibd_diagnosis", "Ulcerative colitis or Crohn's disease"],
  ["oral_contraceptive", "I take birth control pills"],
];

export const GLP1_SUICIDE_SCREEN: Options = [
  ["recent_wish_to_be_dead", "In the past few weeks, I've wished I were dead"],
  ["recent_better_off_dead_thoughts", "In the past few weeks, I've felt my family or I would be better off if I were dead"],
  ["suicidal_thoughts_past_week", "In the past week, I've had thoughts about killing myself"],
  ["suicide_attempt_ever", "I have tried to kill myself"],
];

export const GLP1_ATTEMPT_TIMINGS: Options = [["within_12_months", "In the past 12 months"], ["more_than_12_months", "More than a year ago"]];

export const GLP1_DRUGS: Options = [["semaglutide", "Semaglutide (Wegovy, Ozempic, compounded)"], ["tirzepatide", "Tirzepatide (Zepbound, Mounjaro, compounded)"], ["other", "Another GLP-1"]];

/** What a patient on a GLP-1 may ask for: Microdose has no higher dose. */
export function glp1Directions(program: string): Options {
  return program === "glp1_microdose"
    ? [["same", "Stay the same"], ["decrease", "Go down"]]
    : [["same", "Stay the same"], ["increase", "Go up"], ["decrease", "Go down"]];
}

export { WEIGHT_COMORBIDITIES };

// ------------------------------------------------------------------ parsing

type FieldError = { pointer: string; message: string };
type Read = { text: (name: string) => string; all: (name: string) => string[]; checked: (name: string) => boolean };
type Parsed = { ok: true; value: Record<string, unknown> } | { ok: false; errors: FieldError[] };

const pointer = (name: string) => `/intake_form/data/${name}`;
const keys = (options: Options) => options.map(([key]) => key);
const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);
const booleans = (read: Read, options: Options) => Object.fromEntries(keys(options).map((name) => [name, read.checked(name)]));

function yesNo(read: Read, name: string, errors: FieldError[], message: string): boolean {
  const value = read.text(name);
  if (value !== "true" && value !== "false") errors.push({ pointer: pointer(name), message });
  return value === "true";
}

export function parseGlp1Intake(read: Read, program: string): Parsed {
  const errors: FieldError[] = [];
  const { heightCm, weightKg, errors: measureErrors } = metricHeightWeight(read.text);
  errors.push(...measureErrors);

  // The partner's own gate: these never reach Lithos.
  const stop = GLP1_HARD_STOPS.find(([name]) => read.checked(name));
  if (stop) {
    errors.push({ pointer: pointer(stop[0]), message: `${stop[1]}: this program isn't safe for you, so we can't send your request. Talk to your doctor about other options.` });
  }
  if (read.text("suicidal_thoughts_current") === "true") {
    errors.push({ pointer: pointer("suicidal_thoughts_current"), message: "Please call or text 988 now, or call 911 if you're in danger. We can't send this request today." });
  } else if (read.text("suicidal_thoughts_current") !== "false") {
    errors.push({ pointer: pointer("suicidal_thoughts_current"), message: "Say whether you're having thoughts of killing yourself right now." });
  }

  const goal = read.text("goal");
  if (program === "glp1_microdose" && !goal) errors.push({ pointer: pointer("goal"), message: "Say why you want the microdose." });

  const everUsed = yesNo(read, "glp1_ever_used", errors, "Say whether you've ever used a GLP-1.");
  const onNow = yesNo(read, "already_on_glp1", errors, "Say whether you take a GLP-1 now.");
  const history: Record<string, unknown> = {};
  if (everUsed || onNow) {
    const drug = read.text("glp1_current_drug");
    if (!keys(GLP1_DRUGS).includes(drug)) errors.push({ pointer: pointer("glp1_current_drug"), message: "Pick the GLP-1 you took most recently." });
    const dose = Number(read.text("glp1_current_dose_mg"));
    if (!(dose > 0)) errors.push({ pointer: pointer("glp1_current_dose_mg"), message: "Enter your most recent weekly dose in mg." });
    const weeks = Number(read.text("glp1_length_of_use_weeks"));
    if (!Number.isInteger(weeks) || weeks < 0 || read.text("glp1_length_of_use_weeks") === "") {
      errors.push({ pointer: pointer("glp1_length_of_use_weeks"), message: "Enter how many weeks you took it." });
    }
    const last = read.text("glp1_last_dose_date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(last)) errors.push({ pointer: pointer("glp1_last_dose_date"), message: "Enter the date of your last dose." });
    Object.assign(history, { glp1_current_drug: drug, glp1_current_dose_mg: dose, glp1_length_of_use_weeks: weeks, glp1_last_dose_date: last });
  }
  if (onNow) {
    const direction = read.text("glp1_desired_direction");
    if (!keys(glp1Directions(program)).includes(direction)) {
      errors.push({ pointer: pointer("glp1_desired_direction"), message: "Say which way you'd like your dose to go." });
    }
    history.glp1_desired_direction = direction;
  }

  const screen = booleans(read, GLP1_SUICIDE_SCREEN);
  const timing = read.text("suicide_attempt_timing");
  if (screen.suicide_attempt_ever && !keys(GLP1_ATTEMPT_TIMINGS).includes(timing)) {
    errors.push({ pointer: pointer("suicide_attempt_timing"), message: "Say when the most recent attempt was." });
  }

  const comorbidities = keys(WEIGHT_COMORBIDITIES).filter((key) => read.checked(`comorbidity_${key}`));
  const value = {
    height_cm: heightCm,
    weight_kg: weightKg,
    ...(comorbidities.length > 0 ? { comorbidities } : {}),
    ...(program === "glp1_microdose" ? { goal } : {}),
    // Only reached with every hard stop answered no; sent so the record shows it.
    ...booleans(read, GLP1_HARD_STOPS),
    suicidal_thoughts_current: false,
    ...booleans(read, GLP1_HISTORY),
    glp1_ever_used: everUsed || onNow,
    already_on_glp1: onNow,
    ...history,
    ...screen,
    ...(screen.suicide_attempt_ever ? { suicide_attempt_timing: timing } : {}),
    // Both required by Lithos; an empty list means none.
    medications_allergies: lines(read.text("medications_allergies")),
    prior_weight_loss_meds: lines(read.text("prior_weight_loss_meds")),
  };
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
}
