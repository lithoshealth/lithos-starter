import { describe, expect, it } from "vitest";
import { parseEdIntake } from "./ed";

function read(fields: Record<string, string | string[]>, checked: string[] = []) {
  return {
    text: (name: string) => (typeof fields[name] === "string" ? (fields[name] as string) : ""),
    all: (name: string) => (Array.isArray(fields[name]) ? (fields[name] as string[]) : fields[name] ? [fields[name] as string] : []),
    checked: (name: string) => checked.includes(name),
  };
}

const answers = {
  treatment_goals: ["keep_an_erection"],
  condition_duration: "1_to_5_years",
  ed_onset: "gradual",
  erection_consistency: "most_times",
  morning_erections: "true",
  blood_pressure_systolic: "124",
  blood_pressure_diastolic: "78",
  blood_pressure_measured_on: "2026-09-20",
  blood_pressure_setting: "pharmacy",
  climbs_two_flights: "yes",
  heavy_drinking_days_past_year: "0",
  medications_allergies: "Lisinopril 10 mg daily\nPenicillin: hives",
  prior_ed_medications: "",
  nitrate_acknowledgment_attested: "true",
};

describe("parseEdIntake", () => {
  it("builds Lithos's erectile_dysfunction intake, with every screening answer and the required lists", () => {
    const parsed = parseEdIntake(read({ ...answers, related_medications: ["antidepressant"] }, ["alpha_blocker_or_blood_pressure_medications"]));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toMatchObject({
      blood_pressure_systolic: 124,
      blood_pressure_diastolic: 78,
      blood_pressure_measured_on: "2026-09-20",
      morning_erections: true,
      heavy_drinking_days_past_year: 0,
      alpha_blocker_or_blood_pressure_medications: true,
      nitrate_or_poppers_use: false,
      sildenafil_allergy: false,
      low_libido: false,
      related_medications: ["antidepressant"],
      cardiovascular_risk_factors: [],
      medications_allergies: ["Lisinopril 10 mg daily", "Penicillin: hives"],
      prior_ed_medications: [],
      nitrate_acknowledgment_attested: true,
    });
    expect(parsed.value).not.toHaveProperty("pregnancy");
  });

  it("needs the blood pressure, a count of heavy drinking days and the nitrate promise", () => {
    const parsed = parseEdIntake(read({
      ...answers, blood_pressure_systolic: "", blood_pressure_measured_on: "", heavy_drinking_days_past_year: "-1",
      nitrate_acknowledgment_attested: "false",
    }));
    expect(parsed.ok ? [] : parsed.errors.map((e) => e.pointer)).toEqual([
      "/intake_form/data/blood_pressure_measured_on",
      "/intake_form/data/nitrate_acknowledgment_attested",
      "/intake_form/data/blood_pressure_systolic",
      "/intake_form/data/heavy_drinking_days_past_year",
    ]);
  });
});
