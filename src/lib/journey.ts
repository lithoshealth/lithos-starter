import { LithosApiError } from "./lithos/errors";
import type {
  ApiError,
  CarePlan,
  Encounter,
  EncounterCreate,
  LipidManagementInitialIntake,
  Modality,
  PatientCreate,
} from "./lithos/types";
import type { LithosClient } from "./lithos/client";
import { readModality, type VisitOffer } from "./sync-visits";

/** `connection`: the form was valid, but the app has no Lithos credentials to send it with. */
export type JourneyStage = "validation" | "connection" | "patient" | "care_plan" | "requirements" | "encounter" | "configuration";

export type JourneyState =
  | { status: "idle" }
  | {
      status: "failed";
      stage: JourneyStage;
      httpStatus?: number;
      errors: ApiError[];
      patientId?: string;
      carePlanId?: string;
    }
  /** Lithos wants a live video visit: pick and hold a time, then submit again to create the encounter with it. */
  | { status: "needs_visit"; patientId: string; carePlanId: string; offer?: VisitOffer }
  | { status: "complete"; patientId: string; carePlanId: string; encounterId: string; modality: Modality };

export const INITIAL_JOURNEY_STATE: JourneyState = { status: "idle" };

export type JourneyInput = {
  patient: Omit<PatientCreate, "external_id" | "telehealth_consented_at" | "identity_verified_at">;
  intake: LipidManagementInitialIntake;
  attestationsConfirmed: true;
  resume: { patientId?: string; carePlanId?: string };
  /** The hold the encounter is created with — only for a sync encounter. */
  visit?: { reservationToken: string; idempotencyKey: string };
};

type ParseResult = { ok: true; value: JourneyInput } | { ok: false; errors: ApiError[] };

type IdResponse = { id: string };

const SCREENING_FIELDS = [
  "established_atherosclerotic_cardiovascular_disease",
  "recent_cardiac_condition",
  "drug_hypersensitivity",
  "cirrhosis",
  "severe_hepatic_impairment",
  "severe_renal_impairment",
  "pregnancy",
  "currently_taking_cyclosporine",
] as const;

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function pointerError(pointer: string, message: string): ApiError {
  return { code: "sample_app.invalid_fake_data", message, source: { pointer } };
}

function isSyntheticName(value: string): boolean {
  return /\b(sample|test)\b/i.test(value);
}

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function parseJourneyForm(formData: FormData): ParseResult {
  const firstName = field(formData, "first_name");
  const lastName = field(formData, "last_name");
  const email = field(formData, "email").toLowerCase();
  const phone = field(formData, "phone");
  const dateOfBirth = field(formData, "date_of_birth");
  const sex = field(formData, "sex");
  const governmentInsurance = field(formData, "enrolled_in_government_insurance");
  const ldlC = Number(field(formData, "ldl_c"));
  const ldlCDate = field(formData, "ldl_c_date");
  const indication = field(formData, "indication");
  const familialHypercholesterolemia = field(formData, "familial_hypercholesterolemia");
  const patientId = field(formData, "resume_patient_id") || undefined;
  const carePlanId = field(formData, "resume_care_plan_id") || undefined;
  const reservationToken = field(formData, "reservation_token");
  const idempotencyKey = field(formData, "idempotency_key");
  const errors: ApiError[] = [];

  if (!isSyntheticName(firstName) && !isSyntheticName(lastName)) {
    errors.push(pointerError("/first_name", "Use an obviously fake Sample or Test patient name."));
  }
  if (!/^[^@\s]+@example\.com$/i.test(email)) {
    errors.push(pointerError("/email", "Use an example.com email address."));
  }
  if (!/^\+1\d{3}555\d{4}$/.test(phone)) {
    errors.push(pointerError("/phone", "Use a US +1 phone number in the reserved 555-01xx-style range."));
  }
  if (!isValidIsoDate(dateOfBirth)) errors.push(pointerError("/date_of_birth", "Enter a valid date of birth."));
  if (sex !== "female" && sex !== "male") errors.push(pointerError("/sex", "Select a valid sex."));
  if (governmentInsurance !== "true" && governmentInsurance !== "false") {
    errors.push(pointerError("/enrolled_in_government_insurance", "Explicitly select yes or no."));
  }
  if (formData.get("attestations_confirmed") !== "on") {
    errors.push(pointerError("/attestations", "Confirm both sample attestations before submitting."));
  }
  if (!Number.isFinite(ldlC) || ldlC <= 0) errors.push(pointerError("/intake_form/data/ldl_c", "Enter a positive LDL-C value."));
  if (!isValidIsoDate(ldlCDate)) errors.push(pointerError("/intake_form/data/ldl_c_date", "Enter a valid LDL-C date."));
  if (indication !== "hypercholesterolemia" && indication !== "cardiovascular_risk_reduction") {
    errors.push(pointerError("/intake_form/data/indication", "Select a valid indication."));
  }
  if (!(["none", "heterozygous", "homozygous", "unknown"] as string[]).includes(familialHypercholesterolemia)) {
    errors.push(pointerError("/intake_form/data/familial_hypercholesterolemia", "Select a valid FH status."));
  }
  if (carePlanId && !patientId) {
    errors.push(pointerError("/resume_patient_id", "A care plan retry must retain its patient ID."));
  }

  const requiredAddressFields = ["address_line1", "city", "state", "postal_code"] as const;
  for (const name of requiredAddressFields) {
    if (!field(formData, name)) errors.push(pointerError(`/address/${name.replace("address_", "")}`, "This address field is required."));
  }

  if (errors.length > 0) return { ok: false, errors };

  const screening = Object.fromEntries(
    SCREENING_FIELDS.map((name) => [name, formData.get(name) === "on"]),
  ) as unknown as Pick<LipidManagementInitialIntake, (typeof SCREENING_FIELDS)[number]>;

  return {
    ok: true,
    value: {
      patient: {
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dateOfBirth,
        sex: sex as "female" | "male",
        address: {
          line1: field(formData, "address_line1"),
          line2: field(formData, "address_line2") || null,
          city: field(formData, "city"),
          state: field(formData, "state"),
          postal_code: field(formData, "postal_code"),
        },
        email,
        phone,
        enrolled_in_government_insurance: governmentInsurance === "true",
      },
      intake: {
        indication: indication as LipidManagementInitialIntake["indication"],
        ldl_c: ldlC,
        ldl_c_date: ldlCDate,
        familial_hypercholesterolemia:
          familialHypercholesterolemia as LipidManagementInitialIntake["familial_hypercholesterolemia"],
        ...screening,
      },
      attestationsConfirmed: true,
      resume: { patientId, carePlanId },
      ...(reservationToken && idempotencyKey ? { visit: { reservationToken, idempotencyKey } } : {}),
    },
  };
}

export function buildPatientPayload(input: JourneyInput, now: Date, externalId: string): PatientCreate {
  const attestedAt = now.toISOString();
  return {
    external_id: externalId,
    ...input.patient,
    telehealth_consented_at: attestedAt,
    identity_verified_at: attestedAt,
  };
}

export function buildEncounterPayload(input: JourneyInput, patientId: string, carePlanId: string): EncounterCreate {
  return {
    patient_id: patientId,
    care_plan_id: carePlanId,
    intake_form: { data: input.intake },
    requested_treatments: [{ action: "add" }],
    ...(input.visit ? { reservation_token: input.visit.reservationToken } : {}),
  };
}

function failure(stage: JourneyStage, error: unknown, ids: { patientId?: string; carePlanId?: string }): JourneyState {
  if (error instanceof LithosApiError) {
    return { status: "failed", stage, httpStatus: error.status, errors: error.errors, ...ids };
  }
  return {
    status: "failed",
    stage: "configuration",
    errors: [{ code: "sample_app.integration_error", message: "The sample app could not complete the server-side request." }],
    ...ids,
  };
}

export async function runJourney(
  input: JourneyInput,
  client: LithosClient,
  options: { now?: Date; externalId?: string } = {},
): Promise<JourneyState> {
  let patientId = input.resume.patientId;
  let carePlanId = input.resume.carePlanId;

  if (!patientId) {
    try {
      const patient = await client.post<IdResponse>(
        "/v1/patients",
        buildPatientPayload(input, options.now ?? new Date(), options.externalId ?? `sample-${crypto.randomUUID()}`),
      );
      patientId = patient.id;
    } catch (error) {
      return failure("patient", error, {});
    }
  }

  if (!carePlanId) {
    try {
      const carePlan = await client.post<IdResponse>("/v1/care_plans", {
        patient_id: patientId,
        category: "lipid_management",
      });
      carePlanId = carePlan.id;
    } catch (error) {
      return failure("care_plan", error, { patientId });
    }
  }

  // Asked before the encounter exists, as the sync-visits guide says: the
  // answer depends on the patient's state and whether this is the plan's first
  // encounter, and Lithos keeps those rules.
  let modality: Modality;
  try {
    modality = await readModality(client, patientId, carePlanId);
  } catch (error) {
    return failure("requirements", error, { patientId, carePlanId });
  }

  // A sync encounter can only be created with its first visit, so the patient
  // picks and holds a time first. The hold keeps it while they finish.
  if (modality === "sync" && !input.visit) return { status: "needs_visit", patientId, carePlanId };

  // With a hold, Lithos creates the encounter and books the visit together, or
  // neither. The Idempotency-Key is required with it, and was minted with the
  // hold, so a double submit books once.
  let encounterId: string;
  try {
    const encounter = await client.post<IdResponse>(
      "/v1/encounters",
      buildEncounterPayload(input, patientId, carePlanId),
      input.visit ? { idempotencyKey: input.visit.idempotencyKey } : undefined,
    );
    encounterId = encounter.id;
  } catch (error) {
    return failure("encounter", error, { patientId, carePlanId });
  }

  return { status: "complete", patientId, carePlanId, encounterId, modality };
}


export async function readJourneyStatus(client: LithosClient, encounterId: string): Promise<{ encounter: Encounter; carePlan: CarePlan }> {
  const encounter = await client.get<Encounter>(`/v1/encounters/${encodeURIComponent(encounterId)}`);
  const carePlan = await client.get<CarePlan>(`/v1/care_plans/${encodeURIComponent(encounter.care_plan_id)}`);
  return { encounter, carePlan };
}
