import { describe, expect, it } from "vitest";
import { parseHsvIntake } from "./hsv";

function read(fields: Record<string, string | string[]>, checked: string[] = []) {
  return {
    text: (name: string) => (typeof fields[name] === "string" ? (fields[name] as string) : ""),
    all: (name: string) => (Array.isArray(fields[name]) ? (fields[name] as string[]) : fields[name] ? [fields[name] as string] : []),
    checked: (name: string) => checked.includes(name),
  };
}

const outbreak = {
  requested_treatment: "cold_sore_outbreak",
  prior_diagnosis_method: "clinician_exam",
  prior_diagnosis_details: "My dentist, 2020",
  sores_onset: "tingling_only",
  episode_description: "Tingling on my upper lip",
  outbreaks_last_12_months: "4",
  outbreak_impact: "mild",
  suppression_goals: ["fewer_outbreaks"],
  new_sexual_exposure_or_sti_symptoms: "false",
  current_medications: "",
  allergies: "Penicillin (rash)",
  antiviral_history: "Valacyclovir 2 g twice, last spring, helped",
};

describe("parseHsvIntake", () => {
  it("builds Lithos's herpes_simplex intake, with the site read off what the patient wants", () => {
    const parsed = parseHsvIntake(read(outbreak, ["kidney_risk_factors"]));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toMatchObject({
      requested_treatment: "cold_sore_outbreak", sore_site: "outer_lip", prior_diagnosis_details: "My dentist, 2020",
      sores_onset: "tingling_only", outbreaks_last_12_months: 4, kidney_risk_factors: true, pregnancy: false,
      eye_symptoms_or_sores_near_eye: false, antiviral_history: ["Valacyclovir 2 g twice, last spring, helped"],
      current_medications: [], allergies: ["Penicillin (rash)"],
    });
    // Suppression goals only go with suppression.
    expect(parsed.value).not.toHaveProperty("suppression_goals");
  });

  it("sends suppression without the outbreak questions", () => {
    const parsed = parseHsvIntake(read({ ...outbreak, requested_treatment: "genital_suppression", sores_onset: "", episode_description: "" }));
    expect(parsed.ok && parsed.value).toMatchObject({ sore_site: "genital", suppression_goals: ["fewer_outbreaks"] });
    expect(parsed.ok && parsed.value).not.toHaveProperty("sores_onset");
  });

  it("needs the diagnosis details, the outbreak and the goals for the mode picked", () => {
    const pointers = (fields: Record<string, string | string[]>) => {
      const parsed = parseHsvIntake(read({ ...outbreak, ...fields }));
      return parsed.ok ? [] : parsed.errors.map((e) => e.pointer);
    };
    expect(pointers({ prior_diagnosis_details: "", episode_description: "" })).toEqual([
      "/intake_form/data/prior_diagnosis_details", "/intake_form/data/episode_description",
    ]);
    expect(pointers({ prior_diagnosis_method: "none", prior_diagnosis_details: "" })).toEqual([]);
    expect(pointers({ requested_treatment: "cold_sore_suppression", suppression_goals: [] })).toEqual(["/intake_form/data/suppression_goals"]);
  });
});
