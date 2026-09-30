import type { Appointment, CarePlan, Encounter, Inquiry, InquiryMessage, Patient, Prescription } from "@/lib/lithos/types";

/**
 * The patient portal, as the patient sees it: everything here is worked out
 * from what Lithos returns for one patient, read fresh on every visit. Lithos is
 * the clinical record; the portal only decides what to say about it and in what
 * order. Pure functions, so they're tested without a sandbox.
 */

export type Order = {
  id: string;
  encounter_id: string;
  status: "pending" | "processing" | "placed" | "completed" | "canceled";
  created_at: string;
  updated_at: string;
  fulfillment: { status: string | null; carrier: string | null; tracking_number: string | null } | null;
  prescriptions?: Prescription[];
};

/** An encounter as the show endpoint returns it: the list item plus the intake it carried. */
export type PortalEncounter = Encounter & { intake_form?: { data?: Record<string, unknown> } | null };

export type PortalData = {
  patient: Patient;
  carePlans: CarePlan[];
  encounters: PortalEncounter[];
  orders: Order[];
  inquiries: Inquiry[];
  /** Catalog treatment id → the name a patient knows it by. */
  treatmentNames: Record<string, string>;
};

type Person = { first_name?: string | null; last_name?: string | null; credentials?: string | null } | null | undefined;

/** "Dr. Mouaddine" for an MD or DO; otherwise the full name and credentials. */
export function clinicianName(person: Person): string {
  if (!person?.last_name) return "Your clinician";
  const credentials = person.credentials?.toUpperCase();
  if (credentials === "MD" || credentials === "DO") return `Dr. ${person.last_name}`;
  return [person.first_name, person.last_name].filter(Boolean).join(" ") + (credentials ? `, ${credentials}` : "");
}

const newestFirst = <T extends { created_at: string }>(items: T[]) => [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));

// ------------------------------------------------------------------ next step

export type NextStep =
  | { kind: "question"; title: string; detail: string; inquiryId: string }
  | { kind: "book_visit"; title: string; detail: string; encounterId: string }
  | { kind: "visit"; title: string; detail: string; encounterId: string; appointment: Appointment }
  | { kind: "in_review"; title: string; detail: string }
  | { kind: "shipping"; title: string; detail: string }
  | { kind: "not_a_fit"; title: string; detail: string }
  | { kind: "all_set"; title: string; detail: string };

const lastFromCareTeam = (inquiry: Inquiry): InquiryMessage | undefined =>
  [...(inquiry.messages ?? [])].reverse().find((m) => m.sender.type !== "patient");

/**
 * The one thing to put at the top: whatever the patient has to do, and failing
 * that, what's happening. Their own action always comes first — a question left
 * unanswered holds up their care.
 */
export function nextStep(data: PortalData, formatWhen: (iso: string) => string): NextStep {
  const question = newestFirst(data.inquiries).find((i) => i.status === "open" && i.awaiting === "patient");
  if (question) {
    const message = lastFromCareTeam(question);
    return {
      kind: "question",
      title: `${clinicianName(message?.sender)} has a question for you`,
      detail: message?.body ?? question.subject ?? "Your care team is waiting on your answer.",
      inquiryId: question.id,
    };
  }

  const encounters = newestFirst(data.encounters);
  const toBook = encounters.find((e) => e.needs_appointment && e.status !== "canceled" && e.status !== "completed");
  if (toBook) {
    return { kind: "book_visit", title: "Pick a time for your video visit", detail: "Your clinician reviews your request with you, live.", encounterId: toBook.id };
  }

  const visit = upcomingVisit(data);
  if (visit) {
    return {
      kind: "visit",
      title: `Your video visit is ${formatWhen(visit.appointment.starts_at)}`,
      detail: `With ${clinicianName(visit.appointment.clinician)}. You can join ten minutes before.`,
      encounterId: visit.encounterId,
      appointment: visit.appointment,
    };
  }

  const reviewing = encounters.find((e) => e.status === "pending_review" || e.status === "in_review" || e.status === "escalated");
  if (reviewing) {
    return {
      kind: "in_review",
      title: "Your clinician is reviewing your request",
      detail: reviewing.status === "escalated"
        ? "They're taking a closer look, and will follow up with you directly."
        : "A licensed clinician reads your answers against your program. We'll let you know as soon as they decide.",
    };
  }

  const plan = newestFirst(data.carePlans)[0];
  if (plan?.status === "ineligible") {
    return { kind: "not_a_fit", title: "A note from your clinician", detail: plan.clinician_notes ?? "This program isn't the right fit for you right now." };
  }

  const inFlight = newestFirst(data.orders).find((o) => o.status !== "completed" && o.status !== "canceled");
  if (inFlight) {
    const medicine = medications(data).find((m) => m.orderId === inFlight.id)?.name ?? "Your medication";
    return { kind: "shipping", title: `${medicine} is on its way`, detail: delivery(inFlight).detail };
  }

  const refill = medications(data).find((m) => m.refillDueAt);
  return {
    kind: "all_set",
    title: "You're all set",
    detail: refill?.refillDueAt ? `Your next refill check-in is ${formatWhen(refill.refillDueAt)}.` : "Nothing needs you right now.",
  };
}

// ------------------------------------------------------------------ the care path

export type PathStep = { label: string; state: "done" | "current" | "todo" };

/** Each step's name once it's done, and while it's happening. */
const PATH: Array<[done: string, current: string]> = [["Requested", "Requested"], ["Reviewed", "In review"], ["Approved", "Approved"], ["Delivered", "On its way"]];

/** Request → review → plan → delivered, for the newest request. */
export function carePath(data: PortalData): PathStep[] {
  const encounter = newestFirst(data.encounters)[0];
  if (!encounter) return PATH.map(([label]) => ({ label, state: "todo" }));

  const order = newestFirst(data.orders).find((o) => o.encounter_id === encounter.id);
  // How many steps are done. Until the clinician decides, only the request is.
  const reached =
    order?.status === "completed" ? 4
    : encounter.status === "completed" && encounter.care_plan?.status === "active" ? 3
    : encounter.status === "completed" ? 2
    : 1;
  // The step after the last one reached is where things are now.
  return PATH.map(([done, current], index) =>
    index < reached ? { label: done, state: "done" } : index === reached ? { label: current, state: "current" } : { label: done, state: "todo" });
}

// ------------------------------------------------------------------ medications and delivery

export type Medication = {
  name: string;
  strength: string;
  instructions: string;
  daysSupply: number;
  prescriber: string;
  refillDueAt: string | null;
  orderId: string | null;
};

/** What the patient is on now: each active treatment's current prescription. */
export function medications(data: PortalData): Medication[] {
  return data.carePlans.flatMap((plan) =>
    plan.treatments
      .filter((t) => t.status === "active" && t.current_prescription?.active)
      .map((t) => {
        const rx = t.current_prescription!;
        return {
          name: data.treatmentNames[t.catalog_treatment_id] ?? t.catalog_treatment_id,
          strength: rx.strength,
          instructions: rx.instructions,
          daysSupply: rx.days_supply,
          prescriber: clinicianName(rx.written_by as Person),
          refillDueAt: t.refill_due_at,
          orderId: rx.order_id,
        };
      }),
  );
}

/** An order in the patient's words. Tracking shows once the pharmacy ships. */
export function delivery(order: Order): { label: string; detail: string; done: boolean } {
  const shipped = order.fulfillment?.tracking_number
    ? `Shipped${order.fulfillment.carrier ? ` with ${order.fulfillment.carrier}` : ""} · tracking ${order.fulfillment.tracking_number}`
    : null;
  switch (order.status) {
    case "pending":
      return { label: "Sent to the pharmacy", detail: "Your prescription is with the pharmacy.", done: false };
    case "processing":
      return { label: "Being prepared", detail: shipped ?? "The pharmacy is preparing your order.", done: false };
    case "placed":
      return { label: shipped ? "Shipped" : "With the pharmacy", detail: shipped ?? "The pharmacy has your order and will ship it soon.", done: false };
    case "completed":
      return { label: "Delivered", detail: "Your order was delivered.", done: true };
    case "canceled":
      return { label: "Canceled", detail: "This order was canceled.", done: true };
  }
}

export function orderFor(data: PortalData, orderId: string | null): Order | undefined {
  return orderId ? data.orders.find((o) => o.id === orderId) : undefined;
}

// ------------------------------------------------------------------ visits

export function upcomingVisit(data: PortalData): { encounterId: string; appointment: Appointment } | undefined {
  return newestFirst(data.encounters)
    .map((e) => ({ encounterId: e.id, appointment: e.latest_appointment }))
    .find((v): v is { encounterId: string; appointment: Appointment } =>
      Boolean(v.appointment && (v.appointment.status === "scheduled" || v.appointment.status === "in_progress")));
}

// ------------------------------------------------------------------ progress

export type Reading = { value: number; date: string };
export type Progress = { label: string; unit: string; readings: Reading[] };

const KG_TO_LB = 2.20462;

/**
 * The number the program moves, from what the patient reported at each intake:
 * LDL-C for lipid care (with the date of the lab it came from), weight for
 * weight care. Oldest first; one reading per date.
 */
export function progress(data: PortalData, program: string | undefined): Progress | undefined {
  const lipid = program !== "weight_management";
  const readings = new Map<string, number>();
  for (const encounter of data.encounters) {
    const intake = encounter.intake_form?.data ?? {};
    if (lipid && typeof intake.ldl_c === "number") {
      readings.set(String(intake.ldl_c_date ?? encounter.created_at).slice(0, 10), intake.ldl_c);
    } else if (!lipid && typeof intake.weight_kg === "number") {
      readings.set(encounter.created_at.slice(0, 10), Math.round(intake.weight_kg * KG_TO_LB));
    }
  }
  if (readings.size === 0) return undefined;
  return {
    label: lipid ? "LDL-C" : "Weight",
    unit: lipid ? "mg/dL" : "lb",
    readings: [...readings].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

// ------------------------------------------------------------------ messages

/** Conversations with the care team, newest activity first. */
export function conversations(data: PortalData): Inquiry[] {
  return [...data.inquiries].sort((a, b) => (b.last_message_at ?? b.created_at).localeCompare(a.last_message_at ?? a.created_at));
}
