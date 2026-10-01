/**
 * The Lithos API's types, by the names this app uses — each one taken from the
 * OpenAPI spec (openapi/lithos-v1.yaml), generated into ./openapi.d.ts by
 * `npm run api:types`. Nothing here is written by hand, so it can't drift from
 * the API: when the spec changes, regenerate, and the compiler shows every
 * place the change reaches.
 */
import type { components } from "./openapi";

type Schemas = components["schemas"];

// ---------------------------------------------------------------- errors and lists

export type ApiError = Schemas["Error"];
export type ErrorEnvelope = Schemas["ErrorResponse"];
export type Pagination = Schemas["Pagination"];
/** Every list endpoint's shape: a page of `data` and the cursor to the next. */
export type ListResponse<T> = { data: T[]; pagination: Pagination };

// ---------------------------------------------------------------- patients

export type PatientCreate = Schemas["PatientCreate"];
export type Patient = Schemas["Patient"];
/** A row of `GET /v1/patients` — the patient itself. */
export type PatientListItem = Patient;
export type ClinicianSummary = Schemas["ClinicianSummary"];

// ---------------------------------------------------------------- intake

export type LipidManagementInitialIntake = Schemas["LipidManagementInitialIntake"];
export type LipidManagementFollowUpIntake = Schemas["LipidManagementFollowUpIntake"];
export type WeightManagementInitialIntake = Schemas["WeightManagementInitialIntake"];

// ---------------------------------------------------------------- care plans and encounters

export type CarePlan = Schemas["CarePlan"];
/** A line on a care plan. `treatment_id` is stable for its whole life. */
export type Treatment = Schemas["CarePlanTreatmentEntry"];
/** A line of an encounter request: add a treatment, switch one, or refill one. */
export type RequestedTreatmentLine = NonNullable<EncounterCreate["requested_treatments"]>[number];
export type EncounterCreate = Schemas["EncounterCreate"];
export type Encounter = Schemas["Encounter"];
/** A row of `GET /v1/encounters`. */
export type EncounterListItem = Encounter;
export type EncounterStatus = Encounter["status"];
export type Modality = NonNullable<Encounter["modality"]>;
export type EncounterRequirements = Schemas["EncounterRequirements"];

// ---------------------------------------------------------------- prescriptions, orders, labs

export type Prescription = Schemas["Prescription"];
export type Order = Schemas["Order"];
export type LabRequisition = Schemas["LabRequisition"];

// ---------------------------------------------------------------- visits

export type AppointmentSlot = Schemas["AppointmentSlot"];
export type AppointmentSlotsResponse = Schemas["AppointmentSlotsResponse"];
export type SlotReservation = Schemas["SlotReservation"];
export type Appointment = Schemas["Appointment"];
export type AppointmentStatus = Appointment["status"];
export type PatientJoin = Schemas["AppointmentPatientJoin"];

// ---------------------------------------------------------------- messages

export type InquirySender = Schemas["InquirySender"];
export type InquiryMessage = Schemas["InquiryMessage"];
export type Inquiry = Schemas["Inquiry"];

// ---------------------------------------------------------------- sandbox

export type SandboxTestClock = Schemas["SandboxTestClock"];
