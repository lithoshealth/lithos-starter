import { getDb } from "./db";
import { getLithosClient } from "./lithos/client";
import type { CarePlan, Encounter, Inquiry, LabRequisition } from "./lithos/types";

/**
 * Local read models of Lithos clinical state. Lithos owns this state; these
 * tables exist so a dashboard needs no fan-out of API calls and keeps serving
 * if Lithos is unreachable.
 *
 * Written two ways: directly from the responses when Eucardia creates
 * something, and from webhooks by `projectEvent` — which follows the thin-
 * payload contract (an event carries a type and a resource_id; re-read the
 * resource, never trust the payload as state).
 */

type Order = {
  id: string;
  encounter_id: string | null;
  patient_id: string;
  status: string;
  [key: string]: unknown;
};

async function memberIdForPatient(lithosPatientId: string): Promise<string> {
  const sql = getDb();
  const [row] = await sql<{ id: string }[]>`SELECT id FROM members WHERE lithos_patient_id = ${lithosPatientId}`;
  // Unlinked is a real state, not a bug to paper over: a delivery for a patient
  // Eucardia doesn't know is exactly what reconciliation has to surface.
  if (!row) throw new Error(`no member linked to Lithos patient ${lithosPatientId}`);
  return row.id;
}

export async function upsertCarePlan(memberId: string, plan: CarePlan): Promise<void> {
  const sql = getDb();
  const row = {
    lithos_care_plan_id: plan.id,
    member_id: memberId,
    category: plan.category,
    status: plan.status,
    clinician_notes: plan.clinician_notes,
    activated_at: plan.active_at,
    ineligible_at: plan.ineligible_at,
    raw: sql.json(plan as unknown as Parameters<typeof sql.json>[0]),
    synced_at: new Date(),
  };
  await sql`
    INSERT INTO care_plans ${sql(row)}
    ON CONFLICT (lithos_care_plan_id) DO UPDATE SET
      ${sql(row, "status", "clinician_notes", "activated_at", "ineligible_at", "raw", "synced_at")}`;
}

export async function upsertEncounter(memberId: string, encounter: Encounter): Promise<void> {
  const sql = getDb();
  const row = {
    lithos_encounter_id: encounter.id,
    member_id: memberId,
    lithos_care_plan_id: encounter.care_plan_id,
    status: encounter.status,
    encounter_type: encounter.encounter_type,
    escalation_reason: encounter.escalation_reason,
    lithos_created_at: encounter.created_at,
    lithos_updated_at: encounter.updated_at,
    completed_at: encounter.completed_at,
    raw: sql.json(encounter as unknown as Parameters<typeof sql.json>[0]),
    synced_at: new Date(),
  };
  await sql`
    INSERT INTO encounters ${sql(row)}
    ON CONFLICT (lithos_encounter_id) DO UPDATE SET
      ${sql(row, "status", "encounter_type", "escalation_reason", "lithos_updated_at", "completed_at", "raw", "synced_at")}`;
}

export async function upsertOrder(memberId: string, order: Order): Promise<void> {
  const sql = getDb();
  const row = {
    lithos_order_id: order.id,
    member_id: memberId,
    lithos_encounter_id: order.encounter_id,
    status: order.status,
    raw: sql.json(order as unknown as Parameters<typeof sql.json>[0]),
    synced_at: new Date(),
  };
  await sql`
    INSERT INTO orders ${sql(row)}
    ON CONFLICT (lithos_order_id) DO UPDATE SET ${sql(row, "status", "raw", "synced_at")}`;
}

export async function upsertInquiry(memberId: string, inquiry: Inquiry): Promise<void> {
  const sql = getDb();
  // The encounter it's about, if the references name one.
  const encounterRef = (inquiry.references ?? []).find((r) => typeof r.encounter_id === "string" || (typeof r.id === "string" && r.id.startsWith("enc_")));
  const row = {
    lithos_inquiry_id: inquiry.id,
    member_id: memberId,
    lithos_encounter_id: (encounterRef?.encounter_id ?? encounterRef?.id ?? null) as string | null,
    subject: inquiry.subject,
    status: inquiry.status,
    awaiting: inquiry.awaiting,
    closed_reason: inquiry.closed_reason ?? null,
    closed_note: inquiry.closed_note ?? null,
    last_message_at: inquiry.last_message_at,
    raw: sql.json(inquiry as unknown as Parameters<typeof sql.json>[0]),
    synced_at: new Date(),
  };
  await sql`
    INSERT INTO inquiries ${sql(row)}
    ON CONFLICT (lithos_inquiry_id) DO UPDATE SET
      ${sql(row, "status", "awaiting", "closed_reason", "closed_note", "last_message_at", "raw", "synced_at")}`;
}

export async function upsertLabRequisition(memberId: string, req: LabRequisition): Promise<void> {
  const sql = getDb();
  const row = {
    lithos_lab_requisition_id: req.id,
    member_id: memberId,
    lithos_encounter_id: req.encounter_id,
    preset: req.preset,
    status: req.status,
    pdf_status: req.pdf_status,
    download_url: req.download?.url ?? null,
    download_expires_at: req.download?.expires_at ?? null,
    valid_through: req.valid_through,
    raw: sql.json(req as unknown as Parameters<typeof sql.json>[0]),
    synced_at: new Date(),
  };
  await sql`
    INSERT INTO lab_requisitions ${sql(row)}
    ON CONFLICT (lithos_lab_requisition_id) DO UPDATE SET
      ${sql(row, "status", "pdf_status", "download_url", "download_expires_at", "valid_through", "raw", "synced_at")}`;
}

/** A plan for this member still awaiting its initial review — reusable by a re-run, not to be duplicated. */
export async function findOpenInitialCarePlan(memberId: string): Promise<CarePlan | null> {
  const sql = getDb();
  const [row] = await sql<{ raw: CarePlan }[]>`
    SELECT raw FROM care_plans
     WHERE member_id = ${memberId} AND status IN ('pending_review', 'in_review')
     ORDER BY synced_at DESC LIMIT 1`;
  return row?.raw ?? null;
}

/** The encounter already open on a plan, if any — the reason not to create another. */
export async function findOpenEncounter(carePlanId: string): Promise<Encounter | null> {
  const sql = getDb();
  const [row] = await sql<{ raw: Encounter }[]>`
    SELECT raw FROM encounters
     WHERE lithos_care_plan_id = ${carePlanId} AND status IN ('pending_review', 'in_review', 'escalated')
     ORDER BY synced_at DESC LIMIT 1`;
  return row?.raw ?? null;
}

export async function markProcessed(eventId: string, error?: string): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE webhook_events
       SET processed_at = now(), process_error = ${error ?? null}
     WHERE id = ${eventId}`;
}

export type WebhookPayload = { id: string; type: string; resource_id?: string; created_at?: string };

/**
 * Re-read the resource an event names and upsert it. Returns what it did so a
 * caller can log it; throws when the event can't be projected, and the route
 * records that as `process_error` rather than swallowing it.
 */
export async function projectEvent(payload: WebhookPayload): Promise<{ projected: string } | { skipped: string }> {
  const [prefix] = payload.type.split(".");
  const id = payload.resource_id;
  if (!id) return { skipped: "no resource_id" };
  const client = getLithosClient();

  switch (prefix) {
    case "encounter": {
      const encounter = await client.get<Encounter>(`/v1/encounters/${encodeURIComponent(id)}`);
      const memberId = await memberIdForPatient(encounter.patient_id);
      await upsertEncounter(memberId, encounter);
      // An encounter changing is the only signal that its plan changed: a
      // completed review writes prescriptions and adds treatment lines, and no
      // `care_plan.*` event fires for that (there is no `care_plan.updated`).
      // So re-read the plan too — the refills guide says as much ("fetch the
      // full Prescription from the CarePlan read").
      const plan = await client.get<CarePlan>(`/v1/care_plans/${encodeURIComponent(encounter.care_plan_id)}`);
      await upsertCarePlan(memberId, plan);
      return { projected: `encounter ${id} → ${encounter.status} (plan ${plan.status}, ${plan.treatments.length} line${plan.treatments.length === 1 ? "" : "s"})` };
    }
    case "care_plan": {
      const plan = await client.get<CarePlan>(`/v1/care_plans/${encodeURIComponent(id)}`);
      await upsertCarePlan(await memberIdForPatient(plan.patient_id), plan);
      return { projected: `care_plan ${id} → ${plan.status}` };
    }
    case "order": {
      const order = await client.get<Order>(`/v1/orders/${encodeURIComponent(id)}`);
      await upsertOrder(await memberIdForPatient(order.patient_id), order);
      return { projected: `order ${id} → ${order.status}` };
    }
    case "inquiry": {
      const inquiry = await client.get<Inquiry>(`/v1/inquiries/${encodeURIComponent(id)}`);
      await upsertInquiry(await memberIdForPatient(inquiry.patient_id), inquiry);
      return { projected: `inquiry ${id} → ${inquiry.status}/${inquiry.awaiting ?? "—"}` };
    }
    case "lab_requisition": {
      const req = await client.get<LabRequisition>(`/v1/lab_requisitions/${encodeURIComponent(id)}`);
      await upsertLabRequisition(await memberIdForPatient(req.patient_id), req);
      return { projected: `lab_requisition ${id} → ${req.status}/${req.pdf_status}` };
    }
    default:
      // prior_authorization.*, appointment.*, … — recorded, not yet projected.
      return { skipped: `no projection for ${payload.type}` };
  }
}
