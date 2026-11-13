/**
 * The sinusitis intake, shared by the patient-facing intake (which asks it)
 * and the journey (which sends it). The field names are Lithos's `sinusitis`
 * initial contract (the Intake Schemas guide); keep them as they are. The
 * questions follow the Acute Bacterial Sinusitis clinical protocol (v1.0). No
 * photos or labs; the optional temperature and creatinine aren't asked here.
 *
 * Client-safe: no server imports.
 */

import { PREGNANCY_QUESTIONS } from "./pregnancy";
import { booleans, count, detailWhen, isoDate, lines, picked, pointer, type Options, type Parsed, type Read, type FieldError } from "./shared";

export { PREGNANCY_QUESTIONS };

export const SINUS_SYMPTOMS: Options = [
  ["nasal_blockage", "A blocked nose"],
  ["thick_colored_drainage", "Thick yellow or green drainage"],
  ["facial_pain_or_pressure", "Pain or pressure in my face"],
  ["tooth_pain", "Pain in my upper teeth"],
];

/** For these, call 911 or go to the nearest emergency department. */
export const SINUS_SCREENING_EMERGENCY: Options = [
  ["swelling_around_eye", "Swelling around my eye"],
  ["eye_movement_pain", "Pain when I move my eyes"],
  ["vision_change", "A change in my vision"],
  ["bulging_eye", "A bulging eye"],
  ["severe_persistent_headache", "A severe headache that won't go away"],
  ["facial_numbness", "Numbness in my face"],
  ["drooping_eyelid", "A drooping eyelid"],
  ["double_vision", "Double vision"],
  ["stiff_neck", "A stiff neck"],
  ["confusion", "Confusion"],
];

/** Each a hard stop. */
export const SINUS_SCREENING_HEALTH: Options = [
  ["fever", "A temperature of 100.4°F (38°C) or higher"],
  ["dehydration", "I can't keep fluids down, I'm peeing very little, or I'm dizzy when I stand"],
  ["sinus_surgery", "I've had sinus surgery"],
  ["weakened_immune_system", "A weakened immune system: chemotherapy, a transplant, or HIV with a low CD4 count"],
  ["unable_to_take_oral_medicine", "I can't take medicine by mouth"],
];

export const SINUS_SCREENING_MEDICINES: Options = [
  ["severe_penicillin_reaction", "Anaphylaxis, hives, swelling or trouble breathing after a penicillin"],
  ["severe_skin_reaction_to_penicillin", "Blistering or peeling skin after a penicillin"],
  ["penicillin_allergy", "A milder penicillin allergy, such as a rash"],
  ["amoxicillin_clavulanate_jaundice", "Jaundice after amoxicillin/clavulanate (Augmentin)"],
  ["cephalosporin_allergy", "An allergy to a cephalosporin, such as cephalexin"],
  ["tetracycline_allergy", "An allergy to doxycycline, minocycline or another tetracycline"],
  ["isotretinoin", "I take isotretinoin"],
  ["acne_doxycycline_supply", "I have doxycycline for acne"],
  ["clindamycin_allergy", "An allergy to clindamycin"],
  ["c_difficile_history", "A C. difficile infection, ever"],
  ["colitis_history", "Colitis of any kind, ever"],
];

/** Sent to the clinician with the request. */
export const SINUS_FLAGS: Options = [
  ["antibiotic_last_90_days", "Any antibiotic in the last 90 days"],
  ["recent_hospitalization", "A recent hospital stay"],
  ["resistant_infection_history", "A resistant infection in the past"],
  ["one_sided_tooth_pain", "Tooth pain on one side"],
  ["recent_dental_work", "Recent dental work"],
  ["unclear_allergy", "An allergy where I'm not sure of the medicine or the reaction"],
  ["liver_disease", "Liver disease"],
  ["warfarin", "I take warfarin"],
  ["allopurinol", "I take allopurinol"],
  ["possible_mononucleosis", "A sore throat with swollen glands and tiredness, or a recent mono diagnosis"],
  ["systemic_steroids", "I take steroid pills, or have had steroid injections"],
];

export const SINUS_HISTORY: Options = [
  ["worsened_after_improving", "I got better, then worse again"],
  ["antibiotic_last_month", "Any antibiotic in the last month"],
  ["antacid_or_mineral_supplement", "I take antacids, or iron, calcium, magnesium or zinc"],
  ["kidney_disease", "Kidney disease or dialysis, or I've been told to take lower doses for my kidneys"],
  ["nasal_polyps", "Nasal polyps"],
  ["deviated_septum", "A deviated septum"],
];

export function parseSinusitisIntake(read: Read): Parsed {
  const errors: FieldError[] = [];
  const worsened = read.checked("worsened_after_improving");
  const day = Number(read.text("worsened_on_day"));
  if (worsened && (!Number.isInteger(day) || day < 1 || day > 28)) {
    errors.push({ pointer: pointer("worsened_on_day"), message: "Enter the day it got worse, from 1 to 28." });
  }

  const value = {
    ...booleans(read, SINUS_SCREENING_EMERGENCY, SINUS_SCREENING_HEALTH, PREGNANCY_QUESTIONS, SINUS_SCREENING_MEDICINES, SINUS_FLAGS, SINUS_HISTORY),
    ...(worsened ? { worsened_on_day: day } : {}),
    ...detailWhen(read, read.checked("systemic_steroids"), "systemic_steroid_details", errors, "Say why, for how long and what dose."),
    sinus_symptoms: picked(read, "sinus_symptoms", SINUS_SYMPTOMS),
    symptoms_started_on: isoDate(read, "symptoms_started_on", errors, "Enter the day your symptoms started."),
    episodes_last_12_months: count(read, "episodes_last_12_months", errors, "Enter a number from 0 to 52."),
    failed_antibiotic_courses: count(read, "failed_antibiotic_courses", errors, "Enter a number from 0 to 52."),
    current_medications: lines(read.text("current_medications")),
    allergies: lines(read.text("allergies")),
  };
  return errors.length ? { ok: false, errors } : { ok: true, value };
}
