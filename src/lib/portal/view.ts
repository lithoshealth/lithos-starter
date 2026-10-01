import type { Appointment, CarePlan, Encounter, Inquiry, InquiryMessage, Patient, Prescription } from "@/lib/lithos/types";

/**
 * The patient portal, as the patient sees it: everything here is worked out
 * from what Lithos returns for one patient, read fresh on every visit. Lithos is
 * the clinical record; the portal only decides what to say about it and in what
 * order. Pure functions, so they're tested without a sandbox.
 */

type Address = { line1?: string; line2?: string | null; city: string; state: string; postal_code?: string };

export type Order = {
  id: string;
  encounter_id: string;
  status: "pending" | "processing" | "placed" | "completed" | "canceled";
  created_at: string;
  updated_at: string;
  processing_at?: string | null;
  placed_at?: string | null;
  completed_at?: string | null;
  canceled_at?: string | null;
  /** The pharmacy that took the order; null until one has. */
  pharmacy?: { name: string; address?: Address | null } | null;
  shipping_address?: Address | null;
  fulfillment: { status: string | null; carrier: string | null; tracking_number: string | null } | null;
  prescriptions?: Prescription[];
};

/** An encounter as the show endpoint returns it: the list item plus the intake it carried. */
export type PortalEncounter = Encounter & { intake_form?: { data?: Record<string, unknown> } | null };

export type Clinician = { first_name?: string | null; last_name?: string | null; credentials?: string | null; profile_picture_url?: string | null } | null | undefined;

export type PortalPatient = Patient & { assigned_clinician?: Clinician };

/** What the catalog says about a treatment, for naming it the way a patient would. */
export type CatalogEntry = { name: string; form?: string | null; presentation?: string | null };

export type PortalData = {
  patient: PortalPatient;
  carePlans: CarePlan[];
  encounters: PortalEncounter[];
  orders: Order[];
  inquiries: Inquiry[];
  catalog: Record<string, CatalogEntry>;
};

/** "Dr. Mouaddine" for an MD or DO; otherwise the full name and credentials. */
export function clinicianName(person: Clinician): string {
  if (!person?.last_name) return "Your clinician";
  const credentials = person.credentials?.toUpperCase();
  if (credentials === "MD" || credentials === "DO") return `Dr. ${person.last_name}`;
  return [person.first_name, person.last_name].filter(Boolean).join(" ") + (credentials ? `, ${credentials}` : "");
}

/** "Imad Mouaddine, MD" — for a card that introduces them. */
export function clinicianFullName(person: Clinician): string {
  if (!person?.last_name) return "Your care team";
  return [person.first_name, person.last_name].filter(Boolean).join(" ") + (person.credentials ? `, ${person.credentials}` : "");
}

const newestFirst = <T extends { created_at: string }>(items: T[]) => [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));

export const newestPlan = (data: PortalData): CarePlan | undefined => newestFirst(data.carePlans)[0];

// ------------------------------------------------------------------ next step

export type NextStep =
  | { kind: "question"; title: string; detail: string; inquiryId: string; reply: boolean }
  | { kind: "book_visit"; title: string; detail: string; encounterId: string }
  | { kind: "visit"; title: string; detail: string; encounterId: string; appointment: Appointment }
  | { kind: "in_review"; title: string; detail: string }
  | { kind: "shipping"; title: string; detail: string }
  | { kind: "not_a_fit"; title: string; detail: string }
  | { kind: "all_set"; title: string; detail: string };

const lastFromCareTeam = (inquiry: Inquiry): InquiryMessage | undefined =>
  [...(inquiry.messages ?? [])].reverse().find((m) => m.sender.type !== "patient");

/** Conversations where the care team is waiting on the patient. */
export function awaitingPatient(data: PortalData): Inquiry[] {
  return newestFirst(data.inquiries).filter((i) => i.status === "open" && i.awaiting === "patient");
}

/**
 * The one thing to put at the top: whatever the patient has to do, and failing
 * that, what's happening. Their own action always comes first — a question left
 * unanswered holds up their care.
 */
export function nextStep(data: PortalData, formatWhen: (iso: string) => string): NextStep {
  const question = awaitingPatient(data)[0];
  if (question) {
    const message = lastFromCareTeam(question);
    // The patient wrote first: what's waiting is an answer to them, not a question.
    const reply = question.messages?.[0]?.sender.type === "patient";
    return {
      kind: "question",
      title: `${clinicianName(message?.sender)} ${reply ? "replied to you" : "has a question for you"}`,
      detail: message?.body ?? question.subject ?? "Your care team is waiting on your answer.",
      inquiryId: question.id,
      reply,
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

  const plan = newestPlan(data);
  if (plan?.status === "ineligible") {
    return { kind: "not_a_fit", title: "A note from your clinician", detail: plan.clinician_notes ?? "This program isn't the right fit for you right now." };
  }

  const inFlight = newestFirst(data.orders).find((o) => o.status !== "completed" && o.status !== "canceled");
  if (inFlight) {
    const medicine = medications(data).find((m) => m.orderId === inFlight.id)?.name ?? "Your medication";
    return { kind: "shipping", title: `${medicine} is on its way`, detail: delivery(inFlight).label };
  }

  const refill = medications(data).find((m) => m.refillDueAt);
  return {
    kind: "all_set",
    title: "You're all set",
    detail: refill?.refillDueAt ? `Your next refill check-in is ${formatWhen(refill.refillDueAt)}.` : "Nothing needs you right now.",
  };
}

/** The line under "Hi Sample" in the header: the state of things, in one sentence. */
export function headline(data: PortalData, step: NextStep, formatDay: (iso: string) => string): string {
  const med = medications(data)[0];
  switch (step.kind) {
    case "question": return step.reply ? "You have a new message from your care team." : "Your clinician has a question for you.";
    case "book_visit": return "Your next step is a short video visit with a clinician.";
    case "visit": return step.title + ".";
    case "in_review": return "A clinician is reviewing your request.";
    case "not_a_fit": return "Your clinician has left you a note.";
    case "shipping": return med ? `Your ${med.name} prescription is active, and on its way.` : "Your prescription is on its way.";
    case "all_set":
      if (!med) return "Welcome back.";
      return med.refillDueAt
        ? `Your ${med.name} prescription is active. Next refill check-in on ${formatDay(med.refillDueAt)}.`
        : `Your ${med.name} prescription is active.`;
  }
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
  return PATH.map(([done, current], index) =>
    index < reached ? { label: done, state: "done" } : index === reached ? { label: current, state: "current" } : { label: done, state: "todo" });
}

// ------------------------------------------------------------------ medications and delivery

export type Medication = {
  name: string;
  strength: string;
  /** "1 prefilled syringe", "30 tablets". */
  amount: string;
  instructions: string;
  daysSupply: number;
  prescriber: string;
  writtenAt: string;
  refillDueAt: string | null;
  refillEligible: boolean;
  orderId: string | null;
};

const PRESENTATION: Record<string, [one: string, many: string]> = {
  tablet: ["tablet", "tablets"], capsule: ["capsule", "capsules"], prefilled_syringe: ["prefilled syringe", "prefilled syringes"],
  auto_injector: ["auto-injector", "auto-injectors"], multidose_pen: ["pen", "pens"], vial: ["vial", "vials"],
};

function amount(quantity: number, presentation: string | null | undefined): string {
  const words = presentation ? PRESENTATION[presentation] ?? [presentation.replace(/_/g, " "), presentation.replace(/_/g, " ")] : null;
  return words ? `${quantity} ${quantity === 1 ? words[0] : words[1]}` : `Quantity ${quantity}`;
}

/** What the patient is on now: each active treatment's current prescription. */
export function medications(data: PortalData): Medication[] {
  return data.carePlans.flatMap((plan) =>
    plan.treatments
      .filter((t) => t.status === "active" && t.current_prescription?.active)
      .map((t) => {
        const rx = t.current_prescription!;
        const entry = data.catalog[t.catalog_treatment_id];
        return {
          name: entry?.name ?? t.catalog_treatment_id,
          strength: rx.strength,
          amount: amount(rx.quantity, entry?.presentation),
          instructions: rx.instructions,
          daysSupply: rx.days_supply,
          prescriber: clinicianName(rx.written_by as Clinician),
          writtenAt: rx.written_at,
          refillDueAt: t.refill_due_at,
          refillEligible: t.refill_status === "eligible",
          orderId: rx.order_id,
        };
      }),
  );
}

export type Delivery = {
  label: string;
  /** 1 at the pharmacy, 2 being prepared, 3 shipped, 4 delivered; 0 canceled. */
  stage: number;
  /** When it reached this stage. */
  at: string;
  pharmacy: string | null;
  /** "Brooklyn, NY" — where it's going. */
  to: string | null;
  tracking: string | null;
};

/** An order in the patient's words. Tracking shows once the pharmacy ships. */
export function delivery(order: Order): Delivery {
  const to = order.shipping_address ? `${order.shipping_address.city}, ${order.shipping_address.state}` : null;
  const tracking = order.fulfillment?.tracking_number
    ? `${order.fulfillment.carrier ? `${order.fulfillment.carrier} · ` : ""}${order.fulfillment.tracking_number}`
    : null;
  const base = { pharmacy: order.pharmacy?.name ?? null, to, tracking };
  switch (order.status) {
    case "pending": return { ...base, label: "Sent to the pharmacy", stage: 1, at: order.created_at };
    case "processing": return { ...base, label: "Being prepared", stage: 2, at: order.processing_at ?? order.updated_at };
    case "placed": return { ...base, label: "On its way", stage: 3, at: order.placed_at ?? order.updated_at };
    case "completed": return { ...base, label: "Delivered", stage: 4, at: order.completed_at ?? order.updated_at };
    case "canceled": return { ...base, label: "Canceled", stage: 0, at: order.canceled_at ?? order.updated_at };
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

/**
 * The conversation the Messages tab opens on: one waiting on the patient, else
 * the latest open one, else the latest. Lithos threads by topic; a chat app
 * shows one conversation at a time.
 */
export function currentThread(data: PortalData): Inquiry | undefined {
  const threads = newestFirst(data.inquiries);
  return awaitingPatient(data)[0] ?? threads.find((t) => t.status === "open") ?? threads[0];
}

/** "Good morning", in the patient's own time zone. */
export function greeting(now: Date, timeZone: string): string {
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone }).format(now));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}
