import { describe, expect, it } from "vitest";
import { parseGlp1Intake } from "./glp1";

function read(fields: Record<string, string>, checked: string[] = []) {
  return {
    text: (name: string) => fields[name] ?? "",
    all: (name: string) => (fields[name] ? [fields[name]] : []),
    checked: (name: string) => checked.includes(name),
  };
}

const clean = {
  goal: "Appetite and metabolic health",
  height_ft: "5", height_in: "7", weight_lb: "135",
  glp1_ever_used: "false", already_on_glp1: "false", suicidal_thoughts_current: "false",
  medications_allergies: "", prior_weight_loss_meds: "",
};

describe("parseGlp1Intake", () => {
  it("builds Lithos's glp1_microdose intake, with every hard stop answered no", () => {
    const parsed = parseGlp1Intake(read(clean, ["ibd_diagnosis"]), "glp1_microdose");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toMatchObject({
      goal: "Appetite and metabolic health", height_cm: 170, weight_kg: 61.2, glp1_ever_used: false, already_on_glp1: false,
      ibd_diagnosis: true, cancer_treatment_or_steroids: false, recent_wish_to_be_dead: false, suicide_attempt_ever: false,
      medications_allergies: [], prior_weight_loss_meds: [],
    });
    expect(parsed.value).toMatchObject({ pancreatitis_pancreatic_ca: false, drug_hypersensitivity: false, suicidal_thoughts_current: false });
  });

  it("sends the GLP-1 history for a patient on one, and Low Dose has no goal", () => {
    const parsed = parseGlp1Intake(read({
      ...clean, goal: "", glp1_ever_used: "true", already_on_glp1: "true", glp1_current_drug: "tirzepatide",
      glp1_current_dose_mg: "2", glp1_length_of_use_weeks: "8", glp1_last_dose_date: "2026-10-20", glp1_desired_direction: "increase",
    }), "weight_management_low_dose");
    expect(parsed.ok && parsed.value).toMatchObject({
      glp1_current_drug: "tirzepatide", glp1_current_dose_mg: 2, glp1_length_of_use_weeks: 8, glp1_desired_direction: "increase",
    });
    expect(parsed.ok && parsed.value).not.toHaveProperty("goal");
  });

  it("stops on a hard stop or current suicidal thoughts, before anything is sent", () => {
    const pointers = (fields: Record<string, string>, checked: string[] = []) => {
      const parsed = parseGlp1Intake(read({ ...clean, ...fields }, checked), "glp1_microdose");
      return parsed.ok ? [] : parsed.errors.map((e) => e.pointer);
    };
    expect(pointers({}, ["pancreatitis_pancreatic_ca"])).toEqual(["/intake_form/data/pancreatitis_pancreatic_ca"]);
    expect(pointers({ suicidal_thoughts_current: "true" })).toEqual(["/intake_form/data/suicidal_thoughts_current"]);
    // Microdose offers no increase.
    expect(pointers({ already_on_glp1: "true", glp1_current_drug: "semaglutide", glp1_current_dose_mg: "0.2",
      glp1_length_of_use_weeks: "4", glp1_last_dose_date: "2026-10-20", glp1_desired_direction: "increase" }))
      .toEqual(["/intake_form/data/glp1_desired_direction"]);
  });
});
