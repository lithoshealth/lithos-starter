/**
 * The HSV intake (cold sores and genital herpes), shared by the
 * patient-facing intake (which asks it) and the journey (which sends it). The
 * field names and values are Lithos's `herpes_simplex` initial contract (the
 * Intake Schemas guide); keep them as they are. The questions follow the HSV
 * (Cold Sores and Genital Herpes) clinical protocol (v0.1).
 *
 * The patient picks one of four things they want, which also says where the
 * sores are, so `sore_site` is read off it rather than asked again: Lithos
 * refuses a site that doesn't match. The outbreak questions are only sent for
 * an outbreak, the suppression goals only for suppression. No photos or labs.
 *
 * Client-safe: no server imports.
 */

type Options = readonly (readonly [string, string])[];

export const HSV_WANTS: Options = [
  ["genital_outbreak", "Treat a genital herpes outbreak now"],
  ["genital_suppression", "A daily medicine to prevent genital outbreaks"],
  ["cold_sore_outbreak", "Treat a cold sore on my lip now"],
  ["cold_sore_suppression", "A daily medicine to prevent cold sores"],
];

const SITE_OF: Record<string, string> = {
  genital_outbreak: "genital", genital_suppression: "genital", cold_sore_outbreak: "outer_lip", cold_sore_suppression: "outer_lip",
};
const OUTBREAK = ["genital_outbreak", "cold_sore_outbreak"];
const SUPPRESSION = ["genital_suppression", "cold_sore_suppression"];

export const HSV_DIAGNOSIS_METHODS: Options = [
  ["clinician_exam", "A clinician examined the sores"],
  ["swab_test", "A swab test of a sore"],
  ["blood_test_only", "A blood test only"],
  ["none", "It's never been diagnosed"],
];

export const HSV_ONSETS: Options = [
  ["tingling_only", "Tingling only, no sores yet"],
  ["sores_within_1_day", "Sores for a day or less"],
  ["sores_over_1_day", "Sores for more than a day"],
];

export const HSV_IMPACTS: Options = [["mild", "A little"], ["moderate", "Quite a bit"], ["severe", "A lot"]];

export const HSV_GOALS: Options = [["fewer_outbreaks", "Fewer outbreaks"], ["partner_protection", "Protecting a partner"]];

/** Signs it may not be the herpes they've had before: each one means an in-person exam. */
export const HSV_SCREENING_EPISODE: Options = [
  ["first_or_uncertain_episode", "This is my first outbreak in this place, or I'm not sure it's herpes"],
  ["new_or_unusual_sore", "This sore is new or unusual for me: a different place, look or course"],
];

export const HSV_SCREENING_URGENT: Options = [
  ["eye_symptoms", "Eye pain, redness, light sensitivity, vision changes, or sores near my eye"],
  ["emergency_symptoms", "Confusion, a seizure, a severe headache with fever or a stiff neck, a widespread rash, or I can't urinate and feel very ill"],
];

export const HSV_SCREENING_HEALTH: Options = [
  ["kidney_disease", "Kidney disease, dialysis, or I've been told a medicine dose must be lowered for my kidneys"],
  ["immunocompromised", "A transplant, chemotherapy or a medicine that weakens my immune system, or HIV"],
  ["pregnancy", "I'm pregnant, might be, or I'm breastfeeding"],
  ["kidney_risk_factors", "I take ibuprofen or naproxen regularly, probenecid or cimetidine, or I'm often dehydrated"],
];

export const HSV_SCREENING_MEDICINES: Options = [
  ["acyclovir_or_valacyclovir_allergy", "A serious allergy to acyclovir or valacyclovir"],
  ["famciclovir_or_penciclovir_allergy", "An allergy to famciclovir or penciclovir"],
  ["breakthrough_on_suppression", "I take a daily antiviral and still get outbreaks"],
];

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

export function parseHsvIntake(read: Read): Parsed {
  const errors: FieldError[] = [];
  const wants = oneOf(read, "requested_treatment", HSV_WANTS, errors, "Pick what you'd like.");
  const method = oneOf(read, "prior_diagnosis_method", HSV_DIAGNOSIS_METHODS, errors, "Pick how it was diagnosed.");
  const details = read.text("prior_diagnosis_details");
  if (method && method !== "none" && !details) {
    errors.push({ pointer: pointer("prior_diagnosis_details"), message: "Say who diagnosed it and when, or the test and its date." });
  }

  const outbreak = OUTBREAK.includes(wants);
  const onset = read.text("sores_onset");
  const episode = read.text("episode_description");
  if (outbreak && !keys(HSV_ONSETS).includes(onset)) errors.push({ pointer: pointer("sores_onset"), message: "Say when this outbreak started." });
  if (outbreak && !episode) errors.push({ pointer: pointer("episode_description"), message: "Say what the sores look like now." });

  const goals = read.all("suppression_goals").filter((v) => keys(HSV_GOALS).includes(v));
  if (SUPPRESSION.includes(wants) && goals.length === 0) {
    errors.push({ pointer: pointer("suppression_goals"), message: "Pick what you'd like the daily medicine to do." });
  }

  const count = Number(read.text("outbreaks_last_12_months"));
  if (!Number.isInteger(count) || count < 0 || read.text("outbreaks_last_12_months") === "") {
    errors.push({ pointer: pointer("outbreaks_last_12_months"), message: "Say how many outbreaks you've had in the last 12 months." });
  }
  const exposure = read.text("new_sexual_exposure_or_sti_symptoms");
  if (exposure !== "true" && exposure !== "false") {
    errors.push({ pointer: pointer("new_sexual_exposure_or_sti_symptoms"), message: "Say whether there's a new partner or other symptoms." });
  }

  const value = {
    requested_treatment: wants,
    sore_site: SITE_OF[wants],
    prior_diagnosis_method: method,
    ...(method !== "none" && details ? { prior_diagnosis_details: details } : {}),
    prior_diagnosis_unclear: read.checked("prior_diagnosis_unclear"),
    ...(outbreak ? { sores_onset: onset, episode_description: episode } : {}),
    outbreaks_last_12_months: count,
    outbreak_impact: oneOf(read, "outbreak_impact", HSV_IMPACTS, errors, "Say how much outbreaks affect you."),
    ...(SUPPRESSION.includes(wants) ? { suppression_goals: goals } : {}),
    ...booleans(read, HSV_SCREENING_EPISODE),
    ...booleans(read, HSV_SCREENING_URGENT),
    ...booleans(read, HSV_SCREENING_HEALTH),
    ...booleans(read, HSV_SCREENING_MEDICINES),
    new_sexual_exposure_or_sti_symptoms: exposure === "true",
    // Both required by Lithos; an empty list means none.
    antiviral_history: lines(read.text("antiviral_history")),
    medications_allergies: lines(read.text("medications_allergies")),
  };
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
}
