import { describe, expect, it } from "vitest";
import { parseBvPartnerIntake } from "./bv-partner";

function read(fields: Record<string, string>, checked: string[] = []) {
  return {
    text: (name: string) => fields[name] ?? "",
    all: () => [],
    checked: (name: string) => checked.includes(name),
  };
}

describe("parseBvPartnerIntake", () => {
  it("builds Lithos's bv_partner_treatment intake", () => {
    const parsed = parseBvPartnerIntake(read(
      { heavy_drinking_days_past_year: "2", medical_history: "Asthma\n\nEczema", allergies: "Penicillin (rash)" },
      ["partner_treated_for_bv", "ongoing_monogamous_relationship", "rash_elsewhere"],
    ));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toMatchObject({
      partner_treated_for_bv: true, ongoing_monogamous_relationship: true, rash_elsewhere: true,
      genital_sores: false, testicular_pain: false, pregnant: false, warfarin: false, busulfan: false,
      heavy_drinking_days_past_year: 2, medical_history: ["Asthma", "Eczema"], current_medications: [], allergies: ["Penicillin (rash)"],
    });
  });

  it("sends a no on the relationship questions rather than refusing it", () => {
    const parsed = parseBvPartnerIntake(read({ heavy_drinking_days_past_year: "0" }));
    expect(parsed.ok && parsed.value.partner_treated_for_bv).toBe(false);
  });

  it("needs the alcohol answer", () => {
    const parsed = parseBvPartnerIntake(read({}));
    expect(parsed.ok ? [] : parsed.errors.map((e) => e.pointer)).toEqual(["/intake_form/data/heavy_drinking_days_past_year"]);
  });
});
