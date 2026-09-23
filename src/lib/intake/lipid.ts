/**
 * The lipid-management initial intake's wording, shared by the patient-facing
 * intake (which asks it) and the setup page's review card (which reads it back).
 * The field names are Lithos's lipid_management contract — keep them as they are.
 *
 * Client-safe: no server imports.
 */

export const LIPID_SCREENING = [
  ["established_atherosclerotic_cardiovascular_disease", "I've been diagnosed with heart disease, stroke, or peripheral artery disease"],
  ["recent_cardiac_condition", "I've had a recent cardiac event or hospitalization (heart attack, stent, bypass)"],
  ["drug_hypersensitivity", "I've had an allergic reaction to a cholesterol medication"],
  ["cirrhosis", "I have cirrhosis"],
  ["severe_hepatic_impairment", "I have severe liver impairment"],
  ["severe_renal_impairment", "I have severe kidney impairment"],
  ["pregnancy", "I'm pregnant, breastfeeding, or planning a pregnancy"],
  ["currently_taking_cyclosporine", "I currently take cyclosporine"],
] as const;

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
