/**
 * The ringworm intake, shared by the patient-facing intake (which asks it) and
 * the journey (which sends it). The field names and values are Lithos's
 * `dermatophyte_infection` initial contract (the Intake Schemas guide); keep
 * them as they are. The questions follow the Dermatophyte Infection (Ringworm)
 * clinical protocol (v0.3).
 *
 * Each site with a rash needs an overview and a close-up photo, which the
 * journey adds just before it sends the intake (src/lib/journey-photos.ts). A
 * rash only on an area the protocol doesn't treat names no site and needs no
 * photos: Lithos accepts it, and the clinician refers the patient.
 *
 * Client-safe: no server imports.
 */

import { DURATIONS } from "./derm";
import type { PhotoField } from "./derm";
import { PREGNANCY_QUESTIONS } from "./pregnancy";

type Options = readonly (readonly [string, string])[];

export { DURATIONS };

export const RINGWORM_SITES: Options = [
  ["body", "My body"],
  ["groin", "My groin"],
  ["between_toes", "Between my toes"],
  ["soles_and_sides", "The soles or sides of my feet"],
];

export const RINGWORM_EXCLUDED_AREAS: Options = [
  ["scalp", "My scalp"], ["beard", "My beard"], ["nails", "My nails"], ["face", "My face"], ["near_eye", "Near my eye"],
];

export const RINGWORM_SYMPTOMS: Options = [["scaling", "Scaling"], ["itch", "Itching"], ["pain", "Pain"], ["spreading", "It's spreading"]];

export const RINGWORM_EXPOSURES: Options = [
  ["household", "Someone at home has a rash"], ["pet", "A pet with patchy hair loss"], ["gym", "Gym or locker rooms"],
  ["contact_sport", "Contact sports"], ["sexual_skin_contact", "Skin contact during sex"],
];

export const RINGWORM_FINDINGS: Options = [
  ["hair_loss", "Hair loss"], ["nail_changes", "Nail changes"], ["foot_cracks", "Cracks in the skin of my feet"],
  ["groin_or_genital_symptoms", "Groin or genital symptoms"],
];

export const DIABETES: Options = [["none", "No"], ["controlled", "Yes, well controlled"], ["not_controlled", "Yes, not well controlled"]];

export const IMMUNE_COMPROMISE: Options = [
  ["none", "No"],
  ["mild", "Somewhat weakened"],
  ["substantial", "A transplant, chemotherapy, a medicine that weakens my immune system, or HIV"],
];

/** Signs of something a cream won't treat: each one needs an exam, not a prescription. */
export const RINGWORM_SCREENING_URGENT: Options = [
  ["fever", "A fever"],
  ["rapidly_spreading_redness", "Redness or warmth that's spreading quickly"],
  ["marked_tenderness", "The rash is very tender"],
  ["rash_drainage", "Pus or other drainage from the rash"],
  ["deep_painful_lumps", "Deep, painful lumps"],
  ["boggy_scalp_patch", "A painful, boggy patch on my scalp"],
  ["foot_ulcer", "An ulcer on my foot"],
  ["eye_pain", "Eye pain"],
  ["vision_change", "A change in my vision"],
  ["genital_sores", "Ulcers or blisters on my genitals"],
  ["expanding_rash_after_tick_bite", "A rash that keeps growing after a tick bite"],
];

export { PREGNANCY_QUESTIONS };

export const RINGWORM_SCREENING_RASH: Options = [
  ["extensive_rash", "The rash covers a large area"],
  ["deeply_inflamed_rash", "The rash is deeply inflamed"],
  ["spread_after_sexual_contact", "It spread to my genital, buttock or facial skin after sexual contact"],
  ["failed_prior_course", "A full course of an antifungal didn't clear it"],
  ["hard_to_treat_ringworm_exposure", "I've travelled to, or been in contact with, hard-to-treat ringworm"],
  ["steroid_cream_used", "I've used a steroid or steroid-antifungal cream on it"],
  ["genital_area_rash", "It's in my genital area"],
  ["long_lasting_rash", "I've had it for 6 months or longer, continuously or coming back"],
  ["recurring_rash", "It keeps coming back"],
  ["other_unexplained_rash", "I have another unexplained rash elsewhere"],
];

export const RINGWORM_SCREENING_ALLERGIES: Options = [
  ["ketoconazole_allergy", "An allergy to ketoconazole or an ingredient of its cream"],
  ["clotrimazole_allergy", "An allergy to clotrimazole or an ingredient of its cream"],
];

const OVERVIEW = "skin-trunk.png";
const CLOSE_UP = "skin-closeup.png";

/** The two photos of each site named. The field names are Lithos's. */
export function ringwormPhotos(data: Record<string, unknown>): PhotoField[] {
  const sites = Array.isArray(data.affected_areas) ? data.affected_areas.map(String) : [];
  return RINGWORM_SITES.filter(([site]) => sites.includes(site)).flatMap(([site, label]) => [
    { field: `${site}_overview_photo_upload_id`, label: `${label}, overview`, sample: OVERVIEW },
    { field: `${site}_close_up_photo_upload_id`, label: `${label}, close-up`, sample: CLOSE_UP },
  ]);
}

// ------------------------------------------------------------------ parsing

type FieldError = { pointer: string; message: string };
type Read = { text: (name: string) => string; all: (name: string) => string[]; checked: (name: string) => boolean };
type Parsed = { ok: true; value: Record<string, unknown> } | { ok: false; errors: FieldError[] };

const pointer = (name: string) => `/intake_form/data/${name}`;
const keys = (options: Options) => options.map(([key]) => key);
const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);
const booleans = (read: Read, options: Options) => Object.fromEntries(keys(options).map((name) => [name, read.checked(name)]));
const some = (read: Read, name: string, options: Options) => read.all(name).filter((v) => keys(options).includes(v));

function oneOf(read: Read, name: string, options: Options, errors: FieldError[], message: string): string {
  const value = read.text(name);
  if (!keys(options).includes(value)) errors.push({ pointer: pointer(name), message });
  return value;
}

function number(read: Read, name: string, min: number, max: number, errors: FieldError[], message: string): number {
  const raw = read.text(name);
  const value = Number(raw);
  if (raw === "" || !Number.isFinite(value) || value < min || value > max) errors.push({ pointer: pointer(name), message });
  return value;
}

export function parseRingwormIntake(read: Read): Parsed {
  const errors: FieldError[] = [];
  const sites = some(read, "affected_areas", RINGWORM_SITES);
  const excluded = some(read, "excluded_areas", RINGWORM_EXCLUDED_AREAS);
  if (sites.length === 0 && excluded.length === 0) {
    errors.push({ pointer: pointer("affected_areas"), message: "Pick where the rash is." });
  }
  const patches = number(read, "patch_count", 1, 100, errors, "Say how many patches you have, 1 to 100.");
  if (!Number.isInteger(patches)) errors.push({ pointer: pointer("patch_count"), message: "Say how many patches you have, as a whole number." });
  const footWound = read.text("foot_wound");
  if (footWound !== "true" && footWound !== "false") {
    errors.push({ pointer: pointer("foot_wound"), message: "Say whether you have an open wound on a foot." });
  }

  const value = {
    affected_areas: sites,
    excluded_areas: excluded,
    patch_count: patches,
    largest_patch_cm: number(read, "largest_patch_cm", 0.1, 100, errors, "Say about how wide the largest patch is, in centimeters."),
    condition_duration: oneOf(read, "condition_duration", DURATIONS, errors, "Pick how long you've had it."),
    rash_symptoms: some(read, "rash_symptoms", RINGWORM_SYMPTOMS),
    exposures: some(read, "exposures", RINGWORM_EXPOSURES),
    associated_findings: some(read, "associated_findings", RINGWORM_FINDINGS),
    diabetes: oneOf(read, "diabetes", DIABETES, errors, "Say whether you have diabetes."),
    immune_compromise: oneOf(read, "immune_compromise", IMMUNE_COMPROMISE, errors, "Say whether your immune system is weakened."),
    foot_wound: footWound === "true",
    ...booleans(read, RINGWORM_SCREENING_URGENT),
    ...booleans(read, PREGNANCY_QUESTIONS),
    ...booleans(read, RINGWORM_SCREENING_RASH),
    ...booleans(read, RINGWORM_SCREENING_ALLERGIES),
    // All required by Lithos; an empty list means none.
    prior_products: lines(read.text("prior_products")),
    current_medications: lines(read.text("current_medications")),
    allergies: lines(read.text("allergies")),
  };
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
}
