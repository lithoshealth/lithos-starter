/**
 * The dermatology intakes — acne, and hyperpigmentation & photoaging — shared
 * by the patient-facing intake (which asks them) and the journey (which sends
 * them). The field names and values are Lithos's `acne` / `hyperpigmentation_photoaging`
 * initial contracts (the Intake Schemas guide); keep them as they are.
 *
 * Both need photos: three of the face, plus one of the chest or back for acne
 * on the trunk, or a close-up of the main spot for hyperpigmentation. They are
 * uploaded first (`POST /v1/uploads`) and sent as `*_upload_id` fields — see
 * src/lib/lithos/uploads.ts. In the sandbox the app sends sample images
 * (public/samples/), never a photo of a real person.
 *
 * Client-safe: no server imports.
 */

type Options = readonly (readonly [string, string])[];

export const DURATIONS: Options = [
  ["under_3_months", "Less than 3 months"],
  ["3_to_12_months", "3 to 12 months"],
  ["1_to_5_years", "1 to 5 years"],
  ["over_5_years", "More than 5 years"],
];

export const ISOTRETINOIN_USE: Options = [
  ["never", "Never"],
  ["current", "Yes, I take it now"],
  ["stopped_within_1_month", "I stopped in the last month"],
  ["stopped_over_1_month_ago", "I stopped more than a month ago"],
];

// ------------------------------------------------------------------ acne

export const ACNE_AREAS: Options = [
  ["face", "Face"], ["chest", "Chest"], ["back", "Back"], ["shoulders", "Shoulders"], ["neck", "Neck"],
];
export const ACNE_TRUNK = ["chest", "back", "shoulders"];

export const ACNE_LESIONS: Options = [
  ["blackheads_whiteheads", "Blackheads or whiteheads"],
  ["red_bumps", "Red bumps"],
  ["pus_bumps", "Bumps with pus"],
  ["deep_painful_nodules", "Deep, painful lumps"],
];

export const ACNE_SCARRING: Options = [
  ["none", "No scarring"],
  ["past", "Old scars only"],
  ["active", "New scars are still forming"],
];

export const ACNE_IMPACT: Options = [
  ["none", "Not at all"], ["mild", "A little"], ["moderate", "Quite a bit"], ["severe", "A lot"],
];

/** About the acne itself — answered "yes" or left unticked. */
export const ACNE_SCREENING_SKIN: Options = [
  ["rapid_worsening", "It has got much worse quickly"],
  ["severe_nodulocystic_acne", "I have many deep, painful lumps or cysts"],
  ["systemic_symptoms", "I have fever, joint pain or feel unwell along with it"],
  ["menstrual_irregularity_or_excess_hair", "I have irregular periods, or new hair growth on my face or body"],
  ["current_prescription_retinoid", "I use a prescription retinoid now"],
  ["eczema_rosacea_or_broken_skin", "I have eczema, rosacea, or sunburned or broken skin there"],
];

/** Health history that decides which treatments are safe. */
export const ACNE_SCREENING_HEALTH: Options = [
  ["pregnancy", "I'm pregnant, breastfeeding, or planning a pregnancy"],
  ["clindamycin_or_lincomycin_allergy", "I'm allergic to clindamycin or lincomycin"],
  ["tetracycline_allergy", "I'm allergic to a tetracycline antibiotic (doxycycline, minocycline)"],
  ["ibd_diagnosis", "I have ulcerative colitis or Crohn's"],
  ["antibiotic_associated_colitis", "I've had colitis or severe diarrhea after an antibiotic"],
  ["trouble_swallowing_pills", "I have trouble swallowing pills"],
  ["intracranial_hypertension", "I've had raised pressure in the skull (intracranial hypertension)"],
  ["hepatitis_liver_disease", "I have active hepatitis or liver disease"],
];

// ------------------------------------------------------------------ hyperpigmentation & photoaging

export const HP_CONCERNS: Options = [
  ["dark_spots", "Dark spots"],
  ["melasma", "Melasma (patches of darker skin)"],
  ["post_acne_marks", "Marks left by acne"],
  ["uneven_tone", "Uneven skin tone"],
  ["freckles", "Freckles"],
  ["fine_lines", "Fine lines"],
  ["texture", "Rough texture"],
  ["deep_wrinkles_or_sagging", "Deep wrinkles or sagging"],
];

export const HP_AREAS: Options = [["face", "Face"], ["neck", "Neck"], ["hands", "Hands"]];

export const HP_TRIGGERS: Options = [
  ["sun", "The sun"],
  ["pregnancy", "A pregnancy"],
  ["hormonal_contraception", "Hormonal birth control"],
  ["other", "Something else"],
];

export const FITZPATRICK: Options = [
  ["1", "Always burns, never tans"],
  ["2", "Usually burns, tans a little"],
  ["3", "Sometimes burns, tans slowly"],
  ["4", "Rarely burns, tans easily"],
  ["5", "Very rarely burns, tans very easily"],
  ["6", "Never burns"],
];

export const HP_SKIN_CANCER: Options = [
  ["none", "No"],
  ["melanoma", "Yes, melanoma"],
  ["other_skin_cancer", "Yes, another skin cancer"],
];

/** "Do you have a spot that…" — any one ticked means `atypical_spot`, and the ticks are its signs. */
export const HP_ATYPICAL_SIGNS: Options = [
  ["new_or_changing", "Is new or changing"],
  ["irregular_border", "Has an irregular border"],
  ["multiple_colors", "Has several colors"],
  ["raised", "Is raised"],
  ["bleeding", "Bleeds"],
  ["itching", "Itches"],
  ["larger_than_pencil_eraser", "Is larger than a pencil eraser"],
];

export const HP_SCREENING_RECENT: Options = [
  ["hydroquinone_last_2_months", "I've used hydroquinone in the last 2 months"],
  ["hydroquinone_over_4_months_continuous", "I've used hydroquinone for more than 4 months without a break"],
  ["peel_or_laser_last_4_weeks", "I've had a chemical peel or laser treatment in the last 4 weeks"],
  ["current_prescription_retinoid", "I use a prescription retinoid now"],
];

export const HP_SCREENING_HEALTH: Options = [
  ["pregnancy", "I'm pregnant, breastfeeding, or planning a pregnancy"],
  ["sulfite_allergy", "I'm allergic to sulfites"],
  ["family_skin_cancer_history", "Someone in my family has had skin cancer"],
  ["blue_gray_darkening", "My skin turned blue-gray after a lightening cream"],
  ["vitiligo_or_depigmenting_disease", "I have vitiligo or another condition that removes skin color"],
  ["persistent_redness_or_flushing", "My face is often red or flushed"],
  ["eczema_rosacea_or_broken_skin", "I have eczema, rosacea, or sunburned or broken skin there"],
  ["active_acne", "I have acne that needs treatment"],
];

// ------------------------------------------------------------------ photos

export type PhotoField = { field: string; label: string; sample: string };

const FACE: PhotoField[] = [
  { field: "face_front_photo_upload_id", label: "Face, front", sample: "skin-face-front.png" },
  { field: "face_left_photo_upload_id", label: "Face, left side", sample: "skin-face-left.png" },
  { field: "face_right_photo_upload_id", label: "Face, right side", sample: "skin-face-right.png" },
];
export const TRUNK_PHOTO: PhotoField = { field: "trunk_photo_upload_id", label: "Chest, back or shoulders", sample: "skin-trunk.png" };
export const SPOT_PHOTO: PhotoField = { field: "spot_closeup_photo_upload_id", label: "Close-up of the main spot", sample: "skin-closeup.png" };

/** The photos a derm intake needs, given its answers. */
export function photosFor(program: string, data: Record<string, unknown>): PhotoField[] {
  if (program === "acne") {
    const trunk = Array.isArray(data.affected_areas) && data.affected_areas.some((a) => ACNE_TRUNK.includes(String(a)));
    return trunk ? [...FACE, TRUNK_PHOTO] : FACE;
  }
  if (program === "hyperpigmentation_photoaging") return [...FACE, SPOT_PHOTO];
  return [];
}

export const DERM_PROGRAMS = ["acne", "hyperpigmentation_photoaging"];

// ------------------------------------------------------------------ parsing

type FieldError = { pointer: string; message: string };
type Read = { text: (name: string) => string; all: (name: string) => string[]; checked: (name: string) => boolean };
type Parsed = { ok: true; value: Record<string, unknown> } | { ok: false; errors: FieldError[] };

const pointer = (name: string) => `/intake_form/data/${name}`;
const keys = (options: Options) => options.map(([key]) => key);
const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);

function oneOf(read: Read, name: string, options: Options, errors: FieldError[], message: string): string {
  const value = read.text(name);
  if (!keys(options).includes(value)) errors.push({ pointer: pointer(name), message });
  return value;
}

function someOf(read: Read, name: string, options: Options, errors: FieldError[] | null, message: string): string[] {
  const picked = read.all(name).filter((v) => keys(options).includes(v));
  if (errors && picked.length === 0) errors.push({ pointer: pointer(name), message });
  return picked;
}

function yesNo(read: Read, name: string, errors: FieldError[], message: string): boolean {
  const value = read.text(name);
  if (value !== "true" && value !== "false") errors.push({ pointer: pointer(name), message });
  return value === "true";
}

const booleans = (read: Read, options: Options) => Object.fromEntries(keys(options).map((name) => [name, read.checked(name)]));

/** Free-text lists — medicines and allergies, products tried — one per line, left out when empty. */
function freeLists(read: Read) {
  const meds = lines(read.text("medications_allergies"));
  const products = lines(read.text("prior_products"));
  return { ...(meds.length ? { medications_allergies: meds } : {}), ...(products.length ? { prior_products: products } : {}) };
}

export function parseAcneIntake(read: Read): Parsed {
  const errors: FieldError[] = [];
  const courses = Number(read.text("oral_antibiotic_courses") || "0");
  if (!Number.isInteger(courses) || courses < 0) errors.push({ pointer: pointer("oral_antibiotic_courses"), message: "Enter a whole number, 0 or more." });
  const value = {
    affected_areas: someOf(read, "affected_areas", ACNE_AREAS, errors, "Pick at least one area."),
    lesion_types: someOf(read, "lesion_types", ACNE_LESIONS, errors, "Pick at least one kind of spot."),
    condition_duration: oneOf(read, "condition_duration", DURATIONS, errors, "Pick how long you've had it."),
    scarring: oneOf(read, "scarring", ACNE_SCARRING, errors, "Pick an answer about scarring."),
    daily_life_impact: oneOf(read, "daily_life_impact", ACNE_IMPACT, errors, "Pick how much it affects you."),
    isotretinoin_use: oneOf(read, "isotretinoin_use", ISOTRETINOIN_USE, errors, "Pick an answer about isotretinoin."),
    oral_antibiotic_last_3_months: yesNo(read, "oral_antibiotic_last_3_months", errors, "Answer whether you took an antibiotic for acne recently."),
    oral_antibiotic_courses: courses,
    benzoyl_peroxide_attested: yesNo(read, "benzoyl_peroxide_attested", errors, "Answer whether you use a benzoyl peroxide wash."),
    ...booleans(read, ACNE_SCREENING_SKIN),
    ...booleans(read, ACNE_SCREENING_HEALTH),
    ...freeLists(read),
  };
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
}

export function parseHyperpigmentationIntake(read: Read): Parsed {
  const errors: FieldError[] = [];
  const signs = someOf(read, "atypical_spot_signs", HP_ATYPICAL_SIGNS, null, "");
  const value = {
    main_concerns: someOf(read, "main_concerns", HP_CONCERNS, errors, "Pick at least one concern."),
    affected_areas: someOf(read, "affected_areas", HP_AREAS, errors, "Pick at least one area."),
    condition_duration: oneOf(read, "condition_duration", DURATIONS, errors, "Pick how long you've had it."),
    triggers: someOf(read, "triggers", HP_TRIGGERS, null, ""),
    fitzpatrick_skin_type: Number(oneOf(read, "fitzpatrick_skin_type", FITZPATRICK, errors, "Pick how your skin reacts to the sun.")),
    isotretinoin_use: oneOf(read, "isotretinoin_use", ISOTRETINOIN_USE, errors, "Pick an answer about isotretinoin."),
    skin_cancer_history: oneOf(read, "skin_cancer_history", HP_SKIN_CANCER, errors, "Pick an answer about skin cancer."),
    daily_sunscreen_use: yesNo(read, "daily_sunscreen_use", errors, "Answer whether you use sunscreen every day."),
    sunscreen_attested: yesNo(read, "sunscreen_attested", errors, "Answer whether you'll use sunscreen during treatment."),
    atypical_spot: signs.length > 0,
    atypical_spot_signs: signs,
    ...booleans(read, HP_SCREENING_RECENT),
    ...booleans(read, HP_SCREENING_HEALTH),
    ...freeLists(read),
  };
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
}
