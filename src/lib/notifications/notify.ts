import { getBrand } from "@/lib/app-meta";
import type { LithosClient } from "@/lib/lithos/client";
import type { Appointment, CarePlan, Encounter, Inquiry, Patient } from "@/lib/lithos/types";
import { NOTIFYING_EVENTS, notificationFor, type NotificationInput } from "./messages";
import { getNotifier, type Notifier, type Sent } from "./notifier";

type Event = { id: string; type: string; resource_id?: string };

/**
 * Tell the patient about an event, if it's theirs to know. Webhooks are thin,
 * so this re-reads what the event names, then the patient (for a name and an
 * address); the message itself decides whether there's anything to say.
 */
export async function notifyPatient(
  event: Event,
  client: LithosClient,
  appUrl: string,
  notifier: Notifier = getNotifier(),
): Promise<Sent | { skipped: string }> {
  if (!NOTIFYING_EVENTS.has(event.type)) return { skipped: `${event.type} doesn't notify` };
  const id = event.resource_id;
  if (!id) return { skipped: "no resource_id" };

  const read = await readFor(event.type, id, client);
  const patient = await client.get<Patient>(`/v1/patients/${encodeURIComponent(read.patientId)}`);
  const zone = patient.time_zone ?? "UTC";
  const when = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { timeZone: zone, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });

  const message = notificationFor({ ...read.input, ...(read.input.type.startsWith("appointment.") ? { when } : {}) } as NotificationInput, (await getBrand()).name);
  if (!message) return { skipped: `${event.type}: nothing for the patient to do` };

  return notifier.send({
    eventId: event.id,
    eventType: event.type,
    to: { name: patient.first_name, email: patient.email ?? null, phone: patient.phone ?? null },
    message: { ...message, url: new URL(message.link, appUrl).toString() },
  });
}

async function readFor(type: string, id: string, client: LithosClient): Promise<{ patientId: string; input: Omit<NotificationInput, "when"> }> {
  const path = encodeURIComponent(id);
  const [prefix] = type.split(".");
  switch (prefix) {
    case "inquiry": {
      const inquiry = await client.get<Inquiry>(`/v1/inquiries/${path}`);
      return { patientId: inquiry.patient_id, input: { type, inquiry } as NotificationInput };
    }
    case "care_plan": {
      const plan = await client.get<CarePlan>(`/v1/care_plans/${path}`);
      return { patientId: plan.patient_id, input: { type, plan } as NotificationInput };
    }
    case "order": {
      const order = await client.get<{ patient_id: string }>(`/v1/orders/${path}`);
      return { patientId: order.patient_id, input: { type } as NotificationInput };
    }
    case "appointment": {
      const appointment = await client.get<Appointment>(`/v1/appointments/${path}`);
      const encounter = await client.get<Encounter>(`/v1/encounters/${encodeURIComponent(appointment.encounter_id)}`);
      return { patientId: encounter.patient_id, input: { type, appointment } as NotificationInput };
    }
    case "lab_requisition": {
      const requisition = await client.get<{ patient_id: string }>(`/v1/lab_requisitions/${path}`);
      return { patientId: requisition.patient_id, input: { type } as NotificationInput };
    }
    default:
      throw new Error(`no reader for ${type}`);
  }
}
