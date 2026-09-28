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
  ["pancreatitis_pancreatic_ca", "Pancreatitis or pancreatic cancer"],
  ["hepatitis_liver_disease", "Active hepatitis or liver disease"],
  ["kidney_disease", "Moderate to severe kidney disease"],
  ["retinopathy", "Diabetic eye disease (retinopathy)"],
  ["gallbladder", "Gallbladder disease or gallstones, or gallbladder removed in the last 3 months"],
  ["gastroparesis_sbo", "Gastroparesis, or a past small-bowel obstruction"],
] as const;

/** Conditions, now or in the past — metabolic, cardiac, mental health, pregnancy. */
export const WEIGHT_SCREENING_HEALTH = [
  ["uncontrolled_diabetes", "Diabetes that isn't under control (HbA1c over 8%)"],
  ["t1d_or_insulin_secretagogue", "Type 1 diabetes, or taking insulin, a sulfonylurea or a gliptin"],
  ["triglycerides_over_500", "Triglycerides over 500"],
  ["recent_cardiac_event", "A heart attack or stroke in the last 6 months, or a heart condition that limits daily activity"],
  ["recent_bariatric_losing", "Weight-loss surgery in the last 6 months, and still losing weight from it"],
  ["eating_disorder", "Anorexia or bulimia, now or in the past"],
  ["unmanaged_mental_illness", "A serious mental health condition that isn't currently managed"],
  ["pregnancy", "Pregnant, breastfeeding, or planning a pregnancy in the next 2 months"],
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

type ScreeningField = (typeof WEIGHT_SCREENING_FIELDS)[number];

export type WeightManagementInitialIntake = {
  height_cm: number;
  weight_kg: number;
  comorbidities?: string[];
  already_on_glp1?: boolean;
} & Record<ScreeningField, boolean>;

/** Lithos's `Patient::HEIGHT_CM_RANGE`, and the schema's weight bounds. */
const HEIGHT_CM = { min: 50, max: 272 };
const WEIGHT_KG = { min: 30, max: 500 };

export type IntakeParse<T> = { ok: true; value: T } | { ok: false; errors: Array<{ pointer: string; message: string }> };

/**
 * US patients answer in feet, inches and pounds; the contract takes whole
 * centimetres and kilograms. Converting here keeps the conversion in one place
 * a reviewer can check.
 */
export function parseWeightIntake(get: (name: string) => string, has: (name: string) => boolean): IntakeParse<WeightManagementInitialIntake> {
  const errors: Array<{ pointer: string; message: string }> = [];
  const feet = Number(get("height_ft"));
  const inches = Number(get("height_in") || "0");
  const pounds = Number(get("weight_lb"));

  const heightCm = Math.round((feet * 12 + inches) * 2.54);
  if (!Number.isFinite(heightCm) || heightCm < HEIGHT_CM.min || heightCm > HEIGHT_CM.max) {
    errors.push({ pointer: "/intake_form/data/height_cm", message: "Enter your height in feet and inches." });
  }
  const weightKg = Math.round(pounds * 0.45359237 * 10) / 10;
  if (!Number.isFinite(weightKg) || weightKg < WEIGHT_KG.min || weightKg > WEIGHT_KG.max) {
    errors.push({ pointer: "/intake_form/data/weight_kg", message: "Enter your weight in pounds." });
  }
  if (errors.length > 0) return { ok: false, errors };

  const screening = Object.fromEntries(WEIGHT_SCREENING_FIELDS.map((name) => [name, has(name)])) as Record<ScreeningField, boolean>;
  const comorbidities = WEIGHT_COMORBIDITIES.map(([key]) => key).filter((key) => has(`comorbidity_${key}`));
  const glp1 = get("already_on_glp1");

  return {
    ok: true,
    value: {
      height_cm: heightCm,
      weight_kg: weightKg,
      ...screening,
      ...(comorbidities.length > 0 ? { comorbidities } : {}),
      ...(glp1 === "true" || glp1 === "false" ? { already_on_glp1: glp1 === "true" } : {}),
    },
  };
}
