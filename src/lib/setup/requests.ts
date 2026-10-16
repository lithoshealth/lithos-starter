import { intakeKey, type ProgramKey } from "./programs";
import { WEIGHT_SCREENING_FIELDS } from "../intake/weight";
import { GENERIC_SCREENING } from "../intake/generic";

/**
 * The exact request bodies the walkthrough sends.
 *
 * Shared by the server actions that send them and the page that shows them, so
 * what the prospect reads is byte-for-byte what went to Lithos — the point of
 * the walkthrough is to learn the calls, and a displayed example that drifted
 * from the real one would teach the wrong thing. Pure: safe to import anywhere.
 */

/**
 * A sample patient. Names, email and phone satisfy the synthetic-data guards.
 * `lastName` tells patients apart in a patient list; the walkthrough's is "Walkthrough".
 */
export function patientRequest(stamp: string, lastName = "Walkthrough") {
  return {
    external_id: `setup_${stamp}`,
    first_name: "Sample",
    last_name: lastName,
    date_of_birth: "1978-05-14",
    sex: "female" as const,
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
