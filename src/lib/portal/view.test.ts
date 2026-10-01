import { describe, expect, it } from "vitest";
import type { CarePlan, Inquiry, Patient } from "@/lib/lithos/types";
import { journey } from "./journey";
import { carePath, clinicianName, delivery, greeting, headline, medications, nextStep, progress, type Order, type PortalData, type PortalEncounter } from "./view";

const when = (iso: string) => `at ${iso}`;
const imad = { first_name: "Imad", last_name: "Mouaddine", credentials: "MD" };

function encounter(overrides: Partial<PortalEncounter> = {}): PortalEncounter {
  return {
    id: "enc_1", patient_id: "pat_1", care_plan_id: "cpl_1", encounter_type: "initial", status: "completed",
    escalation_reason: null, created_at: "2026-09-29T20:00:00Z", updated_at: "2026-09-29T20:00:00Z", completed_at: null, canceled_at: null,
    care_plan: { status: "active", category: "lipid_management", clinician_notes: null },
    clinician: null, requested_treatments: [], orders: [], patient_message: null,
    intake_form: { data: { ldl_c: 162, ldl_c_date: "2026-08-20" } },
    ...overrides,
  };
}

function plan(overrides: Partial<CarePlan> = {}): CarePlan {
  return {
    id: "cpl_1", patient_id: "pat_1", category: "lipid_management", status: "active", clinician_notes: null,
    created_at: "2026-09-29T20:00:00Z", updated_at: "2026-09-29T20:00:00Z", active_at: null, ineligible_at: null, clinician: imad,
    treatments: [{
      treatment_id: "thr_1", catalog_treatment_id: "lerochol", status: "active", dosage_id: "dose_1",
      refill_status: "not_eligible", refill_due_at: "2026-10-27T00:00:00Z",
      current_prescription: {
        id: "rx_1", patient_id: "pat_1", encounter_id: "enc_1", order_id: "ord_1", strength: "300 mg/1.2 mL",
        instructions: "Inject once monthly.", quantity: 1, days_supply: 28, active: true, notes: null,
        written_at: "2026-09-29T20:00:00Z", expiration_date: "2027-09-29", catalog_treatment_id: "lerochol", written_by: imad,
      },
    }],
    ...overrides,
  };
}

const order = (overrides: Partial<Order> = {}): Order => ({
  id: "ord_1", encounter_id: "enc_1", status: "pending", created_at: "2026-09-29T20:00:00Z", updated_at: "2026-09-29T20:00:00Z", fulfillment: null, ...overrides,
});

const question: Inquiry = {
  id: "inq_1", patient_id: "pat_1", subject: "A question", status: "open", awaiting: "patient", references: [],
  created_at: "2026-09-30T10:00:00Z", last_message_at: "2026-09-30T10:00:00Z",
  messages: [{ id: "msg_1", body: "Any muscle aches?", sender: { type: "clinician", id: "clin_1", ...imad }, attachments: [], created_at: "2026-09-30T10:00:00Z" }],
};

function data(overrides: Partial<PortalData> = {}): PortalData {
  return {
    patient: { id: "pat_1", first_name: "Sample", last_name: "Walkthrough", time_zone: "America/New_York" } as Patient,
    carePlans: [plan()], encounters: [encounter()], orders: [order()], inquiries: [], catalog: { lerochol: { name: "Lerochol", form: "subcutaneous_injection", presentation: "prefilled_syringe" } },
    ...overrides,
  };
}

describe("nextStep", () => {
  it("puts the care team's unanswered question first, whatever else is going on", () => {
    const step = nextStep(data({ inquiries: [question] }), when);
    expect(step).toMatchObject({ kind: "question", title: "Dr. Mouaddine has a question for you", detail: "Any muscle aches?", inquiryId: "inq_1" });
  });

  it("calls it a reply when the patient started the conversation", () => {
    const answer: Inquiry = {
      ...question,
      messages: [
        { id: "msg_0", body: "Take it with food?", sender: { type: "patient", id: "pat_1" }, attachments: [], created_at: "2026-09-30T09:00:00Z" },
        ...question.messages!,
      ],
    };
    const step = nextStep(data({ inquiries: [answer] }), when);
    expect(step).toMatchObject({ kind: "question", title: "Dr. Mouaddine replied to you", reply: true });
    expect(headline(data({ inquiries: [answer] }), step, when)).toBe("You have a new message from your care team.");
  });

  it("says a clinician is reviewing while the request is open", () => {
    expect(nextStep(data({ encounters: [encounter({ status: "in_review" })], orders: [] }), when).kind).toBe("in_review");
  });

  it("follows the medication while its order is on the way", () => {
    expect(nextStep(data(), when)).toMatchObject({ kind: "shipping", title: "Lerochol is on its way" });
  });

  it("is all set once it's delivered, with the next refill", () => {
    const step = nextStep(data({ orders: [order({ status: "completed" })] }), when);
    expect(step).toMatchObject({ kind: "all_set", detail: "Your next refill check-in is at 2026-10-27T00:00:00Z." });
  });

  it("passes on the clinician's note when the program isn't a fit", () => {
    const step = nextStep(data({ carePlans: [plan({ status: "ineligible", clinician_notes: "Talk to your cardiologist first." })], orders: [] }), when);
    expect(step).toMatchObject({ kind: "not_a_fit", detail: "Talk to your cardiologist first." });
  });
});

describe("carePath", () => {
  it("stands on delivery once the plan is approved and the order is out", () => {
    expect(carePath(data())).toEqual([
      { label: "Requested", state: "done" }, { label: "Reviewed", state: "done" }, { label: "Approved", state: "done" }, { label: "On its way", state: "current" },
    ]);
  });

  it("stands on review while the clinician has it", () => {
    for (const status of ["pending_review", "in_review", "escalated"] as const) {
      expect(carePath(data({ encounters: [encounter({ status })] })).map((s) => `${s.label}:${s.state}`))
        .toEqual(["Requested:done", "In review:current", "Approved:todo", "Delivered:todo"]);
    }
  });
});

describe("medications and delivery", () => {
  it("names the treatment, with the prescription behind it", () => {
    expect(medications(data())).toEqual([{
      name: "Lerochol", strength: "300 mg/1.2 mL", amount: "1 prefilled syringe", instructions: "Inject once monthly.", daysSupply: 28,
      prescriber: "Dr. Mouaddine", writtenAt: "2026-09-29T20:00:00Z", refillDueAt: "2026-10-27T00:00:00Z", refillEligible: false, orderId: "ord_1",
    }]);
  });

  it("shows tracking once the pharmacy ships", () => {
    const shipped = order({
      status: "placed", placed_at: "2026-09-30T15:00:00Z", fulfillment: { status: "shipped", carrier: "UPS", tracking_number: "1Z999" },
      pharmacy: { name: "Walgreens #1234" }, shipping_address: { line1: "410 Sample Street", city: "Brooklyn", state: "NY" },
    });
    expect(delivery(shipped)).toEqual({
      label: "On its way", stage: 3, at: "2026-09-30T15:00:00Z", pharmacy: "Walgreens #1234", to: "Brooklyn, NY", tracking: "UPS · 1Z999",
    });
  });
});

describe("progress", () => {
  it("charts LDL-C from each intake, oldest first, dated by the lab", () => {
    const followUp = encounter({ id: "enc_2", created_at: "2026-12-01T00:00:00Z", intake_form: { data: { ldl_c: 96, ldl_c_date: "2026-11-28" } } });
    expect(progress(data({ encounters: [followUp, encounter()] }), "lipid_management")).toEqual({
      label: "LDL-C", unit: "mg/dL", readings: [{ date: "2026-08-20", value: 162 }, { date: "2026-11-28", value: 96 }],
    });
  });

  it("charts weight in pounds for weight care", () => {
    const weighed = encounter({ intake_form: { data: { weight_kg: 100 } } });
    expect(progress(data({ encounters: [weighed] }), "weight_management")?.readings).toEqual([{ date: "2026-09-29", value: 220 }]);
  });

  it("has nothing to show without a reading", () => {
    expect(progress(data({ encounters: [encounter({ intake_form: null })] }), "lipid_management")).toBeUndefined();
  });
});

describe("clinicianName", () => {
  it("uses Dr. for physicians and credentials otherwise", () => {
    expect(clinicianName(imad)).toBe("Dr. Mouaddine");
    expect(clinicianName({ first_name: "Ana", last_name: "Silva", credentials: "NP" })).toBe("Ana Silva, NP");
    expect(clinicianName(null)).toBe("Your clinician");
  });
});

describe("journey", () => {
  const approved = "2026-09-01T12:00:00Z";
  const now = new Date("2026-09-20T12:00:00Z");

  it("waits for the delivery before the first dose, whatever the calendar says", () => {
    const steps = journey("lipid_management", approved, null, null, now);
    expect(steps.map((s) => `${s.title}:${s.state}`)).toEqual([
      "Your plan is approved:done", "First dose:next", "Two-week check-in:later", "Recheck your LDL-C:later", "Three-month review:later",
    ]);
    expect(steps[1]).toMatchObject({ date: null, detail: "When it arrives. Your coach walks you through it." });
  });

  it("dates the first dose by the delivery, and adds Lithos's refill date", () => {
    const steps = journey("lipid_management", approved, "2026-10-01T00:00:00Z", "2026-09-05T15:00:00Z", now);
    expect(steps.map((s) => `${s.title}:${s.state}`)).toEqual([
      "Your plan is approved:done", "First dose:done", "Two-week check-in:done", "Refill check-in:next", "Recheck your LDL-C:later", "Three-month review:later",
    ]);
  });

  it("has nothing to show before the plan is approved", () => {
    expect(journey("lipid_management", null, null, null, now)).toEqual([]);
  });
});

describe("greeting", () => {
  it("follows the patient's own clock", () => {
    expect(greeting(new Date("2026-09-30T13:00:00Z"), "America/New_York")).toBe("Good morning");
    expect(greeting(new Date("2026-09-30T13:00:00Z"), "Asia/Tokyo")).toBe("Good evening");
  });
});
