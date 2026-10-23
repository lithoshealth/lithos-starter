/**
 * The hair loss intake, shared by the patient-facing intake (which asks it)
 * and the journey (which sends it). The field names and values are Lithos's
 * `hair_loss` initial contract (the Intake Schemas guide); keep them as they
 * are. The questions follow the Hair Loss (Androgenetic Alopecia) clinical
 * protocol (v0.1).
 *
 * Pregnancy potential, contraception and prostate history are asked
 * directly, never inferred from the patient's sex. No photos: the protocol
 * asks for them only when the clinician does.
 *
 * Client-safe: no server imports.
 */

import { DURATIONS } from "./derm";

type Options = readonly (readonly [string, string])[];

export { DURATIONS };

export const HAIR_GOALS: Options = [["slow_the_loss", "Slow the loss"], ["regrow_hair", "Regrow hair"], ["thicker_hair", "Thicker hair"]];

export const HAIR_AREAS: Options = [
  ["hairline", "Hairline"], ["temples", "Temples"], ["crown", "Crown"], ["part_line", "Part line"], ["all_over", "All over"],
];

export const HAIR_PACES: Options = [["slow", "Slowly"], ["steady", "Steadily"], ["fast", "Fast"]];

export const HAIR_CHANGES: Options = [["thinning", "Thinning"], ["shedding", "Shedding"], ["both", "Both"]];

/** Signs it may not be pattern hair loss: each answered "yes" or left unticked. */
export const HAIR_SCREENING_SIGNS: Options = [
  ["atypical_hair_loss", "Patchy loss, scarring, sores, scalp pain or burning, a lot of redness or scaling, sudden shedding all over, or losing eyebrow or body hair"],
  ["menstrual_irregularity_or_excess_hair", "Irregular periods, new hair on my face or body, or a deeper voice"],
  ["breast_lump_pain_or_discharge", "A breast lump, breast pain, or discharge from a nipple"],
  ["recent_shedding_trigger", "Recent childbirth, illness, big weight loss, a strict diet or major stress, with shedding"],
];

export const HAIR_SCREENING_MOOD: Options = [
  ["current_depression_or_unstable_mood", "I feel low or depressed now, or my mood condition isn't stable"],
  ["stable_mood_disorder_history", "I've had a mood condition that is now stable"],
  ["past_suicidal_thoughts_or_behavior", "I've had thoughts of suicide or self-harm in the past"],
  ["current_suicidal_thoughts", "I'm having thoughts of suicide now"],
];

export const HAIR_FERTILITY: Options = [
  ["pregnancy", "I'm pregnant, might be, or I'm breastfeeding"],
  ["trying_to_conceive", "I'm, or my partner is, trying to conceive"],
  ["fertility_plans", "I plan to have children soon"],
];

export const HAIR_SCREENING_MEDICINES: Options = [
  ["current_finasteride_5mg_or_dutasteride", "I already take finasteride 5 mg or dutasteride, for example for my prostate"],
  ["finasteride_allergy", "I'm allergic to finasteride"],
  ["dutasteride_allergy", "I'm allergic to dutasteride"],
  ["potassium_raising_medications", "I take an ACE inhibitor, an ARB, potassium supplements or salt substitutes, or a water pill like spironolactone or eplerenone"],
  ["blood_pressure_medications", "I take blood pressure medicine"],
  ["topical_minoxidil_use", "I use minoxidil foam or solution on my scalp"],
];

export const HAIR_SCREENING_HEALTH: Options = [
  ["heart_disease", "Heart disease"],
  ["arrhythmia_fainting_or_swelling", "An irregular heartbeat, fainting, or swelling in my legs or ankles"],
  ["low_blood_pressure_symptoms", "Dizziness or fainting when I stand up"],
  ["kidney_disease", "Kidney disease"],
  ["high_potassium", "High potassium"],
  ["addisons_disease", "Addison's disease"],
  ["hepatitis_liver_disease", "Liver disease, including hepatitis"],
  ["prostate_cancer_or_raised_psa", "Prostate cancer, or a raised PSA"],
  ["current_sexual_symptoms", "Low sex drive, or erection or ejaculation problems"],
];

export const FINASTERIDE_RISKS =
  "I understand finasteride and dutasteride can cause lower sex drive, erection or ejaculation problems and mood changes, " +
  "and that some people report effects that continue after stopping.";

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

function yesNo(read: Read, name: string, errors: FieldError[], message: string): boolean {
  const value = read.text(name);
  if (value !== "true" && value !== "false") errors.push({ pointer: pointer(name), message });
  return value === "true";
}

export function parseHairLossIntake(read: Read): Parsed {
  const errors: FieldError[] = [];
  const goals = picked(read, "treatment_goals", HAIR_GOALS);
  if (goals.length === 0) errors.push({ pointer: pointer("treatment_goals"), message: "Pick at least one goal." });
  const areas = picked(read, "thinning_areas", HAIR_AREAS);
  if (areas.length === 0) errors.push({ pointer: pointer("thinning_areas"), message: "Pick where your hair is thinning." });

  const canBecomePregnant = yesNo(read, "can_become_pregnant", errors, "Say whether you could become pregnant.");
  const contraceptionMethod = read.text("contraception_method");

  const value = {
    treatment_goals: goals,
    thinning_areas: areas,
    condition_duration: oneOf(read, "condition_duration", DURATIONS, errors, "Pick how long ago the thinning started."),
    thinning_pace: oneOf(read, "thinning_pace", HAIR_PACES, errors, "Pick how fast it's going."),
    shedding_or_thinning: oneOf(read, "shedding_or_thinning", HAIR_CHANGES, errors, "Pick thinning, shedding or both."),
    family_history: yesNo(read, "family_history", errors, "Say whether a parent or sibling has pattern hair loss."),
    can_become_pregnant: canBecomePregnant,
    // Only someone who could become pregnant is asked; anyone else sends false.
    reliable_contraception: canBecomePregnant && read.text("reliable_contraception") === "true",
    ...(canBecomePregnant && contraceptionMethod ? { contraception_method: contraceptionMethod } : {}),
    ...booleans(read, HAIR_SCREENING_SIGNS),
    ...booleans(read, HAIR_SCREENING_MOOD),
    ...booleans(read, HAIR_FERTILITY),
    ...booleans(read, HAIR_SCREENING_MEDICINES),
    ...booleans(read, HAIR_SCREENING_HEALTH),
    // Both required by Lithos; an empty list means none.
    medications_allergies: lines(read.text("medications_allergies")),
    prior_hair_treatments: lines(read.text("prior_hair_treatments")),
    // A "no" only rules out finasteride and dutasteride: the other treatments don't need it.
    // Dutasteride is only for someone whose loss kept going after 12 months of finasteride.
    finasteride_12_months_without_stabilization: yesNo(read, "finasteride_12_months_without_stabilization", errors,
      "Say whether you've taken finasteride for 12 months or more."),
    finasteride_risks_attested: yesNo(read, "finasteride_risks_attested", errors, "Say whether you understand the side effects."),
  };
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
}
