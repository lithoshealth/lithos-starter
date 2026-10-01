import type { Appointment, CarePlan, Inquiry } from "@/lib/lithos/types";

/**
 * What to tell a patient when Lithos tells this app something happened — or
 * nothing, when it isn't theirs to act on.
 *
 * The messages carry no clinical detail: no medicine, no decision, no message
 * text. Email and SMS aren't secure channels, so they say that something is
 * waiting and link into the app, where the patient is signed in. (A visit's
 * time is the exception — it's a reminder.) That's the usual practice for
 * health brands; keep it when you write your own copy.
 */

export type PatientNotification = {
  subject: string;
  body: string;
  /** A path in the patient app: /portal, /portal/messages. */
  link: string;
};

/** The event, and what this app re-read from Lithos about it (webhooks are thin). */
export type NotificationInput =
  | { type: "inquiry.created" | "inquiry.message_added"; inquiry: Inquiry }
  | { type: "care_plan.active" | "care_plan.ineligible" | "care_plan.refill_due"; plan: CarePlan }
  | { type: "order.placed" | "order.completed" }
  | { type: "appointment.scheduled" | "appointment.rescheduled" | "appointment.canceled"; appointment: Appointment; when: (iso: string) => string }
  | { type: "lab_requisition.issued" };

/** The events that can tell a patient something; every other event stays quiet. */
export const NOTIFYING_EVENTS = new Set<string>([
  "inquiry.created", "inquiry.message_added",
  "care_plan.active", "care_plan.ineligible", "care_plan.refill_due",
  "order.placed", "order.completed",
  "appointment.scheduled", "appointment.rescheduled", "appointment.canceled",
  "lab_requisition.issued",
]);

export function notificationFor(input: NotificationInput, brandName: string): PatientNotification | null {
  const open = `Open your ${brandName} app to see it.`;
  switch (input.type) {
    case "inquiry.created":
    case "inquiry.message_added":
      // Only when the care team wrote and is waiting on the patient — not for
      // the patient's own messages, and not for a conversation that's closed.
      if (input.inquiry.status !== "open" || input.inquiry.awaiting !== "patient") return null;
      return { subject: "You have a new message from your care team", body: `Your care team wrote to you. ${open}`, link: "/portal/messages" };
    case "care_plan.active":
    case "care_plan.ineligible":
      // The same words either way: the outcome is for the app, not the inbox.
      return { subject: "Your clinician has reviewed your request", body: `Your clinician has finished reviewing your request. ${open}`, link: "/portal" };
    case "care_plan.refill_due":
      return { subject: "It's time for your refill check-in", body: `A few questions, then your next supply. ${open}`, link: "/portal" };
    case "order.placed":
      return { subject: "Your order is on its way", body: `The pharmacy has sent your order. ${open}`, link: "/portal" };
    case "order.completed":
      return { subject: "Your order was delivered", body: `Your order has arrived. ${open}`, link: "/portal" };
    case "appointment.scheduled":
      return { subject: "Your video visit is booked", body: `Your video visit is ${input.when(input.appointment.starts_at)}. ${open}`, link: "/portal" };
    case "appointment.rescheduled":
      return { subject: "Your video visit has moved", body: `Your video visit is now ${input.when(input.appointment.starts_at)}. ${open}`, link: "/portal" };
    case "appointment.canceled":
      return { subject: "Your video visit was canceled", body: `You can book another time in the app. ${open}`, link: "/portal" };
    case "lab_requisition.issued":
      return { subject: "Your lab order is ready", body: `Your clinician ordered a blood test. ${open}`, link: "/portal" };
  }
}
