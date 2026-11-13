import { describe, expect, it } from "vitest";
import { parseUtiIntake } from "./uti";
import { parseSinusitisIntake } from "./sinusitis";
import { parsePinkEyeIntake } from "./pink-eye";
import { parseTrtIntake } from "./trt";
import { parseHrtIntake } from "./hrt";

function read(fields: Record<string, string | string[]>, checked: string[] = []) {
  return {
    text: (name: string) => (typeof fields[name] === "string" ? (fields[name] as string) : ""),
    all: (name: string) => (Array.isArray(fields[name]) ? (fields[name] as string[]) : []),
    checked: (name: string) => checked.includes(name),
  };
}
const pointers = (parsed: { ok: boolean; errors?: { pointer: string }[] }) =>
  parsed.ok ? [] : (parsed as { errors: { pointer: string }[] }).errors.map((e) => e.pointer.replace("/intake_form/data/", ""));
const bp = { blood_pressure_systolic: "122", blood_pressure_diastolic: "78", blood_pressure_measured_on: "2026-10-14", blood_pressure_setting: "home" };
const body = { height_ft: "5", height_in: "10", weight_lb: "180" };

describe("parseUtiIntake", () => {
  const answers = { urinary_symptoms: ["painful_urination", "bogus"], pelvic_pain: "none", symptoms_started_on: "2026-11-12", utis_last_6_months: "0", utis_last_12_months: "1", diabetes: "none" };

  it("builds Lithos's urinary_tract_infection intake, every yes/no sent", () => {
    const parsed = parseUtiIntake(read(answers, ["flank_pain"]));
    expect(parsed.ok && parsed.value).toMatchObject({
      urinary_symptoms: ["painful_urination"], flank_pain: true, fever: false, pregnant: false, sulfa_allergy: false,
      nausea: false, kidney_disease: false, utis_last_12_months: 1, current_medications: [], allergies: [],
    });
    expect(parsed.ok && "systemic_steroid_details" in parsed.value).toBe(false);
  });

  it("needs the steroid details only with steroids, and 12 months at least 6", () => {
    expect(pointers(parseUtiIntake(read({ ...answers, utis_last_6_months: "2" }, ["systemic_steroids"]))))
      .toEqual(["utis_last_12_months", "systemic_steroid_details"]);
  });
});

describe("parseSinusitisIntake", () => {
  const answers = { sinus_symptoms: ["nasal_blockage"], symptoms_started_on: "2026-11-01", episodes_last_12_months: "0", failed_antibiotic_courses: "0" };

  it("sends the day it got worse only when it did", () => {
    const plain = parseSinusitisIntake(read(answers));
    expect(plain.ok && "worsened_on_day" in plain.value).toBe(false);
    const worse = parseSinusitisIntake(read({ ...answers, worsened_on_day: "6" }, ["worsened_after_improving"]));
    expect(worse.ok && worse.value).toMatchObject({ worsened_after_improving: true, worsened_on_day: 6, stiff_neck: false });
    expect(pointers(parseSinusitisIntake(read(answers, ["worsened_after_improving"])))).toEqual(["worsened_on_day"]);
  });
});

describe("parsePinkEyeIntake", () => {
  const answers = { affected_eyes: "right", symptoms_started_on: "2026-11-12", eye_discharge: "thick_pus", eye_pain: "none", light_sensitivity: "none" };

  it("builds Lithos's conjunctivitis intake with no photos", () => {
    const parsed = parsePinkEyeIntake(read({ ...answers, treatments_tried: "Warm compresses" }));
    expect(parsed.ok && parsed.value).toMatchObject({ affected_eyes: "right", eye_injury: false, treatments_tried: ["Warm compresses"] });
    expect(parsed.ok && Object.keys(parsed.value).some((k) => k.endsWith("_upload_id"))).toBe(false);
  });

  it("asks the follow-on answers only after a yes", () => {
    expect(pointers(parsePinkEyeIntake(read(answers, ["contact_lenses"])))).toEqual(["contact_lenses_overnight"]);
    const parsed = parsePinkEyeIntake(read({ ...answers, contact_lenses_overnight: "false" }, ["contact_lenses"]));
    expect(parsed.ok && parsed.value.contact_lenses_overnight).toBe(false);
  });
});

describe("parseTrtIntake", () => {
  it("builds Lithos's testosterone_replacement intake", () => {
    const parsed = parseTrtIntake(read({ ...bp, ...body, symptoms: ["fatigue"], condition_duration: "1_to_5_years" }, ["diabetes"]));
    expect(parsed.ok && parsed.value).toMatchObject({
      symptoms: ["fatigue"], diabetes: true, prostate_cancer: false, current_testosterone_other_prescriber: false,
      height_cm: 178, blood_pressure_systolic: 122, blood_pressure_setting: "home", prior_testosterone_tests: [],
    });
  });

  it("needs a symptom and a blood pressure", () => {
    expect(pointers(parseTrtIntake(read({ ...body, condition_duration: "1_to_5_years" }))))
      .toEqual(["symptoms", "blood_pressure_systolic", "blood_pressure_diastolic", "blood_pressure_measured_on", "blood_pressure_setting"]);
  });
});

describe("parseHrtIntake", () => {
  const answers = {
    ...bp, ...body, main_goal: "hot_flashes_night_sweats", symptoms: ["hot_flashes"], symptom_severity: "moderate",
    condition_duration: "1_to_5_years", cycle_pattern: "no_periods", contraception: ["none"],
  };

  it("builds Lithos's menopausal_hormone_therapy intake, leaving out what doesn't apply", () => {
    const parsed = parseHrtIntake(read({ ...answers, last_mammogram_on: "2026-05-01" }));
    expect(parsed.ok && parsed.value).toMatchObject({ pregnant: false, breast_cancer: false, contraception: ["none"], last_mammogram_on: "2026-05-01" });
    expect(parsed.ok && Object.keys(parsed.value)).not.toContain("blood_in_urine");
    expect(parsed.ok && Object.keys(parsed.value)).not.toContain("iud_type");
  });

  it("asks the vaginal safety questions for vaginal symptoms, and the IUD details with an IUD", () => {
    const vaginal = parseHrtIntake(read({ ...answers, main_goal: "both" }, ["blood_in_urine"]));
    expect(vaginal.ok && vaginal.value).toMatchObject({ blood_in_urine: true, recurrent_urinary_infections: false });
    expect(pointers(parseHrtIntake(read({ ...answers, contraception: ["iud"] })))).toEqual(["iud_inserted_on", "iud_type"]);
  });
});
