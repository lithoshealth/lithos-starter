/**
 * The eyelash growth intake, shared by the patient-facing intake (which asks
 * it) and the journey (which sends it). The field names and values are
 * Lithos's `eyelash_growth` initial contract (the Intake Schemas guide); keep
 * them as they are. The questions follow the Eyelash Growth clinical protocol.
 *
 * Photos are optional and not asked here. After chemotherapy, Lithos needs the
 * treating physician's clearance as an upload: the sandbox sends a sample
 * letter (src/lib/journey-photos.ts), never a real document.
 *
 * Client-safe: no server imports.
 */

import { DURATIONS } from "./derm";

type Options = readonly (readonly [string, string])[];

export { DURATIONS };

export const LASH_GOALS: Options = [["longer", "Longer"], ["fuller", "Fuller"], ["darker", "Darker"]];

export const LASH_ONSETS: Options = [["gradual", "Gradually, over time"], ["sudden", "Suddenly"]];

export const EYES_AFFECTED: Options = [["both", "Both eyes"], ["one", "One eye"]];

export const EYE_COLORS: Options = [
  ["brown", "Brown"], ["hazel", "Hazel"], ["green", "Green"], ["blue", "Blue"], ["gray", "Gray"], ["mixed", "Mixed"],
];

export const LASH_SERVICES: Options = [["extensions", "Lash extensions"], ["lift", "Lash lift"], ["tinting", "Lash tinting"]];

/** About the lashes and lids: answered "yes" or left unticked. */
export const EYELASH_SCREENING_LIDS: Options = [
  ["patchy_lash_loss", "My lashes fall out in patches"],
  ["eyelid_lump_sore_or_inflammation", "I have a lump, sore, bleeding, crusting, redness or swelling on an eyelid"],
  ["current_eye_infection", "I have an eye infection or pink eye now"],
  ["pulls_out_lashes_or_brows", "I pull out my own lashes or brows"],
  ["hollow_upper_eyelids", "My upper eyelids look hollow or sunken"],
];

/** Eye history that decides whether bimatoprost is safe. */
export const EYELASH_SCREENING_EYES: Options = [
  ["glaucoma_or_high_eye_pressure", "I have glaucoma or high eye pressure"],
  ["prescription_eye_drops", "I use prescription eye drops"],
  ["uveitis_iritis_or_macular_edema", "I've had uveitis, iritis, or swelling at the back of the eye (macular edema)"],
  ["eye_surgery", "I've had eye surgery, including cataract surgery"],
  ["upper_eyelid_surgery_or_fillers", "I've had upper eyelid surgery or eyelid fillers"],
  ["contact_lenses", "I wear contact lenses"],
];

export const EYELASH_SCREENING_HEALTH: Options = [
  ["pregnancy", "I'm pregnant, breastfeeding, or trying to conceive"],
  ["bimatoprost_or_benzalkonium_allergy", "I'm allergic to bimatoprost (Latisse) or benzalkonium chloride"],
  ["alopecia_areata", "I have alopecia areata"],
  ["thyroid_disease", "I have thyroid disease"],
];

export const EYELASH_CONSENT =
  "I understand this medication can permanently darken the colored part of my eye, darken my eyelid skin, may hollow " +
  "the upper eyelid area, and can cause an allergic reaction and eyelash loss.";

// ------------------------------------------------------------------ parsing

type FieldError = { pointer: string; message: string };
type Read = { text: (name: string) => string; all: (name: string) => string[]; checked: (name: string) => boolean };
type Parsed = { ok: true; value: Record<string, unknown> } | { ok: false; errors: FieldError[] };

const pointer = (name: string) => `/intake_form/data/${name}`;
const keys = (options: Options) => options.map(([key]) => key);
const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);
const booleans = (read: Read, options: Options) => Object.fromEntries(keys(options).map((name) => [name, read.checked(name)]));

function oneOf(read: Read, name: string, options: Options, errors: FieldError[], message: string): string {
  const value = read.text(name);
  if (!keys(options).includes(value)) errors.push({ pointer: pointer(name), message });
  return value;
}

export function parseEyelashIntake(read: Read): Parsed {
  const errors: FieldError[] = [];
  const goals = read.all("treatment_goals").filter((v) => keys(LASH_GOALS).includes(v));
  if (goals.length === 0) errors.push({ pointer: pointer("treatment_goals"), message: "Pick at least one goal." });

  // After chemotherapy, Lithos needs whether it's over and the last dose; the
  // clearance letter is attached when the intake is sent.
  const chemotherapy = read.text("chemotherapy_history") === "true";
  const lastDose = read.text("chemotherapy_last_dose_on");
  if (chemotherapy && !/^\d{4}-\d{2}-\d{2}$/.test(lastDose)) {
    errors.push({ pointer: pointer("chemotherapy_last_dose_on"), message: "Enter the date of your last chemotherapy dose." });
  }

  // The protocol makes the consent a condition of treatment: Lithos refuses an intake without it.
  if (read.text("side_effects_consent_attested") !== "true") {
    errors.push({ pointer: pointer("side_effects_consent_attested"), message: "You need to agree to the side effects to continue." });
  }

  const value = {
    treatment_goals: goals,
    condition_duration: oneOf(read, "condition_duration", DURATIONS, errors, "Pick how long your lashes have been short or sparse."),
    lash_loss_onset: oneOf(read, "lash_loss_onset", LASH_ONSETS, errors, "Pick whether it happened gradually or suddenly."),
    eyes_affected: oneOf(read, "eyes_affected", EYES_AFFECTED, errors, "Pick whether it's both eyes or one."),
    eye_color: oneOf(read, "eye_color", EYE_COLORS, errors, "Pick your eye color."),
    ...booleans(read, EYELASH_SCREENING_LIDS),
    ...booleans(read, EYELASH_SCREENING_EYES),
    ...booleans(read, EYELASH_SCREENING_HEALTH),
    chemotherapy_history: chemotherapy,
    ...(chemotherapy ? { chemotherapy_current: read.text("chemotherapy_current") === "true", chemotherapy_last_dose_on: lastDose } : {}),
    // Both required by Lithos; an empty list means none.
    medications_allergies: lines(read.text("medications_allergies")),
    prior_lash_products: lines(read.text("prior_lash_products")),
    lash_cosmetic_services: read.all("lash_cosmetic_services").filter((v) => keys(LASH_SERVICES).includes(v)),
    side_effects_consent_attested: true,
  };
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
}
