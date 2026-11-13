/**
 * The pink eye intake, shared by the patient-facing intake (which asks it) and
 * the journey (which sends it). The field names are Lithos's `conjunctivitis`
 * initial contract (the Intake Schemas guide); keep them as they are. The
 * questions follow the Conjunctivitis clinical protocol (v1.0). Lithos takes an
 * optional photo of each eye; this sandbox sends none, since it has no sample
 * eye images and must never send a real person's. No labs.
 *
 * Client-safe: no server imports.
 */

import { PREGNANCY_QUESTIONS } from "./pregnancy";
import { booleans, detailWhen, isoDate, lines, oneOf, pointer, type Options, type Parsed, type Read, type FieldError } from "./shared";

export { PREGNANCY_QUESTIONS };

export const AFFECTED_EYES: Options = [["left", "Left"], ["right", "Right"], ["both", "Both"]];
export const EYE_DISCHARGE: Options = [["none", "None"], ["watery", "Watery"], ["thick_pus", "Thick pus"]];
export const EYE_PAIN: Options = [["none", "None"], ["mild", "Mild"], ["moderate", "Moderate"], ["severe", "Severe"]];
export const LIGHT_SENSITIVITY: Options = [["none", "No"], ["mild", "A little"], ["significant", "A lot"]];

/** For these, call 911 or go to the nearest emergency department. */
export const PINK_EYE_SCREENING_EMERGENCY: Options = [
  ["eye_movement_pain", "Pain when I move my eyes"],
  ["double_vision", "Double vision"],
  ["sudden_vision_loss", "Sudden loss of vision"],
  ["bulging_eye", "A bulging eye"],
  ["eye_injury", "An injury to my eye"],
  ["chemical_in_eye", "A chemical in my eye: start rinsing now"],
];

/** Each needs an in-person exam. */
export const PINK_EYE_SCREENING_EYE: Options = [
  ["eye_surgery_last_30_days", "Eye surgery in the last 30 days"],
  ["eye_swollen_shut", "My eye is swollen shut"],
  ["severe_eyelid_swelling", "Severe swelling of my eyelid or the face around my eye"],
  ["white_spot_on_eye", "A white spot on my eye"],
  ["blisters_near_eye", "Blisters on the skin near my eye"],
  ["rapidly_returning_heavy_pus", "Heavy pus that comes back quickly after wiping"],
  ["recurring_pink_eye", "Pink eye that keeps coming back"],
  ["sti_exposure", "Exposure to a sexually transmitted infection, such as gonorrhea or chlamydia"],
  ["fever", "A temperature of 100.4°F (38°C) or higher"],
  ["weakened_immune_system", "A weakened immune system: chemotherapy, a transplant, or HIV with a low CD4 count"],
];

export const PINK_EYE_SCREENING_MEDICINES: Options = [
  ["trimethoprim_allergy", "An allergy to trimethoprim"],
  ["sulfa_allergy", "An allergy to sulfa drugs, or an unclear reaction to Bactrim"],
  ["erythromycin_allergy", "An allergy to erythromycin"],
  ["fluoroquinolone_allergy", "An allergy to ciprofloxacin, moxifloxacin or a similar antibiotic"],
  ["azelastine_allergy", "An allergy to azelastine"],
  ["eye_drop_reaction", "A reaction to eye drops before"],
  ["systemic_steroids", "I take steroid pills, or have had steroid injections"],
];

export const PINK_EYE_HISTORY: Options = [
  ["spread_to_other_eye", "It spread from one eye to the other"],
  ["lids_stuck_shut", "My lids are stuck shut in the morning"],
  ["eye_itching", "My eye itches"],
  ["cold_symptoms", "A runny nose or other cold symptoms"],
  ["sick_contacts", "Close contact with someone who has pink eye or a cold"],
  ["seasonal_allergies", "Seasonal allergies"],
  ["contact_lenses", "I wear contact lenses"],
  ["prior_eye_disease", "Eye disease before, such as glaucoma or uveitis"],
  ["vision_change", "Blurry vision, or a change in my vision"],
];

const yes = (read: Read, name: string) => read.text(name) === "true";

export function parsePinkEyeIntake(read: Read): Parsed {
  const errors: FieldError[] = [];
  const paired = (question: string, detail: string, message: string) => {
    if (!read.checked(question)) return {};
    const raw = read.text(detail);
    if (raw !== "true" && raw !== "false") errors.push({ pointer: pointer(detail), message });
    return { [detail]: yes(read, detail) };
  };

  const value = {
    ...booleans(read, PINK_EYE_SCREENING_EMERGENCY, PINK_EYE_SCREENING_EYE, PREGNANCY_QUESTIONS, PINK_EYE_SCREENING_MEDICINES, PINK_EYE_HISTORY),
    ...paired("vision_change", "vision_change_clears_with_blinking", "Say whether it clears when you blink."),
    ...paired("contact_lenses", "contact_lenses_overnight", "Say whether you wear them overnight."),
    ...detailWhen(read, read.checked("systemic_steroids"), "systemic_steroid_details", errors, "Say why, for how long and what dose."),
    affected_eyes: oneOf(read, "affected_eyes", AFFECTED_EYES, errors, "Pick which eye."),
    symptoms_started_on: isoDate(read, "symptoms_started_on", errors, "Enter the day it started."),
    eye_discharge: oneOf(read, "eye_discharge", EYE_DISCHARGE, errors, "Pick the discharge."),
    eye_pain: oneOf(read, "eye_pain", EYE_PAIN, errors, "Pick how much it hurts."),
    light_sensitivity: oneOf(read, "light_sensitivity", LIGHT_SENSITIVITY, errors, "Pick whether light bothers your eyes."),
    treatments_tried: lines(read.text("treatments_tried")),
    current_medications: lines(read.text("current_medications")),
    allergies: lines(read.text("allergies")),
  };
  return errors.length ? { ok: false, errors } : { ok: true, value };
}
