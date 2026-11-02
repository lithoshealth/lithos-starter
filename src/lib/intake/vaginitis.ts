/**
 * The vaginitis intake (BV and yeast), shared by the patient-facing intake
 * (which asks it) and the journey (which sends it). The field names and values
 * are Lithos's `vaginitis` initial contract (the Intake Schemas guide); keep
 * them as they are. The questions follow the Vaginitis (BV and Yeast Infection)
 * clinical protocol (v0.4). No photos or labs for a classic presentation.
 *
 * Client-safe: no server imports.
 */

import { DIABETES, IMMUNE_COMPROMISE, PREGNANCY_QUESTIONS } from "./ringworm";

type Options = readonly (readonly [string, string])[];

export { DIABETES, IMMUNE_COMPROMISE, PREGNANCY_QUESTIONS };

export const VAGINITIS_ODORS: Options = [
  ["none", "No unusual odor"],
  ["fishy", "Fishy, often worse after sex or a period"],
  ["foul", "Foul or rotten"],
];

export const VAGINITIS_DISCHARGE: Options = [
  ["none", "No unusual discharge"],
  ["thin_gray_or_white", "Thin, gray or white"],
  ["thick_clumpy", "Thick and clumpy"],
  ["yellow_green_or_frothy", "Yellow-green or frothy"],
  ["other", "Something else"],
];

export const VAGINITIS_SYMPTOMS: Options = [["itching", "Itching"], ["burning", "Burning"], ["redness", "Redness"], ["swelling", "Swelling"]];

/** Call 911 or go to the emergency department. */
export const VAGINITIS_SCREENING_EMERGENCY: Options = [["severe_pain", "Severe pain"], ["fainting", "Fainting"]];

/** Each of these needs an in-person exam. */
export const VAGINITIS_SCREENING_URGENT: Options = [
  ["pelvic_or_abdominal_pain", "Pelvic or abdominal pain"],
  ["fever", "A fever"],
  ["chills", "Chills"],
  ["abnormal_bleeding", "Abnormal vaginal bleeding"],
  ["bleeding_after_sex", "Bleeding after sex"],
  ["genital_sores", "New sores, blisters or ulcers"],
  ["significant_urinary_symptoms", "Pain or burning inside when I urinate, or needing to go often or urgently"],
  ["blood_in_urine", "Blood in my urine"],
  ["flank_pain", "Pain in my side"],
  ["severe_swelling", "Severe swelling"],
  ["rapidly_worsening_symptoms", "Swelling or pain that's getting worse quickly"],
  ["untested_recurrent_symptoms", "These symptoms keep coming back or won't go away, and I haven't been tested recently"],
];

export const VAGINITIS_SCREENING_EXPOSURE: Options = [
  ["sti_exposure", "I've been exposed to a sexually transmitted infection"],
  ["partner_symptoms", "A sexual partner has symptoms"],
  ["new_partner", "A new sexual partner, with no symptoms and no known exposure"],
];

export const VAGINITIS_SCREENING_YEAST: Options = [
  ["severe_yeast_symptoms", "Widespread redness and swelling, or cracks, sores or raw skin from scratching"],
  ["yeast_returned_within_2_months", "A yeast infection came back within 2 months"],
  ["failed_otc_yeast_treatment", "Over-the-counter yeast treatment didn't work"],
];

export const VAGINITIS_SCREENING_MEDICINES: Options = [
  ["nitroimidazole_allergy", "An allergy to metronidazole or a similar medicine"],
  ["disulfiram_last_2_weeks", "I took disulfiram in the last 2 weeks"],
  ["cockayne_syndrome", "Cockayne syndrome"],
  ["clindamycin_or_lincomycin_allergy", "An allergy to clindamycin or lincomycin"],
  ["c_difficile_history", "A C. difficile infection, ever"],
  ["ibd_diagnosis", "Ulcerative colitis or Crohn's"],
  ["antibiotic_associated_colitis", "Colitis or severe diarrhea after an antibiotic"],
  ["fluconazole_allergy", "An allergy to fluconazole"],
  ["other_azole_allergy", "An allergy to another azole antifungal"],
  ["qt_prolonging_drug", "I take erythromycin, pimozide, quinidine or another drug that affects heart rhythm"],
];

export const VAGINITIS_SCREENING_HEALTH: Options = [
  ["warfarin", "I take warfarin"],
  ["lithium", "I take lithium"],
  ["seizure_medication", "I take phenytoin, phenobarbital or carbamazepine for seizures"],
  ["busulfan", "I take busulfan"],
  ["sulfonylurea", "I take a sulfonylurea for diabetes"],
  ["hepatitis_liver_disease", "Active hepatitis or liver disease"],
  ["neurologic_disease", "A neurologic disease"],
];

export const VAGINITIS_HISTORY: Options = [
  ["antimicrobial_last_90_days", "An antibiotic or antifungal in the last 90 days"],
  ["retained_tampon_possible", "I might have a tampon stuck inside"],
  ["irritant_products", "I douche or use scented washes or products"],
  ["latex_barrier_use", "I use latex condoms or a diaphragm"],
];

// ------------------------------------------------------------------ parsing

type FieldError = { pointer: string; message: string };
type Read = { text: (name: string) => string; all: (name: string) => string[]; checked: (name: string) => boolean };
type Parsed = { ok: true; value: Record<string, unknown> } | { ok: false; errors: FieldError[] };

const pointer = (name: string) => `/intake_form/data/${name}`;
const keys = (options: Options) => options.map(([key]) => key);
const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);
const booleans = (read: Read, options: Options) => Object.fromEntries(keys(options).map((name) => [name, read.checked(name)]));

function oneOf(read: Read, name: string, options: Options, errors: FieldError[], message: string): string {
  const value = read.text(name);
  if (!keys(options).includes(value)) errors.push({ pointer: pointer(name), message });
  return value;
}

function count(read: Read, name: string, max: number, errors: FieldError[], message: string): number {
  const raw = read.text(name);
  const value = Number(raw);
  if (raw === "" || !Number.isInteger(value) || value < 0 || value > max) errors.push({ pointer: pointer(name), message });
  return value;
}

export function parseVaginitisIntake(read: Read): Parsed {
  const errors: FieldError[] = [];
  const discharge = oneOf(read, "discharge", VAGINITIS_DISCHARGE, errors, "Pick what the discharge is like.");
  const dischargeOther = read.text("discharge_other");
  if (discharge === "other" && !dischargeOther) {
    errors.push({ pointer: pointer("discharge_other"), message: "Describe the discharge in your own words." });
  }
  const ph = read.text("ph_result");
  if (ph !== "" && !(Number(ph) >= 0 && Number(ph) <= 14)) {
    errors.push({ pointer: pointer("ph_result"), message: "A pH result is a number from 0 to 14." });
  }
  const details = read.text("prior_diagnosis_details");
  const testedOn = read.text("most_recent_test_on");

  const value = {
    odor: oneOf(read, "odor", VAGINITIS_ODORS, errors, "Pick what the odor is like."),
    discharge,
    ...(discharge === "other" && dischargeOther ? { discharge_other: dischargeOther } : {}),
    vulvovaginal_symptoms: read.all("vulvovaginal_symptoms").filter((v) => keys(VAGINITIS_SYMPTOMS).includes(v)),
    symptom_duration_days: count(read, "symptom_duration_days", 3650, errors, "Say how many days you've had symptoms."),
    confirmed_bv_episodes_12_months: count(read, "confirmed_bv_episodes_12_months", 52, errors, "Say how many confirmed BV episodes you've had, 0 to 52."),
    yeast_episodes_12_months: count(read, "yeast_episodes_12_months", 52, errors, "Say how many yeast infections you've had, 0 to 52."),
    diabetes: oneOf(read, "diabetes", DIABETES, errors, "Say whether you have diabetes."),
    immune_compromise: oneOf(read, "immune_compromise", IMMUNE_COMPROMISE, errors, "Say whether your immune system is weakened."),
    ...booleans(read, VAGINITIS_SCREENING_EMERGENCY),
    ...booleans(read, VAGINITIS_SCREENING_URGENT),
    ...booleans(read, VAGINITIS_SCREENING_EXPOSURE),
    ...booleans(read, PREGNANCY_QUESTIONS),
    ...booleans(read, VAGINITIS_SCREENING_YEAST),
    ...booleans(read, VAGINITIS_SCREENING_MEDICINES),
    ...booleans(read, VAGINITIS_SCREENING_HEALTH),
    ...booleans(read, VAGINITIS_HISTORY),
    ...(ph !== "" ? { ph_result: Number(ph) } : {}),
    ...(details ? { prior_diagnosis_details: details } : {}),
    ...(testedOn ? { most_recent_test_on: testedOn } : {}),
    // All required by Lithos; an empty list means none.
    prior_products: lines(read.text("prior_products")),
    current_medications: lines(read.text("current_medications")),
    allergies: lines(read.text("allergies")),
  };
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
}
