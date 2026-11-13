/**
 * The menopausal hormone therapy intake, shared by the patient-facing intake
 * (which asks it) and the journey (which sends it). The field names are
 * Lithos's `menopausal_hormone_therapy` initial contract (the Intake Schemas
 * guide); keep them as they are. The questions follow the Menopausal Hormone
 * Therapy clinical protocol (v0.3, a draft). Lithos orders the labs; a blood
 * pressure from the last 6 months is required. No photos.
 *
 * Client-safe: no server imports.
 */

import { DURATIONS } from "./derm";
import { PREGNANCY_QUESTIONS } from "./pregnancy";
import { metricHeightWeight } from "./weight";
import {
  bloodPressure, booleans, detailWhen, lines, oneOf, picked, pointer, type Options, type Parsed, type Read, type FieldError,
} from "./shared";

export { DURATIONS, PREGNANCY_QUESTIONS };

export const HRT_GOALS: Options = [
  ["hot_flashes_night_sweats", "Hot flashes and night sweats"],
  ["vaginal_symptoms", "Vaginal dryness, painful sex or bladder symptoms"],
  ["both", "Both"],
];
const VAGINAL_GOALS = ["vaginal_symptoms", "both"];

export const HRT_SYMPTOMS: Options = [
  ["hot_flashes", "Hot flashes"],
  ["night_sweats", "Night sweats"],
  ["sleep_problems", "Trouble sleeping"],
  ["mood_changes", "Mood changes"],
  ["vaginal_dryness", "Vaginal dryness"],
  ["painful_sex", "Painful sex"],
  ["urinary_symptoms", "Bladder symptoms"],
];

export const HRT_SEVERITIES: Options = [["mild", "Mild"], ["moderate", "Moderate"], ["severe", "Severe"]];
export const HRT_CYCLE_PATTERNS: Options = [["regular", "Regular periods"], ["irregular", "Irregular periods"], ["no_periods", "No periods"]];

export const HRT_CONTRACEPTION: Options = [
  ["none", "None"],
  ["condoms", "Condoms"],
  ["combined_hormonal", "A combined pill, patch or ring"],
  ["progestin_only_pill", "A progestin-only pill"],
  ["iud", "An IUD"],
  ["implant", "An implant"],
  ["injection", "An injection"],
  ["permanent", "Tubal ligation or another permanent method"],
  ["partner_vasectomy", "My partner had a vasectomy"],
  ["other", "Something else"],
];
export const HRT_IUD_TYPES: Options = [
  ["levonorgestrel_52mg", "A 52 mg hormonal IUD (Mirena or Liletta)"],
  ["levonorgestrel_other", "Another hormonal IUD (Kyleena or Skyla)"],
  ["copper", "A copper IUD (Paragard)"],
];

/** Each a hard stop. */
export const HRT_SCREENING_STOPS: Options = [
  ["unexplained_vaginal_bleeding", "Vaginal bleeding without a known cause"],
  ["bleeding_after_12_months_without_period", "Any bleeding after 12 months without a period"],
  ["breast_cancer", "Breast cancer, now or in the past"],
  ["endometrial_cancer", "Uterine (endometrial) cancer, now or in the past"],
  ["other_estrogen_sensitive_cancer", "Another estrogen-sensitive cancer, now or in the past"],
  ["past_blood_clot", "A blood clot in my leg or lung, ever"],
  ["past_stroke", "A stroke, ever"],
  ["past_heart_attack", "A heart attack, ever"],
  ["clotting_disorder", "A clotting disorder, such as antiphospholipid syndrome"],
  ["liver_disease", "Liver disease"],
  ["past_endometrial_hyperplasia", "Endometrial hyperplasia, in the past"],
  ["estradiol_allergy", "An allergic reaction to estradiol"],
];

/** Each rules out one medicine. */
export const HRT_SCREENING_MEDICINES: Options = [
  ["progesterone_intolerance", "I can't take progesterone"],
  ["peanut_allergy", "A peanut allergy"],
  ["migraine_with_aura", "Migraine with aura"],
  ["smoking", "I smoke"],
];

/** Asked when vaginal estradiol may be prescribed. */
export const HRT_VAGINAL_SAFETY: Options = [
  ["new_vaginal_discharge_odor_or_itching", "New vaginal discharge, odor or itching"],
  ["blood_in_urine", "Blood in my urine"],
  ["recurrent_urinary_infections", "Repeated urinary infections"],
];

/** Sent to the clinician with the request. */
export const HRT_FLAGS: Options = [
  ["current_hormone_therapy_other_prescriber", "I'm on hormone therapy from another doctor"],
  ["gallbladder_disease", "Gallbladder disease"],
  ["endometriosis", "Endometriosis"],
  ["lupus", "Lupus"],
];

export const HRT_HISTORY: Options = [
  ["hysterectomy", "My uterus has been removed (hysterectomy)"],
  ["ovaries_removed", "Both my ovaries have been removed"],
  ["period_last_12_months", "I've had a period in the last 12 months"],
  ["bleeding_after_sex", "Bleeding after sex"],
  ["heavy_or_prolonged_bleeding", "Very heavy or long periods"],
  ["bleeding_between_periods", "Bleeding between periods"],
  ["family_breast_cancer", "A mother, sister or daughter with breast cancer"],
  ["brca_or_high_risk_gene", "A BRCA or other high-risk gene"],
  ["atypical_breast_biopsy", "A breast biopsy that showed atypical cells"],
  ["ovarian_cancer", "Ovarian cancer, now or in the past"],
  ["diabetes", "Diabetes"],
  ["high_cholesterol_or_triglycerides", "High cholesterol or triglycerides"],
  ["thyroid_disease", "Thyroid disease"],
];

const date = (read: Read, name: string) => {
  const value = read.text(name);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? { [name]: value } : {};
};

export function parseHrtIntake(read: Read): Parsed {
  const errors: FieldError[] = [];
  const goal = oneOf(read, "main_goal", HRT_GOALS, errors, "Pick what you'd like treated.");
  const symptoms = picked(read, "symptoms", HRT_SYMPTOMS);
  if (symptoms.length === 0) errors.push({ pointer: pointer("symptoms"), message: "Pick at least one symptom." });
  const contraception = picked(read, "contraception", HRT_CONTRACEPTION);
  if (contraception.length === 0) errors.push({ pointer: pointer("contraception"), message: "Pick your contraception, or None." });
  const iud = contraception.includes("iud");
  if (iud && !/^\d{4}-\d{2}-\d{2}$/.test(read.text("iud_inserted_on"))) {
    errors.push({ pointer: pointer("iud_inserted_on"), message: "Enter when the IUD was put in." });
  }
  const { heightCm, weightKg, errors: measured } = metricHeightWeight(read.text);
  errors.push(...measured);

  const value = {
    ...booleans(read, HRT_SCREENING_STOPS, PREGNANCY_QUESTIONS, HRT_SCREENING_MEDICINES, HRT_FLAGS, HRT_HISTORY),
    ...(VAGINAL_GOALS.includes(goal) ? booleans(read, HRT_VAGINAL_SAFETY) : {}),
    main_goal: goal,
    symptoms,
    symptom_severity: oneOf(read, "symptom_severity", HRT_SEVERITIES, errors, "Pick how bothersome they are."),
    condition_duration: oneOf(read, "condition_duration", DURATIONS, errors, "Pick how long you've had them."),
    cycle_pattern: oneOf(read, "cycle_pattern", HRT_CYCLE_PATTERNS, errors, "Pick your periods over the last 12 months."),
    ...date(read, "last_menstrual_period_on"),
    contraception,
    ...detailWhen(read, contraception.includes("other"), "contraception_other", errors, "Say which method."),
    ...(iud ? {
      iud_type: oneOf(read, "iud_type", HRT_IUD_TYPES, errors, "Pick which IUD."),
      iud_inserted_on: read.text("iud_inserted_on"),
    } : {}),
    prior_hormone_therapy: lines(read.text("prior_hormone_therapy")),
    ...date(read, "last_mammogram_on"),
    height_cm: heightCm,
    weight_kg: weightKg,
    ...bloodPressure(read, errors),
    current_medications: lines(read.text("current_medications")),
    allergies: lines(read.text("allergies")),
  };
  return errors.length ? { ok: false, errors } : { ok: true, value };
}
