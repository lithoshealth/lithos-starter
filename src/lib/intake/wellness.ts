/**
 * The longevity intakes — NAD+, Glutathione, Sermorelin, Vitamin B12 and
 * Oxytocin — shared by the
 * patient-facing intake (which asks them) and the journey (which sends them).
 * The field names and values are Lithos's `sermorelin`, `vitamin_b12` and
 * `oxytocin` initial contracts, and `nad_plus` and `glutathione` (the Intake
 * Schemas guide); keep them as they are. The questions follow each protocol
 * (v1.1; v1.0 for NAD+ and Glutathione until their update).
 *
 * Every screening answer is a yes-or-no Lithos requires: unticked is `false`.
 * After cancer treatment with the oncologist's approval, Lithos wants the
 * approval as an upload: the sandbox sends a sample letter
 * (src/lib/journey-photos.ts), never a real document.
 *
 * Client-safe: no server imports.
 */

import { DURATIONS } from "./derm";
import { metricHeightWeight } from "./weight";

type Options = readonly (readonly [string, string])[];

export { DURATIONS };

export const WELLNESS_PROGRAMS = ["nad_plus", "glutathione", "sermorelin", "vitamin_b12", "oxytocin"];

/** The programs whose protocol asks for the oncologist's approval as a document. */
export const APPROVAL_DOCUMENT_PROGRAMS = ["vitamin_b12", "oxytocin"];

const PREGNANCY: readonly [string, string] = ["pregnancy", "I'm pregnant, breastfeeding, or planning a pregnancy in the next 2 months"];
const MENTAL_HEALTH: readonly [string, string] = [
  "unmanaged_mental_illness",
  "I have a serious mental health condition that isn't under control (for example schizophrenia or bipolar disorder)",
];
const STEROIDS: readonly [string, string] = ["daily_steroid_use", "I take steroid pills or injections every day (for example prednisone)"];

// ------------------------------------------------------------------ NAD+

export const NAD_GOALS: Options = [
  ["brain_fog", "Brain fog"],
  ["age_related_fatigue", "Feeling more tired as I get older"],
  ["persistent_fatigue", "Fatigue that hasn't got better with the usual fixes"],
  ["post_workout_recovery", "Recovering after workouts"],
  ["anti_aging", "Healthy aging"],
  ["preventive_optimization", "Staying at my best"],
];

export const NAD_SCREENING: Options = [
  ["cancer_history", "I've had cancer, at any time"],
  ["active_malignancy", "I have cancer now"],
  ["on_chemotherapy", "I take a chemotherapy medicine"],
  ["kidney_disease", "I have, or have had, kidney disease"],
  ["cellular_metabolism_medications", "I take a medicine that affects how my cells use energy (my doctor would know)"],
  ["hypersensitivity", "I'm allergic to NAD+ or any of its ingredients"],
  MENTAL_HEALTH,
  PREGNANCY,
  STEROIDS,
];

// ------------------------------------------------------------------ glutathione

export const GLUTATHIONE_GOALS: Options = [
  ["antioxidant_support", "Antioxidant support"],
  ["low_energy_fatigue", "Low energy or fatigue"],
  ["poor_recovery", "Slow recovery from exercise or illness"],
  ["aging_skin", "Aging skin"],
  ["oxidative_imbalance", "Oxidative stress my doctor has mentioned"],
  ["glutathione_deficiency", "A condition linked to low glutathione"],
];

export const GLUTATHIONE_SCREENING: Options = [
  ["sulfhydryl_or_sulfur_allergy", "I'm allergic to sulfur compounds or a sulfhydryl medicine"],
  ["hypersensitivity", "I'm allergic to glutathione or any of its ingredients"],
  ["asthma", "I have asthma"],
  ["active_malignancy", "I have cancer now"],
  ["on_chemotherapy", "I take a chemotherapy medicine"],
  MENTAL_HEALTH,
  PREGNANCY,
  STEROIDS,
];

// ------------------------------------------------------------------ sermorelin

export const SERMORELIN_GOALS: Options = [
  ["weight_maintenance", "Keep my weight steady"],
  ["muscle_development", "Build muscle"],
  ["body_composition", "Improve my body composition"],
  ["healthy_aging", "Age well"],
];

export const SERMORELIN_INTERACTIONS: Options = [
  ["clonidine_or_levodopa", "Clonidine or levodopa"],
  ["somatostatin_analogue", "Octreotide, lanreotide or pasireotide"],
  ["glucocorticoid", "Steroid pills or injections (prednisone, dexamethasone)"],
  ["cox_inhibitor", "Aspirin, ibuprofen, celecoxib or a similar pain reliever"],
  ["insulin", "Insulin"],
  ["thyroid_medication", "Thyroid medication"],
];

export const SERMORELIN_SCREENING: Options = [
  ["cancer_history", "I've had cancer, at any time"],
  ["active_malignancy", "I have cancer now"],
  ["hypersensitivity", "I'm allergic to sermorelin or any of its ingredients"],
  ["hypothyroidism", "I have an underactive thyroid (hypothyroidism)"],
  ["diabetes", "I have diabetes"],
  MENTAL_HEALTH,
  PREGNANCY,
  STEROIDS,
];

// ------------------------------------------------------------------ vitamin B12

export const B12_SYMPTOMS: Options = [["fatigue", "Fatigue"], ["brain_fog", "Brain fog"], ["other", "Something else"]];

export const B12_SCREENING_ABSORPTION: Options = [
  ["b12_deficiency_history", "I've been told I'm low in vitamin B12"],
  ["bariatric_surgery", "I've had weight-loss (bariatric) surgery"],
  ["bowel_resection_or_short_gut", "I've had part of my bowel removed, or have short gut syndrome"],
];

export const B12_SCREENING_HEALTH: Options = [
  ["hypersensitivity", "I'm allergic to vitamin B12 (cobalamin) or benzyl alcohol"],
  ["leber_hereditary_optic_neuropathy", "I have Leber hereditary optic neuropathy"],
  ["kidney_disease", "I have kidney disease"],
  ["hepatitis_liver_disease", "I have liver disease, including hepatitis or cirrhosis"],
  ["polycythemia_vera", "I have polycythemia vera"],
  ["hypokalemia", "I have low potassium (hypokalemia)"],
  ["active_malignancy", "I have cancer now"],
  MENTAL_HEALTH,
  PREGNANCY,
  STEROIDS,
];

// ------------------------------------------------------------------ oxytocin

export const OXYTOCIN_CONCERNS: Options = [
  ["stress_related_hyperarousal", "I feel stressed or “wired”"],
  ["difficulty_relaxing", "I have trouble relaxing"],
  ["trouble_falling_asleep", "I have trouble falling asleep"],
  ["trouble_staying_asleep", "I have trouble staying asleep"],
];

export const OXYTOCIN_SLEEP_DISORDERS: Options = [
  ["obstructive_sleep_apnea", "Sleep apnea, or loud snoring with pauses in breathing or gasping"],
  ["narcolepsy", "Narcolepsy"],
  ["restless_legs", "Restless legs"],
  ["circadian_rhythm_disorder", "A body-clock (circadian rhythm) sleep disorder"],
];

/** The suicide and behavioral health screen. Its hard stop is the first item. */
export const OXYTOCIN_SUICIDE_SCREEN: Options = [
  ["suicidal_ideation_or_recent_attempt", "In the past week, or right now, I've had thoughts of killing myself, or I tried to in the past 12 months"],
  ["recent_wish_to_be_dead", "In the past few weeks, I've wished I were dead"],
  ["recent_better_off_dead_thoughts", "In the past few weeks, I've felt my family or I would be better off if I were dead"],
  ["suicide_attempt_over_a_year_ago", "I tried to kill myself more than a year ago"],
];

export const OXYTOCIN_SCREENING_MENTAL: Options = [
  ["recent_psychiatric_hospitalization", "I've stayed in a psychiatric hospital in the past 12 months"],
  ["active_psychosis_or_mania", "I'm hearing or seeing things others don't, or I'm in a manic or hypomanic episode"],
  ["severe_or_uncontrolled_depression_or_anxiety", "My depression or anxiety isn't under control, or needs more care"],
  ["substance_use_disorder", "Alcohol or drug use gets in the way of my life"],
  ["bipolar_or_mania_history", "I've ever had bipolar disorder, mania or hypomania"],
  ["severe_ptsd_or_emotional_dysregulation", "I have severe PTSD, or real trouble controlling my emotions"],
  ["cognitive_impairment", "I have significant memory or thinking problems"],
  MENTAL_HEALTH,
];

export const OXYTOCIN_SCREENING_HEALTH: Options = [
  ["uncontrolled_cardiovascular_disease", "I have heart disease that isn't under control"],
  ["uncontrolled_seizure_disorder", "I have seizures that aren't under control"],
  ["severe_nasal_pathology", "I have a severe nose problem (for example severe blockage)"],
  ["recent_nasal_surgery_or_intranasal_substance_use", "I've had nose or sinus surgery, or use any drugs in the nose"],
  ["uncontrolled_illness_needing_specialist", "I have another serious illness that isn't under control"],
  ["hypersensitivity", "I'm allergic to oxytocin"],
  ["active_malignancy", "I have cancer now"],
  PREGNANCY,
  STEROIDS,
];

export const OXYTOCIN_CONSENT =
  "I understand oxytocin for sleep and stress is off-label and investigational, the compounded product is not " +
  "FDA-approved, and benefit is not guaranteed.";

// ------------------------------------------------------------------ parsing

type FieldError = { pointer: string; message: string };
type Read = { text: (name: string) => string; all: (name: string) => string[]; checked: (name: string) => boolean };
type Parsed = { ok: true; value: Record<string, unknown> } | { ok: false; errors: FieldError[] };

const pointer = (name: string) => `/intake_form/data/${name}`;
const keys = (options: Options) => options.map(([key]) => key);
const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);
const booleans = (read: Read, options: Options) => Object.fromEntries(keys(options).map((name) => [name, read.checked(name)]));
const result = (value: Record<string, unknown>, errors: FieldError[]): Parsed =>
  errors.length > 0 ? { ok: false, errors } : { ok: true, value };

function someOf(read: Read, name: string, options: Options, errors: FieldError[] | null, message: string): string[] {
  const picked = read.all(name).filter((v) => keys(options).includes(v));
  if (errors && picked.length === 0) errors.push({ pointer: pointer(name), message });
  return picked;
}

function yes(read: Read, name: string, errors: FieldError[], message: string): boolean {
  const value = read.text(name);
  if (value !== "true" && value !== "false") errors.push({ pointer: pointer(name), message });
  return value === "true";
}

/** Injections need the patient, or a caregiver, to give them: the protocols require it. */
function selfInjection(read: Read, errors: FieldError[]) {
  return { can_self_administer: yes(read, "can_self_administer", errors, "Answer whether you or someone can give the injections.") };
}

/** Cancer treatment in the last 3 years, and the oncologist's approval: the upload is added when it's sent. */
function cancerTreatment(read: Read, errors: FieldError[]) {
  const treated = yes(read, "cancer_treatment_last_3_years", errors, "Answer whether you've had cancer treatment in the last 3 years.");
  return {
    cancer_treatment_last_3_years: treated,
    ...(treated ? { oncologist_approval: read.text("oncologist_approval") === "true" } : {}),
  };
}

/** The symptoms in the patient's words, sent when given. */
function described(read: Read) {
  const text = read.text("baseline_symptoms");
  return text ? { baseline_symptoms: text } : {};
}

function medicines(read: Read) {
  const meds = lines(read.text("medications_allergies"));
  return meds.length ? { medications_allergies: meds } : {};
}

export function parseNadPlusIntake(read: Read): Parsed {
  const errors: FieldError[] = [];
  const screening = booleans(read, NAD_SCREENING);
  return result({
    treatment_goals: someOf(read, "treatment_goals", NAD_GOALS, errors, "Pick at least one goal."),
    ...described(read),
    ...screening,
    // After kidney disease, whether a nephrologist approved it.
    ...(screening.kidney_disease ? { nephrologist_approval: read.text("nephrologist_approval") === "true" } : {}),
    ...selfInjection(read, errors),
    ...medicines(read),
  }, errors);
}

export function parseGlutathioneIntake(read: Read): Parsed {
  const errors: FieldError[] = [];
  return result({
    treatment_goals: someOf(read, "treatment_goals", GLUTATHIONE_GOALS, errors, "Pick at least one goal."),
    ...described(read),
    ...booleans(read, GLUTATHIONE_SCREENING),
    ...cancerTreatment(read, errors),
    ...selfInjection(read, errors),
    ...medicines(read),
  }, errors);
}

export function parseSermorelinIntake(read: Read): Parsed {
  const errors: FieldError[] = [];
  const { heightCm, weightKg, errors: measured } = metricHeightWeight(read.text);
  errors.push(...measured);
  const meds = lines(read.text("medications_allergies"));
  return result({
    treatment_goals: someOf(read, "treatment_goals", SERMORELIN_GOALS, errors, "Pick at least one goal."),
    height_cm: heightCm,
    weight_kg: weightKg,
    interacting_medications: someOf(read, "interacting_medications", SERMORELIN_INTERACTIONS, null, ""),
    ...booleans(read, SERMORELIN_SCREENING),
    ...selfInjection(read, errors),
    ...(meds.length ? { medications_allergies: meds } : {}),
  }, errors);
}

export function parseVitaminB12Intake(read: Read): Parsed {
  const errors: FieldError[] = [];
  const symptoms = someOf(read, "treatment_goals", B12_SYMPTOMS, errors, "Pick at least one symptom.");
  const described = read.text("baseline_symptoms");
  if (symptoms.includes("other") && !described) {
    errors.push({ pointer: pointer("baseline_symptoms"), message: "Tell us about the other symptoms." });
  }
  const duration = read.text("condition_duration");
  if (!keys(DURATIONS).includes(duration)) errors.push({ pointer: pointer("condition_duration"), message: "Pick how long you've had them." });
  return result({
    treatment_goals: symptoms,
    condition_duration: duration,
    ...(described ? { baseline_symptoms: described } : {}),
    ...booleans(read, B12_SCREENING_ABSORPTION),
    ...booleans(read, B12_SCREENING_HEALTH),
    ...cancerTreatment(read, errors),
    ...selfInjection(read, errors),
    // Required: acid reducers, metformin and colchicine affect B12. Empty means none.
    medications_allergies: lines(read.text("medications_allergies")),
  }, errors);
}

export function parseOxytocinIntake(read: Read): Parsed {
  const errors: FieldError[] = [];
  const sleep = read.text("sleep_history");
  if (!sleep) errors.push({ pointer: pointer("sleep_history"), message: "Tell us how you sleep." });
  const mentalHealth = read.text("psychiatric_history");
  if (!mentalHealth) errors.push({ pointer: pointer("psychiatric_history"), message: "Tell us about your mental health history, or write “None reported”." });
  // The protocol makes the consent a condition of treatment: Lithos refuses an intake without it.
  if (read.text("off_label_understanding_attested") !== "true") {
    errors.push({ pointer: pointer("off_label_understanding_attested"), message: "You need to agree to this to continue." });
  }
  const nasal = read.text("nasal_sinus_history");
  const meds = lines(read.text("medications_allergies"));
  return result({
    treatment_goals: someOf(read, "treatment_goals", OXYTOCIN_CONCERNS, errors, "Pick at least one concern."),
    sleep_history: sleep,
    sleep_disorders: someOf(read, "sleep_disorders", OXYTOCIN_SLEEP_DISORDERS, null, ""),
    psychiatric_history: mentalHealth,
    ...booleans(read, OXYTOCIN_SUICIDE_SCREEN),
    ...booleans(read, OXYTOCIN_SCREENING_MENTAL),
    ...booleans(read, OXYTOCIN_SCREENING_HEALTH),
    ...cancerTreatment(read, errors),
    ...(nasal ? { nasal_sinus_history: nasal } : {}),
    ...(meds.length ? { medications_allergies: meds } : {}),
    off_label_understanding_attested: true,
  }, errors);
}

export const WELLNESS_PARSERS: Record<string, (read: Read) => Parsed> = {
  nad_plus: parseNadPlusIntake,
  glutathione: parseGlutathioneIntake,
  sermorelin: parseSermorelinIntake,
  vitamin_b12: parseVitaminB12Intake,
  oxytocin: parseOxytocinIntake,
};
