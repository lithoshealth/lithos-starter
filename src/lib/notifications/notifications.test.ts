import { describe, expect, it, vi } from "vitest";
import type { LithosClient } from "@/lib/lithos/client";
import type { Inquiry } from "@/lib/lithos/types";
import { notificationFor } from "./messages";
import { OutboxNotifier, ResendNotifier, listOutbox } from "./notifier";
import { notifyPatient } from "./notify";

vi.mock("@/lib/app-meta", () => ({ getBrand: async () => ({ name: "Eucardia Health" }) }));

const inquiry = (overrides: Partial<Inquiry>): Inquiry => ({ id: "inq_1", patient_id: "pat_1", status: "open", awaiting: "patient", ...overrides }) as Inquiry;

describe("notificationFor", () => {
  it("tells the patient when the care team wrote and is waiting on them — and not otherwise", () => {
    expect(notificationFor({ type: "inquiry.message_added", inquiry: inquiry({}) }, "Eucardia Health")).toMatchObject({
      subject: "You have a new message from your care team", link: "/portal/messages",
    });
    expect(notificationFor({ type: "inquiry.message_added", inquiry: inquiry({ awaiting: "staff" }) }, "Eucardia Health")).toBeNull();
    expect(notificationFor({ type: "inquiry.created", inquiry: inquiry({ status: "resolved" }) }, "Eucardia Health")).toBeNull();
  });

  it("says a decision is waiting without saying what it is", () => {
    const approved = notificationFor({ type: "care_plan.active", plan: {} as never }, "Eucardia Health");
    const declined = notificationFor({ type: "care_plan.ineligible", plan: {} as never }, "Eucardia Health");
    expect(approved).toEqual(declined);
    expect(approved?.body).toBe("Your clinician has finished reviewing your request. Open your Eucardia Health app to see it.");
  });

  it("gives a visit's time, in the patient's words", () => {
    const visit = notificationFor({ type: "appointment.scheduled", appointment: { starts_at: "2026-10-08T19:00:00Z" } as never, when: () => "Thursday, October 8 at 3:00 PM EDT" }, "Eucardia Health");
    expect(visit?.body).toContain("Your video visit is Thursday, October 8 at 3:00 PM EDT.");
  });
});

describe("notifiers", () => {
  const outgoing = {
    eventId: "evt_1", eventType: "order.placed",
    to: { name: "Sample", email: "sample@example.com", phone: null },
    message: { subject: "Your order is on its way", body: "The pharmacy has sent your order.", link: "/portal", url: "https://app.test/portal" },
  };

  it("keeps what would have been sent in the outbox, newest first", async () => {
    await new OutboxNotifier().send(outgoing);
    expect(listOutbox()[0]).toMatchObject({ eventId: "evt_1", via: "outbox" });
  });

  it("emails through Resend, and records a failure rather than throwing", async () => {
    const ok = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    expect(await new ResendNotifier("re_key", "care@app.test", ok).send(outgoing)).toMatchObject({ via: "email" });
    expect(JSON.parse(ok.mock.calls[0][1].body)).toMatchObject({ to: ["sample@example.com"], subject: "Your order is on its way" });

    const refused = vi.fn().mockResolvedValue(new Response("{}", { status: 422 }));
    expect(await new ResendNotifier("re_key", "care@app.test", refused).send(outgoing)).toMatchObject({ error: "Resend answered 422" });
  });
});

describe("notifyPatient", () => {
  it("re-reads the order and the patient, then tells them, with a link into the app", async () => {
    const get = vi.fn(async (path: string) =>
      path.startsWith("/v1/orders/") ? { id: "ord_1", patient_id: "pat_1" } : { id: "pat_1", first_name: "Sample", email: "sample@example.com", phone: "+12125550142", time_zone: "America/New_York" });
    const send = vi.fn(async (o) => ({ ...o, at: "now", via: "outbox" as const }));
    const result = await notifyPatient({ id: "evt_1", type: "order.placed", resource_id: "ord_1" }, { get } as unknown as LithosClient, "https://app.test", { send });
    expect(get.mock.calls.map((c) => c[0])).toEqual(["/v1/orders/ord_1", "/v1/patients/pat_1"]);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      to: { name: "Sample", email: "sample@example.com", phone: "+12125550142" },
      message: expect.objectContaining({ subject: "Your order is on its way", url: "https://app.test/portal" }),
    }));
    expect(result).toMatchObject({ via: "outbox" });
  });

  it("stays quiet for events that aren't the patient's — without reading anything", async () => {
    const get = vi.fn();
    expect(await notifyPatient({ id: "evt_2", type: "encounter.in_review", resource_id: "enc_1" }, { get } as unknown as LithosClient, "https://app.test")).toEqual({ skipped: "encounter.in_review doesn't notify" });
    expect(get).not.toHaveBeenCalled();
  });
});
