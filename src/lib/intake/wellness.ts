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
import { PREGNANCY_QUESTIONS } from "./pregnancy";
import { metricHeightWeight } from "./weight";

type Options = readonly (readonly [string, string])[];

export { DURATIONS };

export const WELLNESS_PROGRAMS = ["nad_plus", "glutathione", "sermorelin", "vitamin_b12", "oxytocin"];

/** The programs whose protocol asks for the oncologist's approval as a document. */
export const APPROVAL_DOCUMENT_PROGRAMS = ["vitamin_b12", "oxytocin"];

const MENTAL_HEALTH: readonly [string, string] = [
  "unmanaged_mental_illness",
  "I have a serious mental health condition that isn't under control (for example schizophrenia or bipolar disorder)",
];
const SEVERE_KIDNEY: readonly [string, string] = [
  "severe_kidney_disease",
  "Severe kidney disease: dialysis, or stage 4 or 5 kidney disease or kidney failure",
];
const CANCER: readonly [string, string] = ["cancer_history", "I've had cancer, now or in the past"];
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
  SEVERE_KIDNEY,
  ["cellular_metabolism_medications", "I take a medicine that affects how my cells use energy (my doctor would know)"],
  ["hypersensitivity", "I'm allergic to NAD+ or any of its ingredients"],
  MENTAL_HEALTH,
  ...PREGNANCY_QUESTIONS,
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
  ["sulfhydryl_medication_allergy", "I'm allergic to a sulfhydryl medicine, such as penicillamine or captopril"],
  ["sulfur_compound_allergy", "I'm allergic to sulfur compounds"],
  ["hypersensitivity", "I'm allergic to glutathione or any of its ingredients"],
  ["asthma", "I have asthma"],
  CANCER,
  SEVERE_KIDNEY,
  ["on_chemotherapy", "I take a chemotherapy medicine"],
  MENTAL_HEALTH,
  ...PREGNANCY_QUESTIONS,
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
  SEVERE_KIDNEY,
  MENTAL_HEALTH,
  ...PREGNANCY_QUESTIONS,
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
  CANCER,
  ["mic_ingredient_allergy", "I'm allergic to methionine, inositol or choline"],
  ["homocystinuria", "I have homocystinuria or another inherited problem breaking down methionine"],
  ["schizophrenia", "I have schizophrenia, even if it's managed"],
  ["trimethylaminuria", "I have trimethylaminuria (fish odor syndrome)"],
  MENTAL_HEALTH,
  ...PREGNANCY_QUESTIONS,
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

/** The suicide and behavioral health screen. */
export const OXYTOCIN_SUICIDE_SCREEN: Options = [
  ["recent_wish_to_be_dead", "In the past few weeks, I've wished I were dead"],
  ["recent_better_off_dead_thoughts", "In the past few weeks, I've felt my family or I would be better off if I were dead"],
  ["suicidal_thoughts_past_week", "In the past week, I've had thoughts about killing myself"],
  ["suicide_attempt_ever", "I've tried to kill myself, at any time"],
  ["harm_thoughts_past_3_months", "In the past 3 months, I've had thoughts of hurting myself or someone else"],
];

export const OXYTOCIN_SCREENING_MENTAL: Options = [
  ["schizophrenia", "I have schizophrenia, even if it's managed"],
  ["bipolar_disorder", "I have bipolar disorder, even if it's managed"],
  ["schizoaffective_disorder", "I have schizoaffective disorder, even if it's managed"],
  ["psychiatric_hospitalization_ever", "I've stayed in a psychiatric hospital, at any time"],
  ["active_psychosis_or_mania", "I'm hearing or seeing things others don't, or I'm in a manic or hypomanic episode"],
  ["feeling_depressed_now", "I'm feeling depressed right now"],
  ["uncontrolled_anxiety", "My anxiety isn't under control"],
  ["substance_use_disorder", "Alcohol or drug use gets in the way of my life"],
  ["mania_or_hypomania_history", "I've had mania or hypomania, without a bipolar diagnosis"],
  ["mood_medication", "I take an antidepressant or another mood medicine"],
  ["severe_ptsd_or_emotional_dysregulation", "I have severe PTSD, or real trouble controlling my emotions"],
  ["cognitive_impairment", "I have significant memory or thinking problems"],
  MENTAL_HEALTH,
];

export const OXYTOCIN_SCREENING_HEALTH: Options = [
  ["uncontrolled_cardiovascular_disease", "I have heart disease that isn't under control"],
  ["uncontrolled_seizure_disorder", "I have seizures that aren't under control"],
  ["severe_nasal_pathology", "I have a severe nose problem (for example severe blockage)"],
  ["nasal_or_sinus_surgery", "I've had nose or sinus surgery"],
  ["intranasal_substance_use", "I take a medicine or anything else through my nose"],
  ["uncontrolled_illness_needing_specialist", "I have another serious illness that isn't under control"],
  ["liver_disease", "Liver disease, such as cirrhosis or raised liver enzymes"],
  ["hyponatremia", "I've been told I have low sodium in my blood"],
  ["hypersensitivity", "I'm allergic to oxytocin"],
  CANCER,
  SEVERE_KIDNEY,
  ...PREGNANCY_QUESTIONS,
  STEROIDS,
];

export const OXYTOCIN_CONTRAINDICATED_MEDICATIONS: Options = [
  ["prostaglandin", "A prostaglandin, such as misoprostol or dinoprostone"],
  ["ergot_alkaloid", "An ergot medicine, such as ergotamine or methylergonovine"],
  ["desmopressin", "Desmopressin (DDAVP)"],
  ["vasopressin", "Vasopressin"],
];

export const SUICIDE_ATTEMPT_TIMING: Options = [["within_12_months", "In the last 12 months"], ["more_than_12_months", "More than 12 months ago"]];

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

/** Both lists are required: empty means none. */
function medicines(read: Read) {
  return { current_medications: lines(read.text("current_medications")), allergies: lines(read.text("allergies")) };
}

/** The symptoms in the patient's words, required. */
function describedRequired(read: Read, errors: FieldError[]) {
  const text = read.text("baseline_symptoms").trim();
  if (!text) errors.push({ pointer: pointer("baseline_symptoms"), message: "Tell us about your symptoms in your own words." });
  return { baseline_symptoms: text };
}

export function parseNadPlusIntake(read: Read): Parsed {
  const errors: FieldError[] = [];
  const screening = booleans(read, NAD_SCREENING);
  return result({
    treatment_goals: someOf(read, "treatment_goals", NAD_GOALS, errors, "Pick at least one goal."),
    ...describedRequired(read, errors),
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
    ...describedRequired(read, errors),
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
  return result({
    treatment_goals: someOf(read, "treatment_goals", SERMORELIN_GOALS, errors, "Pick at least one goal."),
    height_cm: heightCm,
    weight_kg: weightKg,
    interacting_medications: someOf(read, "interacting_medications", SERMORELIN_INTERACTIONS, null, ""),
    ...booleans(read, SERMORELIN_SCREENING),
    ...selfInjection(read, errors),
    ...medicines(read),
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
    current_medications: lines(read.text("current_medications")),
    allergies: lines(read.text("allergies")),
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
  const screen = { ...booleans(read, OXYTOCIN_SUICIDE_SCREEN), ...booleans(read, OXYTOCIN_SCREENING_MENTAL), ...booleans(read, OXYTOCIN_SCREENING_HEALTH) };
  const followOn: Record<string, unknown> = {};
  if (screen.suicide_attempt_ever) {
    const timing = read.text("suicide_attempt_timing");
    if (!keys(SUICIDE_ATTEMPT_TIMING).includes(timing)) errors.push({ pointer: pointer("suicide_attempt_timing"), message: "Pick when it was." });
    followOn.suicide_attempt_timing = timing;
  }
  if (OXYTOCIN_SUICIDE_SCREEN.some(([key]) => key !== "harm_thoughts_past_3_months" && screen[key])) {
    followOn.suicidal_thoughts_current = yes(read, "suicidal_thoughts_current", errors, "Answer whether you're having these thoughts now.");
  }
  if (screen.mood_medication) {
    const details = read.text("mood_medication_details").trim();
    if (!details) errors.push({ pointer: pointer("mood_medication_details"), message: "Name the medicine and dose." });
    followOn.mood_medication_details = details;
  }
  if (screen.nasal_or_sinus_surgery) {
    const date = read.text("nasal_or_sinus_surgery_date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push({ pointer: pointer("nasal_or_sinus_surgery_date"), message: "Enter the date of the surgery." });
    followOn.nasal_or_sinus_surgery_date = date;
  }
  return result({
    treatment_goals: someOf(read, "treatment_goals", OXYTOCIN_CONCERNS, errors, "Pick at least one concern."),
    sleep_history: sleep,
    sleep_disorders: someOf(read, "sleep_disorders", OXYTOCIN_SLEEP_DISORDERS, null, ""),
    psychiatric_history: mentalHealth,
    ...screen,
    ...followOn,
    contraindicated_medications: someOf(read, "contraindicated_medications", OXYTOCIN_CONTRAINDICATED_MEDICATIONS, null, ""),
    ...(nasal ? { nasal_sinus_history: nasal } : {}),
    ...medicines(read),
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
