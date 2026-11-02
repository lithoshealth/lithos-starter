import { describe, expect, it } from "vitest";
import { parseVaginitisIntake } from "./vaginitis";

function read(fields: Record<string, string | string[]>, checked: string[] = []) {
  return {
    text: (name: string) => (typeof fields[name] === "string" ? (fields[name] as string) : ""),
    all: (name: string) => (Array.isArray(fields[name]) ? (fields[name] as string[]) : fields[name] ? [fields[name] as string] : []),
    checked: (name: string) => checked.includes(name),
  };
}

const classic = {
  odor: "fishy",
  discharge: "thin_gray_or_white",
  vulvovaginal_symptoms: ["itching"],
  symptom_duration_days: "4",
  confirmed_bv_episodes_12_months: "0",
  yeast_episodes_12_months: "1",
  diabetes: "none",
  immune_compromise: "none",
  allergies: "Penicillin (rash)",
};

describe("parseVaginitisIntake", () => {
  it("builds Lithos's vaginitis intake", () => {
    const parsed = parseVaginitisIntake(read(classic, ["sti_exposure", "latex_barrier_use"]));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toMatchObject({
      odor: "fishy", symptom_duration_days: 4, yeast_episodes_12_months: 1, sti_exposure: true, latex_barrier_use: true,
      pregnant: false, severe_pain: false, warfarin: false, allergies: ["Penicillin (rash)"], current_medications: [], prior_products: [],
    });
    for (const optional of ["discharge_other", "ph_result", "prior_diagnosis_details", "most_recent_test_on"]) {
      expect(parsed.value).not.toHaveProperty(optional);
    }
  });

  it("needs the patient's words for an other discharge, and only sends them then", () => {
    const missing = parseVaginitisIntake(read({ ...classic, discharge: "other" }));
    expect(missing.ok ? [] : missing.errors.map((e) => e.pointer)).toEqual(["/intake_form/data/discharge_other"]);
    expect(parseVaginitisIntake(read({ ...classic, discharge: "other", discharge_other: "Watery" }))).toMatchObject({ ok: true, value: { discharge_other: "Watery" } });
    const left = parseVaginitisIntake(read({ ...classic, discharge_other: "Watery" }));
    expect(left.ok && left.value).not.toHaveProperty("discharge_other");
  });

  it("sends the optional pH, and refuses one out of range", () => {
    expect(parseVaginitisIntake(read({ ...classic, ph_result: "4.5" }))).toMatchObject({ ok: true, value: { ph_result: 4.5 } });
    expect(parseVaginitisIntake(read({ ...classic, ph_result: "20" })).ok).toBe(false);
  });
});
