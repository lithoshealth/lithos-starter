/**
 * The weight management, Microdose GLP-1 and Weight Management Low Dose intakes, shared by the
 * patient-facing intake (which asks them) and the journey (which sends them).
 * The field names and values are Lithos's `glp1_microdose` and
 * `weight_management_low_dose` initial contracts (the Intake Schemas guide);
 * keep them as they are. The questions follow the protocols' intake version 2
 * (from Dec 3). Low Dose is Microdose with a capped step-up, and weight
 * management asks nearly the same questions, so one intake serves all three:
 * Microdose also asks the patient's goal and offers no increase; weight
 * management names its own allergy question and asks no "other GLP-1" one.
 *
 * For Microdose and Low Dose, a hard stop, or current thoughts of suicide,
 * stops this intake before anything reaches Lithos. Weight management sends
 * them, and Lithos rules the treatments out. Every hard-stop answer is still sent, as `false`:
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

export const GLP1_PROGRAMS = ["glp1_microdose", "weight_management_low_dose", "weight_management"];

/** The programs whose hard stops this app applies itself, before anything is sent. */
export const GATED_GLP1_PROGRAMS = ["glp1_microdose", "weight_management_low_dose"];

/** The organ and health screens, plus each program's own. Any one ticked is a hard stop. */
export function glp1HardStops(program: string): Options {
  return [
    ...WEIGHT_SCREENING_ORGANS,
    ...WEIGHT_SCREENING_HEALTH,
    ...(program === "weight_management"
      ? [["serious_allergic_reaction_to_requested_medication", "A serious allergic reaction to semaglutide, tirzepatide, orforglipron or an ingredient"] as const]
      : [
          ["drug_hypersensitivity", "A serious allergic reaction to semaglutide, tirzepatide or an ingredient"] as const,
          ["active_other_glp1_prescription", "Another GLP-1 prescription I'll keep taking alongside this one"] as const,
        ]),
  ];
}
export const GLP1_HARD_STOPS: Options = glp1HardStops("glp1_microdose");

export const GLP1_SIDE_EFFECTS: Options = [
  ["none", "None"],
  ["nausea_vomiting", "Nausea or vomiting"],
  ["severe_abdominal_pain", "Severe belly pain"],
  ["gallbladder_symptoms", "Gallbladder symptoms"],
  ["dehydration", "Dehydration"],
  ["other", "Something else"],
];

export const GLP1_HISTORY: Options = [
  ["cancer_treatment_last_3_years", "Cancer treatment in the last 3 years"],
  ["daily_steroid_use", "I take steroids every day"],
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

/** Weight management's conditions, without "something else": that one is typed, so it has a name. */
export const GLP1_COMORBIDITIES = WEIGHT_COMORBIDITIES.filter(([key]) => key !== "other");

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

  const hardStops = glp1HardStops(program);
  const gated = GATED_GLP1_PROGRAMS.includes(program);
  // The partner's own gate: these never reach Lithos.
  const stop = gated ? hardStops.find(([name]) => read.checked(name)) : undefined;
  if (stop) {
    errors.push({ pointer: pointer(stop[0]), message: `${stop[1]}: this program isn't safe for you, so we can't send your request. Talk to your doctor about other options.` });
  }
  const thoughtsNow = read.text("suicidal_thoughts_current");
  if (gated && thoughtsNow === "true") {
    errors.push({ pointer: pointer("suicidal_thoughts_current"), message: "Please call or text 988 now, or call 911 if you're in danger. We can't send this request today." });
  } else if (thoughtsNow !== "true" && thoughtsNow !== "false") {
    errors.push({ pointer: pointer("suicidal_thoughts_current"), message: "Say whether you're having thoughts of killing yourself right now." });
  }

  const goal = read.text("goal");
  const otherCondition = read.text("comorbidities_other");
  if (program === "glp1_microdose" && !goal) errors.push({ pointer: pointer("goal"), message: "Say why you want the microdose." });

  const everUsed = yesNo(read, "glp1_ever_used", errors, "Say whether you've ever used a GLP-1.");
  const onNow = yesNo(read, "already_on_glp1", errors, "Say whether you take a GLP-1 now.");
  const history: Record<string, unknown> = {};
  if (everUsed || onNow) {
    const drug = read.text("glp1_current_drug");
    if (!keys(GLP1_DRUGS).includes(drug)) errors.push({ pointer: pointer("glp1_current_drug"), message: "Pick the GLP-1 you took most recently." });
    const drugOther = read.text("glp1_current_drug_other");
    if (drug === "other" && !drugOther) errors.push({ pointer: pointer("glp1_current_drug_other"), message: "Name the GLP-1 you took." });
    if (drug === "other") history.glp1_current_drug_other = drugOther;
    const dose = Number(read.text("glp1_current_dose_mg"));
    if (!(dose > 0)) errors.push({ pointer: pointer("glp1_current_dose_mg"), message: "Enter your most recent weekly dose in mg." });
    const weeks = Number(read.text("glp1_length_of_use_weeks"));
    if (!Number.isInteger(weeks) || weeks < 0 || read.text("glp1_length_of_use_weeks") === "") {
      errors.push({ pointer: pointer("glp1_length_of_use_weeks"), message: "Enter how many weeks you took it." });
    }
    const last = read.text("glp1_last_dose_date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(last)) errors.push({ pointer: pointer("glp1_last_dose_date"), message: "Enter the date of your last dose." });
    Object.assign(history, { glp1_current_drug: drug, glp1_current_dose_mg: dose, glp1_length_of_use_weeks: weeks, glp1_last_dose_date: last });
    const effects = read.all("glp1_side_effects").filter((v) => keys(GLP1_SIDE_EFFECTS).includes(v));
    if (effects.length === 0) errors.push({ pointer: pointer("glp1_side_effects"), message: "Pick any side effects you had, or none." });
    history.glp1_side_effects = effects;
    if (effects.includes("other")) {
      const other = read.text("glp1_side_effects_other");
      if (!other) errors.push({ pointer: pointer("glp1_side_effects_other"), message: "Name the other side effect." });
      history.glp1_side_effects_other = other;
    }
  }
  if (onNow) {
    const direction = read.text("glp1_desired_direction");
    if (!keys(glp1Directions(program)).includes(direction)) {
      errors.push({ pointer: pointer("glp1_desired_direction"), message: "Say which way you'd like your dose to go." });
    }
    history.glp1_desired_direction = direction;
  }

  const screen = booleans(read, GLP1_SUICIDE_SCREEN);
  const anyScreen = Object.values(screen).some(Boolean);
  const historyAnswers = booleans(read, GLP1_HISTORY);
  const fistula = historyAnswers.ibd_diagnosis
    ? { bowel_fistula_history: yesNo(read, "bowel_fistula_history", errors, "Say whether you've had a bowel fistula.") }
    : {};
  const timing = read.text("suicide_attempt_timing");
  if (screen.suicide_attempt_ever && !keys(GLP1_ATTEMPT_TIMINGS).includes(timing)) {
    errors.push({ pointer: pointer("suicide_attempt_timing"), message: "Say when the most recent attempt was." });
  }

  // "Something else" needs its name: Lithos refuses an `other` with nothing to read.
  const comorbidities = keys(WEIGHT_COMORBIDITIES).filter((key) => key !== "other" && read.checked(`comorbidity_${key}`));
  if (otherCondition) comorbidities.push("other");
  const value = {
    height_cm: heightCm,
    weight_kg: weightKg,
    ...(comorbidities.length > 0 ? { comorbidities } : {}),
    ...(otherCondition ? { comorbidities_other: otherCondition } : {}),
    ...(program === "glp1_microdose" ? { goal } : {}),
    // For the gated programs, only reached with every hard stop answered no; sent so the record shows it.
    ...booleans(read, hardStops),
    // Asked of everyone here; Lithos requires it after any yes in the screen.
    ...(gated || anyScreen ? { suicidal_thoughts_current: thoughtsNow === "true" } : {}),
    ...historyAnswers,
    ...fistula,
    glp1_ever_used: everUsed || onNow,
    already_on_glp1: onNow,
    ...history,
    ...screen,
    ...(screen.suicide_attempt_ever ? { suicide_attempt_timing: timing } : {}),
    // Required by Lithos; an empty list means none.
    current_medications: lines(read.text("current_medications")),
    allergies: lines(read.text("allergies")),
    prior_weight_loss_meds: lines(read.text("prior_weight_loss_meds")),
  };
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
}
