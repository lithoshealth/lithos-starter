import { intakeKey, type ProgramKey } from "./programs";
import { WEIGHT_SCREENING_FIELDS } from "../intake/weight";
import { GENERIC_SCREENING } from "../intake/generic";
import { EYELASH_SCREENING_EYES, EYELASH_SCREENING_HEALTH, EYELASH_SCREENING_LIDS } from "../intake/eyelash";
import { ED_HISTORY, ED_SCREENING_HEALTH, ED_SCREENING_HEART, ED_SCREENING_MEDICINES } from "../intake/ed";
import {
  HAIR_FERTILITY, HAIR_SCREENING_HEALTH, HAIR_SCREENING_MEDICINES, HAIR_SCREENING_MOOD, HAIR_SCREENING_SIGNS,
} from "../intake/hair-loss";
import { GLP1_HARD_STOPS, GLP1_HISTORY, GLP1_SUICIDE_SCREEN } from "../intake/glp1";
import { HSV_SCREENING_EPISODE, HSV_SCREENING_HEALTH, HSV_SCREENING_MEDICINES, HSV_SCREENING_URGENT } from "../intake/hsv";
import {
  B12_SCREENING_ABSORPTION, B12_SCREENING_HEALTH, GLUTATHIONE_SCREENING, NAD_SCREENING, OXYTOCIN_SCREENING_HEALTH,
  OXYTOCIN_SCREENING_MENTAL, OXYTOCIN_SUICIDE_SCREEN, SERMORELIN_SCREENING,
} from "../intake/wellness";

const no = (...lists: readonly (readonly (readonly [string, string])[])[]) =>
  Object.fromEntries(lists.flat().map(([name]) => [name, false]));

/**
 * The exact request bodies the walkthrough sends.
 *
 * Shared by the server actions that send them and the page that shows them, so
 * what the prospect reads is byte-for-byte what went to Lithos — the point of
 * the walkthrough is to learn the calls, and a displayed example that drifted
 * from the real one would teach the wrong thing. Pure: safe to import anywhere.
 */

// Programs that treat men only get a male sample patient.
const MALE_ONLY = new Set<ProgramKey>(["erectile_dysfunction"]);

/**
 * A sample patient. Names, email and phone satisfy the synthetic-data guards.
 * `lastName` tells patients apart in a patient list; the walkthrough's is "Walkthrough".
 */
export function patientRequest(stamp: string, lastName = "Walkthrough", program?: ProgramKey) {
  return {
    external_id: `setup_${stamp}`,
    first_name: "Sample",
    last_name: lastName,
    date_of_birth: "1978-05-14",
    sex: program && MALE_ONLY.has(program) ? ("male" as const) : ("female" as const),
    address: { line1: "410 Sample Street", line2: null, city: "Brooklyn", state: "NY", postal_code: "11201" },
    email: `sample.${lastName.toLowerCase()}+${stamp}@example.com`,
    phone: "+12125550142",
    enrolled_in_government_insurance: false,
    telehealth_consented_at: "<now>",
    identity_verified_at: "<now>",
  };
}

/** `category` is the program chosen in step 2 — Lithos calls it the care plan's category. */
export function carePlanRequest(patientId: string, category: string) {
  return { patient_id: patientId, category };
}

/**
 * A sample intake for each program that passes its protocol's shape check —
 * the fields are the program's, so the intake changes with the program.
 */
const SAMPLE_INTAKE: Record<string, Record<string, unknown>> = {
  lipid_management: {
    indication: "hypercholesterolemia",
    ldl_c: 162,
    ldl_c_date: "2026-08-20",
    familial_hypercholesterolemia: "none",
    established_atherosclerotic_cardiovascular_disease: false,
    recent_cardiac_condition: false,
    drug_hypersensitivity: false,
    cirrhosis: false,
    severe_hepatic_impairment: false,
    severe_renal_impairment: false,
    pregnancy: false,
    currently_taking_cyclosporine: false,
  },
  weight_management: {
    height_cm: 170,
    weight_kg: 98,
    ...Object.fromEntries(WEIGHT_SCREENING_FIELDS.map((name) => [name, false])),
  },
};

/**
 * The dermatology programs. Their photos aren't here: the care request adds
 * them as `*_upload_id` fields just before it sends the intake
 * (src/lib/journey-photos.ts).
 */
function GLP1_SAMPLE(program: string): Record<string, unknown> {
  return {
    height_cm: 170, weight_kg: program === "glp1_microdose" ? 62 : 68,
    ...(program === "glp1_microdose" ? { goal: "Appetite and metabolic health, not weight loss." } : {}),
    ...no(GLP1_HARD_STOPS, GLP1_HISTORY, GLP1_SUICIDE_SCREEN),
    suicidal_thoughts_current: false,
    glp1_ever_used: false, already_on_glp1: false,
    current_medications: [], allergies: [], prior_weight_loss_meds: [],
  };
}

const SAMPLE_DERM_INTAKE: Record<string, Record<string, unknown>> = {
  acne: {
    pregnancy: false,
    affected_areas: ["face"],
    condition_duration: "1_to_5_years",
    lesion_types: ["red_bumps"],
    scarring: "none",
    rapid_worsening: false,
    daily_life_impact: "mild",
    severe_nodulocystic_acne: false,
    systemic_symptoms: false,
    oral_antibiotic_last_3_months: false,
    oral_antibiotic_courses: 0,
    isotretinoin_use: "never",
    current_prescription_retinoid: false,
    eczema_rosacea_or_broken_skin: false,
    clindamycin_or_lincomycin_allergy: false,
    ibd_diagnosis: false,
    antibiotic_associated_colitis: false,
    tetracycline_allergy: false,
    trouble_swallowing_pills: false,
    intracranial_hypertension: false,
    hepatitis_liver_disease: false,
    benzoyl_peroxide_attested: true,
  },
  hyperpigmentation_photoaging: {
    pregnancy: false,
    sulfite_allergy: false,
    main_concerns: ["dark_spots"],
    affected_areas: ["face"],
    condition_duration: "1_to_5_years",
    fitzpatrick_skin_type: 4,
    hydroquinone_last_2_months: false,
    hydroquinone_over_4_months_continuous: false,
    current_prescription_retinoid: false,
    isotretinoin_use: "never",
    peel_or_laser_last_4_weeks: false,
    daily_sunscreen_use: true,
    sunscreen_attested: true,
    atypical_spot: false,
    skin_cancer_history: "none",
    family_skin_cancer_history: false,
    blue_gray_darkening: false,
    eczema_rosacea_or_broken_skin: false,
    vitiligo_or_depigmenting_disease: false,
    persistent_redness_or_flushing: false,
    active_acne: false,
  },
  eyelash_growth: {
    ...Object.fromEntries(
      [...EYELASH_SCREENING_LIDS, ...EYELASH_SCREENING_EYES, ...EYELASH_SCREENING_HEALTH].map(([name]) => [name, false]),
    ),
    treatment_goals: ["longer", "fuller"],
    condition_duration: "1_to_5_years",
    lash_loss_onset: "gradual",
    eyes_affected: "both",
    eye_color: "brown",
    chemotherapy_history: false,
    medications_allergies: [],
    prior_lash_products: [],
    lash_cosmetic_services: [],
    side_effects_consent_attested: true,
  },
  nad_plus: {
    ...no(NAD_SCREENING),
    treatment_goals: ["brain_fog"],
    can_self_administer: true,
  },
  glutathione: {
    ...no(GLUTATHIONE_SCREENING),
    treatment_goals: ["antioxidant_support"],
    cancer_treatment_last_3_years: false,
    can_self_administer: true,
  },
  sermorelin: {
    ...no(SERMORELIN_SCREENING),
    treatment_goals: ["body_composition"],
    height_cm: 178,
    weight_kg: 82,
    interacting_medications: [],
    can_self_administer: true,
  },
  vitamin_b12: {
    ...no(B12_SCREENING_ABSORPTION, B12_SCREENING_HEALTH),
    treatment_goals: ["fatigue"],
    condition_duration: "3_to_12_months",
    cancer_treatment_last_3_years: false,
    can_self_administer: true,
    medications_allergies: [],
  },
  oxytocin: {
    ...no(OXYTOCIN_SUICIDE_SCREEN, OXYTOCIN_SCREENING_MENTAL, OXYTOCIN_SCREENING_HEALTH),
    treatment_goals: ["trouble_falling_asleep"],
    sleep_history: "Bed around 11pm, up at 7am; about 45 minutes to fall asleep; wakes twice most nights.",
    sleep_disorders: [],
    psychiatric_history: "None reported",
    cancer_treatment_last_3_years: false,
    off_label_understanding_attested: true,
  },
  // A reading from a month before the app started: Lithos wants one from the last 6 months.
  erectile_dysfunction: {
    ...no(ED_SCREENING_HEART, ED_SCREENING_MEDICINES, ED_SCREENING_HEALTH, ED_HISTORY),
    blood_pressure_systolic: 124,
    blood_pressure_diastolic: 78,
    blood_pressure_measured_on: new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10),
    blood_pressure_setting: "pharmacy",
    treatment_goals: ["keep_an_erection"],
    condition_duration: "1_to_5_years",
    ed_onset: "gradual",
    erection_consistency: "most_times",
    morning_erections: true,
    climbs_two_flights: "yes",
    cardiovascular_risk_factors: [],
    related_medications: [],
    heavy_drinking_days_past_year: 0,
    medications_allergies: [],
    prior_ed_medications: [],
    nitrate_acknowledgment_attested: true,
  },
  hair_loss: {
    ...no(HAIR_SCREENING_SIGNS, HAIR_SCREENING_MOOD, HAIR_FERTILITY, HAIR_SCREENING_MEDICINES, HAIR_SCREENING_HEALTH),
    treatment_goals: ["slow_the_loss"],
    thinning_areas: ["hairline", "crown"],
    condition_duration: "1_to_5_years",
    thinning_pace: "slow",
    shedding_or_thinning: "thinning",
    family_history: true,
    can_become_pregnant: false,
    reliable_contraception: false,
    medications_allergies: [],
    prior_hair_treatments: [],
    finasteride_12_months_without_stabilization: false,
    finasteride_risks_attested: true,
  },
  // A clean patient who has never used a GLP-1, every hard stop answered no.
  glp1_microdose: GLP1_SAMPLE("glp1_microdose"),
  weight_management_low_dose: GLP1_SAMPLE("weight_management_low_dose"),
  herpes_simplex: {
    ...no(HSV_SCREENING_EPISODE, HSV_SCREENING_URGENT, HSV_SCREENING_HEALTH, HSV_SCREENING_MEDICINES),
    requested_treatment: "genital_outbreak",
    sore_site: "genital",
    prior_diagnosis_method: "clinician_exam",
    prior_diagnosis_details: "Diagnosed by a primary care doctor in 2022",
    prior_diagnosis_unclear: false,
    sores_onset: "tingling_only",
    episode_description: "Tingling since this morning, no sores yet",
    outbreaks_last_12_months: 3,
    outbreak_impact: "moderate",
    new_sexual_exposure_or_sti_symptoms: false,
    antiviral_history: [],
    medications_allergies: [],
  },
};

/** Any other program: the illustrative intake (src/lib/intake/generic.ts). */
const SAMPLE_GENERIC_INTAKE = {
  reason_for_visit: "I'd like to talk to a clinician about treatment options.",
  current_medications: "None",
  allergies: "None known",
  ...Object.fromEntries(GENERIC_SCREENING.map(([name]) => [name, false])),
};

/**
 * The sample intake for the chosen program, requesting one specific treatment
 * from the partner's own formulary. Requesting a named treatment (rather than
 * "clinician's choice") is what lets the sandbox review approve it with an
 * empty body in the next step.
 */
export function encounterRequest(program: ProgramKey, patientId: string, carePlanId: string, catalogTreatmentId: string) {
  return {
    patient_id: patientId,
    care_plan_id: carePlanId,
    intake_form: { data: SAMPLE_INTAKE[intakeKey(program)] ?? SAMPLE_DERM_INTAKE[program] ?? SAMPLE_GENERIC_INTAKE },
    requested_treatments: [{ action: "add", catalog_treatment_id: catalogTreatmentId }],
  };
}

export function webhookEndpointRequest(url: string) {
  return { url };
}

/** Where the walkthrough's integration code lives, per step — shown so the prospect knows what to read. */
export const STEP_SOURCES = {
  connect: "scripts/setup.mjs · src/lib/lithos/auth.ts (token) · src/lib/lithos/client.ts (requests)",
  program: "src/lib/setup/programs.ts",
  patient: "src/lib/journey.ts (the intake) · src/lib/setup/requests.ts → patientRequest, carePlanRequest, encounterRequest (the shortcut)",
  review: "src/lib/sandbox-review.ts → signOffAsClinician",
  updates: "src/app/api/webhooks/lithos/route.ts (receive + verify) · src/lib/setup/steps.ts → checkUpdates (verified deliveries) · src/app/(dev)/setup/actions.ts → registerWebhookAction, sendTestEventAction",
} as const;
