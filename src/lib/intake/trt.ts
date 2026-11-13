/**
 * The testosterone replacement intake, shared by the patient-facing intake
 * (which asks it) and the journey (which sends it). The field names are
 * Lithos's `testosterone_replacement` initial contract (the Intake Schemas
 * guide); keep them as they are. The questions follow the Testosterone
 * Replacement Therapy clinical protocol (v0.4, a draft). Lithos orders the labs
 * and books the first video visit; a blood pressure from the last 6 months is
 * required. A patient already on testosterone sends a photo of the vial or
 * label, which this sandbox can't, so it asks only patients who aren't.
 *
 * Client-safe: no server imports.
 */

import { DURATIONS } from "./derm";
import { metricHeightWeight } from "./weight";
import { bloodPressure, booleans, lines, oneOf, picked, pointer, type Options, type Parsed, type Read, type FieldError } from "./shared";

export { DURATIONS };

export const TRT_SYMPTOMS: Options = [
  ["low_libido", "Low sex drive"],
  ["erectile_dysfunction", "Trouble with erections"],
  ["fewer_morning_erections", "Fewer morning erections"],
  ["fatigue", "Tiredness"],
  ["low_mood", "Low mood"],
  ["poor_concentration", "Trouble concentrating"],
  ["less_muscle_strength", "Less muscle strength"],
  ["less_body_hair", "Less body hair"],
];

/** Each a hard stop. */
export const TRT_SCREENING_STOPS: Options = [
  ["gender_affirming_therapy", "I'm looking for gender-affirming hormone therapy"],
  ["prostate_cancer", "Prostate cancer, now, in the past, or suspected"],
  ["male_breast_cancer", "Breast cancer, now, in the past, or suspected"],
  ["prostate_lump", "A known lump in my prostate"],
  ["clotting_disorder", "A clotting disorder, such as factor V Leiden"],
  ["severe_urinary_symptoms", "Straining to pee, a very weak stream, or I can't empty my bladder"],
  ["untreated_severe_sleep_apnea", "Severe sleep apnea that isn't treated"],
  ["heart_attack_or_stroke_last_6_months", "A heart attack or stroke in the last 6 months"],
  ["uncontrolled_heart_failure", "Heart failure that isn't controlled"],
  ["serious_liver_disease", "Serious liver disease"],
  ["serious_kidney_disease", "Serious kidney disease"],
  ["anabolic_steroid_use_last_12_months", "Anabolic steroids, or testosterone not prescribed to me, in the last 12 months"],
  ["pituitary_tumor", "A pituitary tumor"],
  ["headaches_with_vision_changes", "New headaches with changes in my vision"],
];

/** Each rules out one medicine. */
export const TRT_SCREENING_MEDICINES: Options = [
  ["planning_children_12_months", "I plan to have children in the next 12 months"],
  ["skin_contact_risk", "Children or a pregnant partner can't avoid touching my skin"],
  ["cottonseed_or_benzyl_benzoate_allergy", "An allergy to cottonseed oil or benzyl benzoate"],
  ["liver_disease", "Liver disease of any kind, even mild"],
  ["thyroid_or_adrenal_disease_uncontrolled", "Thyroid or adrenal disease that isn't controlled"],
  ["clomiphene_vision_problems", "Vision problems when I took clomiphene"],
];

/** Sent to the clinician with the request. */
export const TRT_FLAGS: Options = [
  ["past_blood_clot", "A blood clot in my leg or lung, in the past"],
  ["other_heart_disease", "Other heart disease: stable heart failure, valve disease or an irregular heartbeat"],
  ["blood_pressure_medications", "I take blood pressure medicine"],
  ["opioid_medications", "I take opioid pain medicine"],
  ["steroid_medications", "I take steroid medicine, such as prednisone"],
  ["diabetes", "Diabetes"],
  ["heavy_alcohol_use", "I drink heavily"],
  ["mild_urinary_symptoms", "A weak stream, or waking at night to pee"],
];

export const TRT_HISTORY: Options = [
  ["prior_infertility", "Infertility, ever"],
  ["testicular_history", "Testicle problems or surgery, mumps, chemotherapy or radiation"],
  ["pituitary_disease_or_head_injury", "Pituitary disease or a head injury"],
  ["loud_snoring_or_breathing_pauses", "Loud snoring, or pauses in my breathing when I sleep"],
  ["sleep_apnea_treated", "Sleep apnea that's treated, for example with CPAP"],
  ["prior_abnormal_psa_or_prostate_biopsy", "An abnormal PSA, or a prostate biopsy"],
  ["family_prostate_cancer", "A father, brother or son with prostate cancer"],
  ["black_or_african_american_ancestry", "I'm Black or African American"],
];

export function parseTrtIntake(read: Read): Parsed {
  const errors: FieldError[] = [];
  const symptoms = picked(read, "symptoms", TRT_SYMPTOMS);
  if (symptoms.length === 0) errors.push({ pointer: pointer("symptoms"), message: "Pick at least one symptom." });
  const { heightCm, weightKg, errors: measured } = metricHeightWeight(read.text);
  errors.push(...measured);

  const value = {
    ...booleans(read, TRT_SCREENING_STOPS, TRT_SCREENING_MEDICINES, TRT_FLAGS, TRT_HISTORY),
    // Already on testosterone needs a label photo this sandbox can't send.
    current_testosterone_other_prescriber: false,
    symptoms,
    condition_duration: oneOf(read, "condition_duration", DURATIONS, errors, "Pick how long you've had the symptoms."),
    prior_testosterone_tests: lines(read.text("prior_testosterone_tests")),
    prior_testosterone_treatment: lines(read.text("prior_testosterone_treatment")),
    height_cm: heightCm,
    weight_kg: weightKg,
    ...bloodPressure(read, errors),
    current_medications: lines(read.text("current_medications")),
    allergies: lines(read.text("allergies")),
  };
  return errors.length ? { ok: false, errors } : { ok: true, value };
}
