import { getDb, newMemberId } from "./db";
import type { PatientCreate } from "./lithos/types";

export type Member = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | Date;
  sex: "female" | "male";
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  /** Null for someone who came for care without buying a membership. */
  plan: "essential" | "complete" | null;
  status: "active" | "paused" | "canceled";
  joined_at: string;
  coach_name: string | null;
  enrolled_in_government_insurance: boolean | null;
  lithos_patient_id: string | null;
  lithos_linked_at: string | null;
};

export type LabPanel = {
  id: string;
  member_id: string;
  drawn_on: string | Date;
  source: "eucardia" | "lithos" | "external";
  ldl_c: string | null;
  apo_b: string | null;
  lp_a: string | null;
  hdl_c: string | null;
  triglycerides: string | null;
  total_cholesterol: string | null;
  hs_crp: string | null;
  a1c: string | null;
  notes: string | null;
};

export type MemberTarget = {
  id: string;
  member_id: string;
  ldl_c_target: string | null;
  apo_b_target: string | null;
  rationale: string | null;
  set_at: string;
};

export type MemberMedication = {
  id: string;
  member_id: string;
  name: string;
  kind: "lipid_lowering" | "other" | "allergy";
  started_on: string | Date | null;
  stopped_on: string | Date | null;
  notes: string | null;
};

export type CoachNote = {
  id: string;
  member_id: string;
  author: string;
  focus: string;
  occurred_at: string | Date;
  summary: string;
};

/** A member with everything Eucardia knows about them. */
export type MemberRecord = {
  member: Member;
  panels: LabPanel[];      // newest first
  target: MemberTarget | null;
  notes: CoachNote[];      // newest first
  medications: MemberMedication[];
};

export async function listMembers(): Promise<Array<Member & { latest_ldl: string | null; ldl_c_target: string | null; panel_count: number }>> {
  const sql = getDb();
  return sql`
    SELECT m.*,
           (SELECT p.ldl_c FROM lab_panels p WHERE p.member_id = m.id ORDER BY p.drawn_on DESC LIMIT 1) AS latest_ldl,
           t.ldl_c_target,
           (SELECT count(*)::int FROM lab_panels p WHERE p.member_id = m.id) AS panel_count
    FROM members m
    LEFT JOIN LATERAL (
      SELECT ldl_c_target FROM member_targets WHERE member_id = m.id ORDER BY set_at DESC LIMIT 1
    ) t ON true
    ORDER BY m.last_name` as unknown as Promise<Array<Member & { latest_ldl: string | null; ldl_c_target: string | null; panel_count: number }>>;
}

export async function getMemberRecord(memberId: string): Promise<MemberRecord | null> {
  const sql = getDb();
  const [member] = await sql<Member[]>`SELECT * FROM members WHERE id = ${memberId}`;
  if (!member) return null;

  const [panels, targets, notes, medications] = await Promise.all([
    sql<LabPanel[]>`SELECT * FROM lab_panels WHERE member_id = ${memberId} ORDER BY drawn_on DESC`,
    sql<MemberTarget[]>`SELECT * FROM member_targets WHERE member_id = ${memberId} ORDER BY set_at DESC LIMIT 1`,
    sql<CoachNote[]>`SELECT * FROM coach_notes WHERE member_id = ${memberId} ORDER BY occurred_at DESC`,
    sql<MemberMedication[]>`SELECT * FROM member_medications WHERE member_id = ${memberId} ORDER BY kind, name`,
  ]);

  return { member, panels, target: targets[0] ?? null, notes, medications };
}

/**
 * Record the Lithos patient a member was linked to. Separate from creating the
 * patient so a failure after the API call can be replayed without creating a
 * second one — the API rejects a reused `external_id`, which is what makes the
 * retry safe.
 */
/**
 * The person requesting care, in Eucardia's own records — found by email, or
 * added without a membership. One person, one row, whichever door they came in
 * by: a care review now, `/join` later (or the other way round) lands on the
 * same member, and so on the same Lithos patient. Their id is what Lithos gets
 * as `external_id`.
 */
export async function findOrCreateMemberForCare(
  patient: Omit<PatientCreate, "external_id" | "telehealth_consented_at" | "identity_verified_at">,
): Promise<Pick<Member, "id" | "lithos_patient_id">> {
  const sql = getDb();
  const email = patient.email.toLowerCase();
  const [existing] = await sql<Pick<Member, "id" | "lithos_patient_id">[]>`
    SELECT id, lithos_patient_id FROM members WHERE lower(email) = ${email}`;
  if (existing) return existing;
  const [created] = await sql<Pick<Member, "id" | "lithos_patient_id">[]>`
    INSERT INTO members ${sql({
      id: newMemberId(),
      email,
      first_name: patient.first_name,
      last_name: patient.last_name,
      date_of_birth: patient.date_of_birth,
      sex: patient.sex,
      phone: patient.phone,
      address_line1: patient.address.line1,
      address_line2: patient.address.line2 ?? null,
      city: patient.address.city,
      state: patient.address.state,
      postal_code: patient.address.postal_code,
      enrolled_in_government_insurance: patient.enrolled_in_government_insurance,
      plan: null,
      status: "active",
    })}
    ON CONFLICT (email) DO UPDATE SET updated_at = now()
    RETURNING id, lithos_patient_id`;
  return created;
}

export async function linkMemberToLithos(memberId: string, lithosPatientId: string): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE members
       SET lithos_patient_id = ${lithosPatientId},
           lithos_linked_at   = now(),
           updated_at         = now()
     WHERE id = ${memberId}`;
}

/**
 * Record the platform's government-insurance answer on the member.
 *
 * A membership business never had a reason to hold this — it exists only
 * because Lithos excludes Medicare, Medicaid and Tricare for every partner.
 * It is stored rather than passed through so the member is asked once, not at
 * every escalation.
 */
export async function recordGovernmentInsurance(memberId: string, enrolled: boolean): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE members
       SET enrolled_in_government_insurance = ${enrolled},
           updated_at = now()
     WHERE id = ${memberId}`;
}

/** Everything Lithos has told us about a member, from the local projections. */
export type MemberCare = {
  carePlans: Array<{ lithos_care_plan_id: string; status: string; category: string; activated_at: string | null; raw: import("./lithos/types").CarePlan }>;
  encounters: Array<{ lithos_encounter_id: string; lithos_care_plan_id: string | null; status: string; encounter_type: string | null; lithos_created_at: string | null; completed_at: string | null; raw: import("./lithos/types").Encounter }>;
  orders: Array<{ lithos_order_id: string; lithos_encounter_id: string | null; status: string; raw: Record<string, unknown> }>;
  inquiries: Array<{ lithos_inquiry_id: string; lithos_encounter_id: string | null; subject: string | null; status: string; awaiting: string | null; closed_note: string | null; last_message_at: string | null; raw: import("./lithos/types").Inquiry }>;
  labRequisitions: Array<{ lithos_lab_requisition_id: string; preset: string | null; status: string; pdf_status: string | null; download_url: string | null; download_expires_at: string | null; valid_through: string | null }>;
};

export async function getMemberCare(memberId: string): Promise<MemberCare> {
  const sql = getDb();
  const [carePlans, encounters, orders, inquiries, labRequisitions] = await Promise.all([
    sql`SELECT lithos_care_plan_id, status, category, activated_at, raw FROM care_plans WHERE member_id = ${memberId} ORDER BY synced_at DESC`,
    sql`SELECT lithos_encounter_id, lithos_care_plan_id, status, encounter_type, lithos_created_at, completed_at, raw FROM encounters WHERE member_id = ${memberId} ORDER BY lithos_created_at DESC NULLS LAST`,
    sql`SELECT lithos_order_id, lithos_encounter_id, status, raw FROM orders WHERE member_id = ${memberId} ORDER BY synced_at DESC`,
    sql`SELECT lithos_inquiry_id, lithos_encounter_id, subject, status, awaiting, closed_note, last_message_at, raw FROM inquiries WHERE member_id = ${memberId} ORDER BY last_message_at DESC NULLS LAST`,
    sql`SELECT lithos_lab_requisition_id, preset, status, pdf_status, download_url, download_expires_at, valid_through FROM lab_requisitions WHERE member_id = ${memberId} ORDER BY synced_at DESC`,
  ]);
  return { carePlans, encounters, orders, inquiries, labRequisitions } as unknown as MemberCare;
}

export async function findMemberByLithosPatientId(lithosPatientId: string): Promise<Member | null> {
  const sql = getDb();
  const [member] = await sql<Member[]>`SELECT * FROM members WHERE lithos_patient_id = ${lithosPatientId}`;
  return member ?? null;
}
