/**
 * The BV partner treatment intake, shared by the patient-facing intake (which
 * asks it) and the journey (which sends it). The field names are Lithos's
 * `bv_partner_treatment` initial contract (the Intake Schemas guide); keep them
 * as they are. The questions follow the partner intake in the Vaginitis (BV and
 * Yeast Infection) clinical protocol (v0.4): the ongoing monogamous partner, male
 * or female, of a patient treated for BV. No photos or labs.
 *
 * Client-safe: no server imports.
 */

import { PREGNANCY_QUESTIONS } from "./ringworm";

type Options = readonly (readonly [string, string])[];

export { PREGNANCY_QUESTIONS };

/** Both must be yes. */
export const BV_PARTNER_RELATIONSHIP: Options = [
  ["partner_treated_for_bv", "My partner is being treated for BV"],
  ["ongoing_monogamous_relationship", "We're in an ongoing, monogamous relationship"],
];

/** Each of these needs STI testing or an in-person exam. */
export const BV_PARTNER_SCREENING_SYMPTOMS: Options = [
  ["genital_sores", "Sores, blisters or a rash on my genitals"],
  ["genital_discharge", "Discharge from my penis or vagina"],
  ["urinary_symptoms", "Burning, pain or difficulty urinating"],
  ["back_pain", "Back pain"],
  ["flank_pain", "Pain in my side"],
  ["fever", "A fever"],
  ["chills", "Chills"],
  ["pelvic_or_abdominal_pain", "Pelvic or abdominal pain"],
  ["testicular_pain", "Testicular pain"],
];

export const BV_PARTNER_SCREENING_MEDICINES: Options = [
  ["nitroimidazole_allergy", "An allergy to metronidazole or a similar medicine"],
  ["disulfiram_last_2_weeks", "I took disulfiram in the last 2 weeks"],
  ["cockayne_syndrome", "Cockayne syndrome"],
  ["clindamycin_or_lincomycin_allergy", "An allergy to clindamycin or lincomycin"],
  ["c_difficile_history", "A C. difficile infection, ever"],
  ["ibd_diagnosis", "Ulcerative colitis or Crohn's"],
  ["antibiotic_associated_colitis", "Colitis or severe diarrhea after an antibiotic"],
];

export const BV_PARTNER_SCREENING_HEALTH: Options = [
  ["warfarin", "I take warfarin"],
  ["lithium", "I take lithium"],
  ["seizure_medication", "I take phenytoin, phenobarbital or carbamazepine for seizures"],
  ["busulfan", "I take busulfan"],
  ["hepatitis_liver_disease", "Active hepatitis or liver disease"],
  ["neurologic_disease", "Seizures or another neurologic disease"],
  ["rash_elsewhere", "A rash somewhere else on my body"],
];

// ------------------------------------------------------------------ parsing

type FieldError = { pointer: string; message: string };
type Read = { text: (name: string) => string; all: (name: string) => string[]; checked: (name: string) => boolean };
type Parsed = { ok: true; value: Record<string, unknown> } | { ok: false; errors: FieldError[] };

const pointer = (name: string) => `/intake_form/data/${name}`;
const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);
const booleans = (read: Read, options: Options) => Object.fromEntries(options.map(([name]) => [name, read.checked(name)]));

export function parseBvPartnerIntake(read: Read): Parsed {
  const errors: FieldError[] = [];
  const raw = read.text("heavy_drinking_days_past_year");
  const heavyDrinkingDays = Number(raw);
  if (raw === "" || !Number.isInteger(heavyDrinkingDays) || heavyDrinkingDays < 0) {
    errors.push({ pointer: pointer("heavy_drinking_days_past_year"), message: "Say how many days, 0 or more." });
  }

  const value = {
    ...booleans(read, BV_PARTNER_RELATIONSHIP),
    ...booleans(read, BV_PARTNER_SCREENING_SYMPTOMS),
    ...booleans(read, PREGNANCY_QUESTIONS),
    ...booleans(read, BV_PARTNER_SCREENING_MEDICINES),
    ...booleans(read, BV_PARTNER_SCREENING_HEALTH),
    heavy_drinking_days_past_year: heavyDrinkingDays,
    medical_history: lines(read.text("medical_history")),
    current_medications: lines(read.text("current_medications")),
    allergies: lines(read.text("allergies")),
  };
  return errors.length ? { ok: false, errors } : { ok: true, value };
}
