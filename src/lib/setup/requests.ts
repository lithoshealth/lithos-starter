/**
 * The exact request bodies the walkthrough sends.
 *
 * Shared by the server actions that send them and the page that shows them, so
 * what the prospect reads is byte-for-byte what went to Lithos — the point of
 * the walkthrough is to learn the calls, and a displayed example that drifted
 * from the real one would teach the wrong thing. Pure: safe to import anywhere.
 */

/** A sample patient. Names, email and phone satisfy the synthetic-data guards. */
export function patientRequest(stamp: string) {
  return {
    external_id: `setup_${stamp}`,
    first_name: "Sample",
    last_name: "Walkthrough",
    date_of_birth: "1978-05-14",
    sex: "female" as const,
    address: { line1: "410 Sample Street", line2: null, city: "Brooklyn", state: "NY", postal_code: "11201" },
    email: `sample.walkthrough+${stamp}@example.com`,
    phone: "+12125550142",
    enrolled_in_government_insurance: false,
    telehealth_consented_at: "<now>",
    identity_verified_at: "<now>",
  };
}

export function carePlanRequest(patientId: string) {
  return { patient_id: patientId, category: "lipid_management" };
}

/**
 * A lipid intake that passes the protocol's shape check, requesting one
 * specific treatment from the partner's own formulary. Requesting a named
 * treatment (rather than "clinician's choice") is what lets the sandbox review
 * approve it with an empty body in the next step.
 */
export function encounterRequest(patientId: string, carePlanId: string, catalogTreatmentId: string) {
  return {
    patient_id: patientId,
    care_plan_id: carePlanId,
    intake_form: {
      data: {
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
    },
    requested_treatments: [{ action: "add", catalog_treatment_id: catalogTreatmentId }],
  };
}

export function webhookEndpointRequest(url: string) {
  return { url };
}

/** Where the walkthrough's integration code lives, per step — shown so the prospect knows what to read. */
export const STEP_SOURCES = {
  connect: "scripts/setup.mjs · src/lib/lithos/auth.ts (token) · src/lib/lithos/client.ts (requests)",
  patient: "src/lib/setup/requests.ts → patientRequest",
  encounter: "src/lib/setup/requests.ts → encounterRequest",
  review: "src/lib/sandbox-review.ts → signOffAsClinician",
  webhook_endpoint: "src/app/setup/actions.ts → registerWebhookAction",
  webhook_received: "src/app/api/webhooks/lithos/route.ts + src/lib/webhooks/signature.ts",
} as const;
