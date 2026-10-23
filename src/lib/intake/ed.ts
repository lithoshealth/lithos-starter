/**
 * The erectile dysfunction intake, shared by the patient-facing intake (which
 * asks it) and the journey (which sends it). The field names and values are
 * Lithos's `erectile_dysfunction` initial contract (the Intake Schemas guide);
 * keep them as they are. The questions follow the Erectile Dysfunction clinical
 * protocol (v0.1).
 *
 * Lithos needs a blood pressure from the last 6 months; an older one still goes
 * through, and the clinician sees every medicine ruled out until there's a
 * new one. No photos, no labs.
 *
 * Client-safe: no server imports.
 */

import { DURATIONS } from "./derm";

type Options = readonly (readonly [string, string])[];

export { DURATIONS };

export const ED_GOALS: Options = [
  ["get_an_erection", "Get an erection"],
  ["keep_an_erection", "Keep an erection"],
  ["more_confidence", "Feel more confident"],
  ["less_planning", "Less planning around sex"],
];

export const ED_ONSETS: Options = [["gradual", "Gradually, over time"], ["sudden", "Suddenly"]];

export const ED_CONSISTENCY: Options = [["every_time", "Every time"], ["most_times", "Most times"], ["sometimes", "Sometimes"]];

export const CLIMBS_TWO_FLIGHTS: Options = [["yes", "Yes"], ["no", "No"], ["unsure", "I'm not sure"]];

export const BLOOD_PRESSURE_SETTINGS: Options = [["home", "At home"], ["pharmacy", "At a pharmacy"], ["clinic", "At a clinic"]];

export const CARDIOVASCULAR_RISK_FACTORS: Options = [
  ["diabetes", "Diabetes"],
  ["high_cholesterol", "High cholesterol"],
  ["smoking", "I smoke"],
  ["sleep_apnea_symptoms", "Snoring, or stopping breathing in my sleep"],
  ["heart_valve_disease", "Heart valve disease"],
];

export const RELATED_MEDICATIONS: Options = [["finasteride", "Finasteride"], ["antidepressant", "An antidepressant"], ["opioid", "An opioid"]];

/** Heart and blood pressure: each answered "yes" or left unticked. */
export const ED_SCREENING_HEART: Options = [
  ["nitrate_or_poppers_use", "I take nitrates (nitroglycerin pills, spray or patches, or isosorbide), or use poppers, even now and then, or I'm not sure"],
  ["riociguat_use", "I take riociguat (Adempas)"],
  ["chest_pain_or_advised_against_sex", "I get chest pain, including during sex, or a doctor told me to avoid sex or exertion"],
  ["recent_cardiac_event", "I've had a heart attack, stroke or serious irregular heartbeat in the last 6 months, or an irregular heartbeat that isn't controlled"],
  ["heart_failure_last_6_months", "I've had heart failure in the last 6 months"],
  ["hypertrophic_obstructive_cardiomyopathy", "I have hypertrophic cardiomyopathy"],
  ["stable_heart_disease", "I have other heart disease that is treated and stable"],
  ["low_blood_pressure_symptoms", "I get dizzy or faint when I stand up"],
];

/** Medicines that interact with sildenafil and tadalafil. */
export const ED_SCREENING_MEDICINES: Options = [
  ["pde5_inhibitor_elsewhere", "I already take sildenafil, tadalafil or a similar medicine from another doctor, or for my lungs"],
  ["alpha_blocker_or_blood_pressure_medications", "I take blood pressure medicine, or tamsulosin, doxazosin or a similar medicine for my prostate"],
  ["cyp3a4_inhibitor_medications", "I take HIV or hepatitis C medicine, ketoconazole, itraconazole, clarithromycin or erythromycin"],
  ["sildenafil_allergy", "I'm allergic to sildenafil (Viagra)"],
  ["tadalafil_allergy", "I'm allergic to tadalafil (Cialis)"],
];

export const ED_SCREENING_HEALTH: Options = [
  ["severe_kidney_or_liver_disease", "I have severe kidney disease or I'm on dialysis, or I have severe liver disease"],
  ["moderate_kidney_or_liver_disease", "I have moderate kidney or liver disease"],
  ["naion_retinitis_pigmentosa_or_angle_closure", "I've had sudden vision loss in one eye, retinitis pigmentosa, or acute angle-closure glaucoma"],
  ["retinal_disease_or_sudden_hearing_loss", "I have another retina condition, or I've had sudden hearing loss"],
  ["spinal_cord_injury_t6_or_above", "I have a spinal cord injury at chest level or higher"],
  ["active_peyronies_disease", "I have Peyronie's disease that got worse this past year or makes erections painful"],
  ["priapism_risk", "I've had an erection lasting 4 hours or more, I have sickle cell disease, leukemia or myeloma, or a penile deformity"],
];

/** Background: each answered "yes" or left unticked. */
export const ED_HISTORY: Options = [
  ["low_libido", "My sex drive is low"],
  ["ejaculation_problems", "I have problems with ejaculation"],
  ["mood_or_anxiety", "I've been feeling low or anxious"],
  ["pelvic_surgery_or_radiation", "I've had pelvic surgery or radiation"],
  ["penile_pain_curvature_or_injury", "I have penile pain, curvature or an injury"],
  ["regular_grapefruit", "I eat grapefruit or drink grapefruit juice regularly"],
];

export const NITRATE_ACKNOWLEDGMENT =
  "I understand I must never take this medicine with nitrates, including nitroglycerin pills, spray or patches, or with poppers.";

// ------------------------------------------------------------------ parsing

type FieldError = { pointer: string; message: string };
type Read = { text: (name: string) => string; all: (name: string) => string[]; checked: (name: string) => boolean };
type Parsed = { ok: true; value: Record<string, unknown> } | { ok: false; errors: FieldError[] };

const pointer = (name: string) => `/intake_form/data/${name}`;
const keys = (options: Options) => options.map(([key]) => key);
const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);
const booleans = (read: Read, options: Options) => Object.fromEntries(keys(options).map((name) => [name, read.checked(name)]));
const picked = (read: Read, name: string, options: Options) => read.all(name).filter((v) => keys(options).includes(v));

function oneOf(read: Read, name: string, options: Options, errors: FieldError[], message: string): string {
  const value = read.text(name);
  if (!keys(options).includes(value)) errors.push({ pointer: pointer(name), message });
  return value;
}

function wholeNumber(read: Read, name: string, errors: FieldError[], message: string, min = 1): number {
  const value = Number(read.text(name));
  if (!Number.isInteger(value) || value < min) errors.push({ pointer: pointer(name), message });
  return value;
}

export function parseEdIntake(read: Read): Parsed {
  const errors: FieldError[] = [];
  const goals = picked(read, "treatment_goals", ED_GOALS);
  if (goals.length === 0) errors.push({ pointer: pointer("treatment_goals"), message: "Pick at least one goal." });

  const measuredOn = read.text("blood_pressure_measured_on");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(measuredOn)) {
    errors.push({ pointer: pointer("blood_pressure_measured_on"), message: "Enter the date of your blood pressure reading." });
  }

  // The protocol makes the acknowledgment a condition of treatment: Lithos refuses an intake without it.
  if (read.text("nitrate_acknowledgment_attested") !== "true") {
    errors.push({ pointer: pointer("nitrate_acknowledgment_attested"), message: "You need to agree never to take it with nitrates to continue." });
  }

  const value = {
    blood_pressure_systolic: wholeNumber(read, "blood_pressure_systolic", errors, "Enter the top number of your blood pressure."),
    blood_pressure_diastolic: wholeNumber(read, "blood_pressure_diastolic", errors, "Enter the bottom number of your blood pressure."),
    blood_pressure_measured_on: measuredOn,
    blood_pressure_setting: oneOf(read, "blood_pressure_setting", BLOOD_PRESSURE_SETTINGS, errors, "Pick where the reading was taken."),
    treatment_goals: goals,
    condition_duration: oneOf(read, "condition_duration", DURATIONS, errors, "Pick how long you've had the problem."),
    ed_onset: oneOf(read, "ed_onset", ED_ONSETS, errors, "Pick whether it came on gradually or suddenly."),
    erection_consistency: oneOf(read, "erection_consistency", ED_CONSISTENCY, errors, "Pick how often it happens."),
    morning_erections: read.text("morning_erections") === "true",
    climbs_two_flights: oneOf(read, "climbs_two_flights", CLIMBS_TWO_FLIGHTS, errors, "Pick whether you can climb two flights of stairs."),
    cardiovascular_risk_factors: picked(read, "cardiovascular_risk_factors", CARDIOVASCULAR_RISK_FACTORS),
    related_medications: picked(read, "related_medications", RELATED_MEDICATIONS),
    heavy_drinking_days_past_year: wholeNumber(read, "heavy_drinking_days_past_year", errors, "Enter a number, 0 if never.", 0),
    ...booleans(read, ED_SCREENING_HEART),
    ...booleans(read, ED_SCREENING_MEDICINES),
    ...booleans(read, ED_SCREENING_HEALTH),
    ...booleans(read, ED_HISTORY),
    // Both required by Lithos; an empty list means none.
    medications_allergies: lines(read.text("medications_allergies")),
    prior_ed_medications: lines(read.text("prior_ed_medications")),
    nitrate_acknowledgment_attested: true,
  };
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
}
