/**
 * The lipid-management initial intake's wording, shared by the patient-facing
 * intake (which asks it) and the setup page's review card (which reads it back).
 * The field names are Lithos's lipid_management contract — keep them as they are.
 *
 * Client-safe: no server imports.
 */

/** The intake's required yes/no answers (protocol version 2), one fact each. */
export const LIPID_SCREENING = [
  ["established_atherosclerotic_cardiovascular_disease", "I've been diagnosed with heart disease, a stroke or TIA, or peripheral artery disease"],
  ["recent_cardiac_condition", "I've had a cardiac event or hospital stay in the last 12 months, or a heart condition that isn't being actively managed"],
  ["serious_allergic_reaction_to_repatha", "I've had a serious allergic reaction to Repatha (evolocumab) or something in it"],
  ["serious_allergic_reaction_to_lerochol", "I've had a serious allergic reaction to Lerochol (lerodalcibep) or something in it"],
  ["cirrhosis", "I have cirrhosis"],
  ["severe_hepatic_impairment", "I have severe liver impairment"],
  ["severe_renal_impairment", "Severe kidney disease: dialysis, or stage 4 or 5 kidney disease or kidney failure"],
  ["pregnant", "I'm pregnant, or might be"],
  ["breastfeeding", "I'm breastfeeding"],
  ["planning_pregnancy", "I'm trying to conceive or planning a pregnancy"],
  ["rare_or_inherited_lipid_disorder", "A rare or inherited cholesterol disorder that needs a specialist (not just high LDL)"],
] as const;

export type LipidScreeningKey = (typeof LIPID_SCREENING)[number][0];
export const LIPID_SCREENING_KEYS = LIPID_SCREENING.map(([key]) => key) as LipidScreeningKey[];

/** Emergency symptoms right now: any one means 911, not this program. */
export const LIPID_EMERGENCY_SYMPTOMS = [
  ["chest_pain_or_pressure", "Chest pain or pressure"],
  ["new_weakness_or_numbness", "New weakness or numbness"],
  ["facial_droop_or_speech_trouble", "A drooping face or trouble speaking"],
  ["severe_shortness_of_breath", "Severe shortness of breath"],
  ["throat_or_facial_swelling", "Swelling of the throat or face"],
] as const;
export const LIPID_EMERGENCY_KEYS = LIPID_EMERGENCY_SYMPTOMS.map(([key]) => key) as string[];

/** Whole-program hard stops: a yes means no encounter. The two drug allergies only rule out that drug. */
export const LIPID_HARD_STOPS: LipidScreeningKey[] = [
  "pregnant", "breastfeeding", "planning_pregnancy", "cirrhosis", "severe_hepatic_impairment", "severe_renal_impairment",
  "rare_or_inherited_lipid_disorder",
];

export const LIPID_INDICATIONS: Record<string, string> = {
  hypercholesterolemia: "High cholesterol",
  cardiovascular_risk_reduction: "Lowering heart-disease risk",
};

export const FH_STATUS: Record<string, string> = {
  none: "No",
  heterozygous: "Yes — heterozygous",
  homozygous: "Yes — homozygous",
  unknown: "Not sure",
};
