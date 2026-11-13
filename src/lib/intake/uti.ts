/**
 * The urinary tract infection intake, shared by the patient-facing intake
 * (which asks it) and the journey (which sends it). The field names and values
 * are Lithos's `urinary_tract_infection` initial contract (the Intake Schemas
 * guide); keep them as they are. The questions follow the Uncomplicated UTI
 * clinical protocol (v1.0). No photos or labs; the optional temperature and
 * creatinine aren't asked here.
 *
 * Client-safe: no server imports.
 */

import { DIABETES } from "./ringworm";
import { PREGNANCY_QUESTIONS } from "./pregnancy";
import { booleans, count, detailWhen, isoDate, lines, oneOf, picked, type Options, type Parsed, type Read, type FieldError } from "./shared";

export { DIABETES, PREGNANCY_QUESTIONS };

export const UTI_SYMPTOMS: Options = [
  ["painful_urination", "Burning or pain when I pee"],
  ["frequency", "Peeing more often"],
  ["urgency", "A sudden, strong need to pee"],
  ["lower_abdominal_pain", "Pain in my lower belly"],
];

export const PELVIC_PAIN: Options = [["none", "No"], ["mild", "Yes, mild"], ["significant", "Yes, significant"]];

/** Signs the infection may have spread: each a hard stop. */
export const UTI_SCREENING_URGENT: Options = [
  ["fever", "A temperature of 100.4°F (38°C) or higher"],
  ["chills", "Chills or shaking"],
  ["flank_pain", "Pain in my back or side"],
  ["vomiting", "Vomiting"],
  ["unable_to_keep_fluids_down", "I can't keep fluids down"],
  ["confusion", "Confusion"],
  ["fainting", "Fainting"],
  ["severely_ill", "I feel severely ill"],
];

/** Things that make it more than a simple bladder infection: each a hard stop. */
export const UTI_SCREENING_URINARY: Options = [
  ["altered_urinary_anatomy", "My urinary tract has been reconstructed, or isn't native female anatomy"],
  ["urinary_catheter", "I have a urinary catheter"],
  ["kidney_stones", "Kidney stones"],
  ["urinary_blockage", "A known blockage in my urinary tract"],
  ["unable_to_urinate", "I can't pee"],
  ["urologic_surgery", "I've had urologic surgery"],
  ["recent_urinary_procedure", "A recent procedure on my bladder or urinary tract, such as a cystoscopy"],
  ["heavy_blood_in_urine", "Heavy bleeding in my urine"],
  ["blood_clots_in_urine", "Blood clots in my urine"],
  ["weakened_immune_system", "A weakened immune system: chemotherapy, a transplant, or HIV with a low CD4 count"],
  ["unable_to_take_oral_medicine", "I can't take medicine by mouth"],
];

export const UTI_SCREENING_MEDICINES: Options = [
  ["nitrofurantoin_allergy", "An allergy to nitrofurantoin (Macrobid)"],
  ["nitrofurantoin_organ_reaction", "Jaundice, or a liver or lung reaction, after nitrofurantoin"],
  ["sulfa_allergy", "An allergy to sulfa drugs"],
  ["trimethoprim_allergy", "An allergy to trimethoprim"],
  ["dofetilide", "I take dofetilide"],
  ["methotrexate", "I take methotrexate"],
  ["potassium_raising_medicine", "I take an ACE inhibitor, an ARB, spironolactone or potassium"],
  ["drug_induced_low_platelets", "Low platelets caused by a medicine, ever"],
  ["folate_deficiency_anemia", "Anemia from low folate"],
  ["marked_liver_disease", "Serious liver disease"],
  ["fosfomycin_allergy", "An allergy to fosfomycin"],
  ["cephalosporin_allergy", "An allergy to a cephalosporin, such as cephalexin"],
  ["severe_penicillin_reaction", "Anaphylaxis, hives, swelling or trouble breathing after a penicillin"],
];

/** Sent to the clinician with the request. */
export const UTI_FLAGS: Options = [
  ["failed_recent_uti_course", "A recent UTI antibiotic didn't work"],
  ["antimicrobial_last_90_days", "Any antibiotic or antifungal in the last 90 days"],
  ["resistant_infection_history", "A resistant infection in the past"],
  ["vaginal_discharge", "Vaginal discharge"],
  ["vaginal_itching", "Vaginal itching"],
  ["genital_sores", "New sores, blisters or ulcers on my genitals"],
  ["new_partner", "A new sexual partner"],
  ["sti_exposure", "Exposure to a sexually transmitted infection"],
  ["blood_in_urine", "Some blood in my urine, without heavy bleeding or clots"],
  ["menopause", "I've gone through menopause"],
  ["g6pd_deficiency", "G6PD deficiency"],
  ["warfarin", "I take warfarin"],
  ["unclear_allergy", "An allergy where I'm not sure of the medicine or the reaction"],
  ["systemic_steroids", "I take steroid pills, or have had steroid injections"],
];

export const UTI_HISTORY: Options = [
  ["nausea", "Nausea"],
  ["kidney_disease", "Kidney disease or dialysis, or I've been told to take lower doses for my kidneys"],
];

export function parseUtiIntake(read: Read): Parsed {
  const errors: FieldError[] = [];
  const sixMonths = count(read, "utis_last_6_months", errors, "Enter a number from 0 to 52.");
  const twelveMonths = count(read, "utis_last_12_months", errors, "Enter a number from 0 to 52.");
  if (twelveMonths < sixMonths) errors.push({ pointer: "/intake_form/data/utis_last_12_months", message: "The last 12 months include the last 6." });

  const value = {
    ...booleans(read, UTI_SCREENING_URGENT, UTI_SCREENING_URINARY, PREGNANCY_QUESTIONS, UTI_SCREENING_MEDICINES, UTI_FLAGS, UTI_HISTORY),
    ...detailWhen(read, read.checked("systemic_steroids"), "systemic_steroid_details", errors, "Say why, for how long and what dose."),
    urinary_symptoms: picked(read, "urinary_symptoms", UTI_SYMPTOMS),
    pelvic_pain: oneOf(read, "pelvic_pain", PELVIC_PAIN, errors, "Pick whether you have pelvic pain."),
    symptoms_started_on: isoDate(read, "symptoms_started_on", errors, "Enter the day your symptoms started."),
    utis_last_6_months: sixMonths,
    utis_last_12_months: twelveMonths,
    diabetes: oneOf(read, "diabetes", DIABETES, errors, "Pick whether you have diabetes."),
    current_medications: lines(read.text("current_medications")),
    allergies: lines(read.text("allergies")),
  };
  return errors.length ? { ok: false, errors } : { ok: true, value };
}
