/**
 * The weight-management initial intake: Lithos's `weight_management` contract
 * (api/app/contracts/intake/schemas/weight_management_initial.rb), with the
 * patient-facing wording this app asks it in.
 *
 * The contract's field names are fixed — keep them as they are. The labels are
 * ours: plain-language versions of the schema's field descriptions, split into
 * two screens so a patient isn't handed seventeen checkboxes at once.
 *
 * Client-safe: no server imports.
 */

/** Conditions, now or in the past — organ systems. Required booleans: unchecked is `false`. */
export const WEIGHT_SCREENING_ORGANS = [
  ["mtc_men2_personal", "Medullary thyroid cancer or MEN2 syndrome"],
  ["mtc_men2_family", "A family member with medullary thyroid cancer or MEN2"],
  ["thyroid_cancer", "Thyroid cancer of any kind"],
  ["pancreatitis_history", "Pancreatitis"],
  ["pancreatic_cancer_history", "Pancreatic cancer"],
  ["hepatitis_liver_disease", "Active hepatitis or liver disease"],
  ["kidney_disease", "Moderate to severe kidney disease"],
  ["retinopathy", "Diabetic eye disease (retinopathy)"],
  ["gallbladder", "Gallbladder disease or gallstones, or gallbladder removed in the last 3 months"],
  ["gastroparesis", "Gastroparesis"],
  ["bowel_obstruction_history", "A small or large bowel obstruction"],
  ["naion_history", "NAION: a sudden loss of blood flow to the optic nerve"],
  ["optic_neuritis_history", "Optic neuritis: inflammation of the optic nerve"],
] as const;

/** Conditions, now or in the past — metabolic, cardiac, mental health, pregnancy. */
export const WEIGHT_SCREENING_HEALTH = [
  ["uncontrolled_diabetes", "Diabetes that isn't under control (HbA1c over 8%)"],
  ["type_1_diabetes", "Type 1 diabetes"],
  ["insulin_use", "I take insulin"],
  ["sulfonylurea", "I take a sulfonylurea, such as glipizide or glimepiride"],
  ["gliptin_use", "I take a gliptin, such as sitagliptin (Januvia)"],
  ["triglycerides_over_500", "Triglycerides over 500"],
  ["recent_cardiac_event", "A heart attack or stroke in the last 6 months, or a heart condition that limits daily activity"],
  ["recent_bariatric_losing", "Weight-loss surgery in the last 6 months, and still losing weight from it"],
  ["eating_disorder", "Anorexia or bulimia, now or in the past"],
  ["unmanaged_mental_illness", "A serious mental health condition that isn't currently managed"],
  ["pregnant", "I'm pregnant, or might be"],
  ["breastfeeding", "I'm breastfeeding"],
  ["planning_pregnancy", "I'm trying to conceive or planning a pregnancy"],
] as const;

export const WEIGHT_SCREENING_FIELDS = [...WEIGHT_SCREENING_ORGANS, ...WEIGHT_SCREENING_HEALTH].map(([name]) => name);

/** Optional weight-related conditions — the contract's `comorbidities` enum. */
export const WEIGHT_COMORBIDITIES = [
  ["htn", "High blood pressure"],
  ["t2d", "Type 2 diabetes"],
  ["dyslipidemia", "High cholesterol or triglycerides"],
  ["osa", "Sleep apnea"],
  ["other", "Something else weight-related"],
] as const;

/** Lithos's `Patient::HEIGHT_CM_RANGE`, and the schema's weight bounds. */
const HEIGHT_CM = { min: 50, max: 272 };
const WEIGHT_KG = { min: 30, max: 500 };

/**
 * Feet, inches and pounds as the contract's whole centimetres and kilograms,
 * with an error for each one out of range. Shared with the Sermorelin intake,
 * which asks the same two.
 */
export function metricHeightWeight(get: (name: string) => string): {
  heightCm: number;
  weightKg: number;
  errors: Array<{ pointer: string; message: string }>;
} {
  const errors: Array<{ pointer: string; message: string }> = [];
  const heightCm = Math.round((Number(get("height_ft")) * 12 + Number(get("height_in") || "0")) * 2.54);
  if (!Number.isFinite(heightCm) || heightCm < HEIGHT_CM.min || heightCm > HEIGHT_CM.max) {
    errors.push({ pointer: "/intake_form/data/height_cm", message: "Enter your height in feet and inches." });
  }
  const weightKg = Math.round(Number(get("weight_lb")) * 0.45359237 * 10) / 10;
  if (!Number.isFinite(weightKg) || weightKg < WEIGHT_KG.min || weightKg > WEIGHT_KG.max) {
    errors.push({ pointer: "/intake_form/data/weight_kg", message: "Enter your weight in pounds." });
  }
  return { heightCm, weightKg, errors };
}

