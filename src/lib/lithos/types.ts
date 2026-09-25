export type ApiError = {
  code: string;
  message: string;
  source?: {
    pointer?: string;
    parameter?: string;
    header?: string;
  };
  // e.g. `existing_patient_id` on `patient.external_id_in_use` — the documented
  // reconciliation handle. The sample app dropped this.
  meta?: Record<string, unknown>;
};

export type ErrorEnvelope = { errors: ApiError[] };

export type Pagination = {
  next_cursor: string | null;
  has_more: boolean;
};

export type ListResponse<T> = {
  data: T[];
  pagination: Pagination;
};

export type PatientListItem = {
  id: string;
  first_name: string;
  last_name: string;
  created_at: string;
};

export type PatientCreate = {
  external_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  sex: "female" | "male";
  address: {
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postal_code: string;
  };
  email: string;
  phone: string;
  telehealth_consented_at: string;
  identity_verified_at: string;
  enrolled_in_government_insurance: boolean;
};

/** The fields this app reads back. `time_zone` is Lithos's lookup from the ZIP; null when it can't place it. */
export type Patient = Omit<PatientCreate, "external_id"> & {
  id: string;
  external_id: string | null;
  time_zone: string | null;
};

export type LipidManagementInitialIntake = {
  indication: "hypercholesterolemia" | "cardiovascular_risk_reduction";
  ldl_c: number;
  ldl_c_date: string;
  familial_hypercholesterolemia: "none" | "heterozygous" | "homozygous" | "unknown";
  established_atherosclerotic_cardiovascular_disease: boolean;
  recent_cardiac_condition: boolean;
  drug_hypersensitivity: boolean;
  cirrhosis: boolean;
  severe_hepatic_impairment: boolean;
  severe_renal_impairment: boolean;
  pregnancy: boolean;
  currently_taking_cyclosporine: boolean;

  // Optional history the contract accepts for clinician review. The sample app
  // omitted these; they're the only structured route for anything beyond the
  // single LDL-C reading, which matters when a partner arrives with history.
  lab_report_upload_id?: string;
  current_lipid_medications?: string[];
  statin_intolerance?: boolean;
  asian_ancestry?: boolean;
  uncontrolled_hypothyroidism?: boolean;
  statin_interacting_medications?: string[];
  active_liver_disease?: boolean;
  latex_allergy?: boolean;
  medications_allergies?: string[];
};

/**
 * The `follow_up` intake (a treat-to-target recheck on an established plan).
 * The requested action is NOT here — it rides on `requested_treatments`.
 * Extra keys are accepted and stored, as on the initial intake.
 */
export type LipidManagementFollowUpIntake = {
  adherence: "on_schedule" | "missed_doses";
  ldl_c: number;
  ldl_c_date: string;
  familial_hypercholesterolemia_responsive?: "responsive" | "non_responsive" | "not_applicable";
  side_effects?: string[];
  health_changes?: string;
};

/**
 * One line of intent. `add` opens a treatment (a slug is honoured — the
 * patient's choice at intake); `refill` renews the prescription on an existing
 * treatment; `switch` moves it to another catalog treatment. `treatment_id` is
 * the stable key that outlives every prescription.
 */
export type RequestedTreatmentLine =
  | { action: "add"; catalog_treatment_id?: string }
  | { action: "refill"; treatment_id: string }
  | { action: "switch"; treatment_id: string; catalog_treatment_id: string };

export type EncounterCreate = {
  patient_id: string;
  care_plan_id: string;
  intake_form: { data: (LipidManagementInitialIntake | LipidManagementFollowUpIntake) & Record<string, unknown> };
  requested_treatments: RequestedTreatmentLine[];
  /** A hold on the first visit. Required when the requirements say `sync`; Lithos books it with the encounter. */
  reservation_token?: string;
};

export type EncounterStatus = "pending_review" | "in_review" | "escalated" | "completed" | "canceled";

export type Prescription = {
  id: string;
  patient_id: string;
  encounter_id: string;
  order_id: string | null;
  strength: string;
  instructions: string;
  quantity: number;
  days_supply: number;
  active: boolean;
  notes: string | null;
  written_at: string;
  expiration_date: string;
  catalog_treatment_id: string;
  written_by: Record<string, unknown> | null;
};

/** A line on a care plan. `treatment_id` is stable for its whole life. */
export type Treatment = {
  treatment_id: string;
  catalog_treatment_id: string;
  status: "active" | "completed";
  dosage_id: string | null;
  refill_status: "eligible" | "not_eligible" | "pending";
  refill_due_at: string | null;
  current_prescription: Prescription | null;
  clinician_notes?: string | null;
};

/** Who wrote a message. A clinician carries credentials and a picture; a patient just a name. */
export type InquirySender = {
  type: "patient" | "clinician" | string;
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  credentials?: string | null;
  profile_picture_url?: string | null;
};

export type InquiryMessage = {
  id: string;
  body: string;
  sender: InquirySender;
  attachments: unknown[];
  created_at: string;
};

/** A threaded conversation between the member and the care team, on one topic. */
export type Inquiry = {
  id: string;
  patient_id: string;
  subject: string | null;
  status: "open" | "resolved" | "closed";
  awaiting: "patient" | "staff" | null;
  references: Array<Record<string, unknown>>;
  closed_reason?: "auto_closed" | "duplicate" | "cancelled" | "out_of_scope" | "other";
  closed_note?: string | null;
  created_at: string;
  last_message_at: string | null;
  messages?: InquiryMessage[];
};

export type LabRequisition = {
  id: string;
  patient_id: string;
  care_plan_id: string;
  encounter_id: string | null;
  preset: string;
  ordered_items: Array<Record<string, unknown>>;
  diagnosis_codes: string[];
  status: "approved" | "canceled" | "expired";
  pdf_status: string;
  valid_through: string | null;
  download: { url: string; expires_at: string } | null;
  created_at: string;
  updated_at: string;
};

export type EncounterListItem = {
  id: string;
  patient_id: string;
  status: EncounterStatus;
  created_at: string;
};

export type Encounter = EncounterListItem & {
  care_plan_id: string;
  encounter_type: "initial" | "follow_up";
  escalation_reason: string | null;
  updated_at: string;
  completed_at: string | null;
  canceled_at: string | null;
  care_plan: {
    status: "pending_review" | "in_review" | "active" | "ineligible";
    category: string;
    clinician_notes: string | null;
    ineligibility_reason_code?: string;
  };
  clinician: Record<string, unknown> | null;
  requested_treatments: Array<Record<string, unknown>>;
  orders: Array<Record<string, unknown>>;
  patient_message: Record<string, unknown> | null;
  // Sync visits. Absent from the published reference while the feature is hidden.
  modality?: Modality;
  needs_appointment?: boolean;
  latest_appointment?: Appointment | null;
};

export type Modality = "async" | "sync";

export type EncounterRequirements = { requirements: { modality: { value: Modality } } };

export type AppointmentSlot = { starts_at: string; duration_minutes: number; slot_token: string };

export type AppointmentSlotsResponse = {
  slots: AppointmentSlot[];
  reason: "no_licensed_availability" | "no_slots_in_range" | null;
  next_available: string | null;
};

/** Who the patient will meet — a name and a photo, from the hold onward. */
export type ClinicianSummary = { first_name: string; last_name: string; profile_picture_url: string | null };

export type SlotReservation = {
  id: string;
  status: "active" | "consumed" | "released" | "expired";
  patient_id: string;
  care_plan_id: string;
  reservation_token: string;
  clinician: ClinicianSummary;
  rescheduling_appointment_id: string | null;
  starts_at: string;
  duration_minutes: number;
  expires_at: string;
  created_at: string;
  consumed_at: string | null;
  released_at: string | null;
  expired_at: string | null;
};

export type AppointmentStatus = "scheduled" | "in_progress" | "completed" | "patient_no_show" | "clinician_no_show" | "canceled";

export type PatientJoin = {
  status: "provisioning" | "too_early" | "joinable" | "closed";
  opens_at: string | null;
  closes_at: string | null;
  url: string | null;
};

export type Appointment = {
  id: string;
  encounter_id: string;
  status: AppointmentStatus;
  starts_at: string;
  ends_at: string;
  canceled_by: "partner" | "clinician" | "system" | null;
  reason: string | null;
  rescheduled_to_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  patient_no_show_at: string | null;
  clinician_no_show_at: string | null;
  canceled_at: string | null;
  /** Whether cancel and reschedule would still be accepted, on the organization's (or the test) clock. */
  cancelable: boolean;
  /** When the cancellation notice shuts the window; null when not `scheduled` or the org requires no notice. */
  cancellation_closes_at: string | null;
  progress:
    | "not_started"
    | "due"
    | "waiting_for_clinician"
    | "waiting_for_patient"
    | "under_way"
    | "ended"
    | "presumed_ended"
    | "settled";
  clinician: ClinicianSummary;
  patient_join: PatientJoin;
};

export type SandboxTestClock = { id: string; frozen_time: string; created_at: string; updated_at: string };

export type CarePlan = {
  id: string;
  patient_id: string;
  category: string;
  status: "pending_review" | "in_review" | "active" | "ineligible";
  clinician_notes: string | null;
  ineligibility_reason_code?: string;
  created_at: string;
  updated_at: string;
  active_at: string | null;
  ineligible_at: string | null;
  clinician: Record<string, unknown> | null;
  treatments: Treatment[];
};
