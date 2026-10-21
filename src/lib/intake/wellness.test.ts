import { describe, expect, it } from "vitest";
import { parseOxytocinIntake, parseSermorelinIntake, parseVitaminB12Intake } from "./wellness";

function read(fields: Record<string, string | string[]>, checked: string[] = []) {
  return {
    text: (name: string) => (typeof fields[name] === "string" ? (fields[name] as string) : ""),
    all: (name: string) => (Array.isArray(fields[name]) ? (fields[name] as string[]) : fields[name] ? [fields[name] as string] : []),
    checked: (name: string) => checked.includes(name),
  };
}

const pointers = (parsed: ReturnType<typeof parseSermorelinIntake>) => (parsed.ok ? [] : parsed.errors.map((e) => e.pointer));

describe("parseSermorelinIntake", () => {
  const answers = { treatment_goals: ["healthy_aging"], height_ft: "5", height_in: "10", weight_lb: "180", can_self_administer: "true" };

  it("converts height and weight, and sends every screening answer", () => {
    const parsed = parseSermorelinIntake(read({ ...answers, interacting_medications: ["insulin"] }, ["diabetes"]));
    expect(parsed.ok && parsed.value).toMatchObject({
      treatment_goals: ["healthy_aging"], height_cm: 178, weight_kg: 81.6, interacting_medications: ["insulin"],
      diabetes: true, cancer_history: false, pregnancy: false, can_self_administer: true,
    });
  });

  it("needs a goal and whether someone can give the injections", () => {
    expect(pointers(parseSermorelinIntake(read({ ...answers, treatment_goals: [], can_self_administer: "" }))))
      .toEqual(["/intake_form/data/treatment_goals", "/intake_form/data/can_self_administer"]);
  });
});

describe("parseVitaminB12Intake", () => {
  const answers = { treatment_goals: ["fatigue"], condition_duration: "3_to_12_months", cancer_treatment_last_3_years: "false", can_self_administer: "true" };

  it("always sends the medicines list, empty for none", () => {
    const parsed = parseVitaminB12Intake(read(answers));
    expect(parsed.ok && parsed.value).toMatchObject({ medications_allergies: [], cancer_treatment_last_3_years: false });
  });

  it("asks for a description when the symptom is something else", () => {
    expect(pointers(parseVitaminB12Intake(read({ ...answers, treatment_goals: ["other"] })))).toEqual(["/intake_form/data/baseline_symptoms"]);
  });

  it("sends the oncologist's approval after recent cancer treatment", () => {
    const parsed = parseVitaminB12Intake(read({ ...answers, cancer_treatment_last_3_years: "true", oncologist_approval: "true" }));
    expect(parsed.ok && parsed.value).toMatchObject({ cancer_treatment_last_3_years: true, oncologist_approval: true });
  });
});

describe("parseOxytocinIntake", () => {
  const answers = {
    treatment_goals: ["trouble_staying_asleep"], sleep_history: "Wakes at 3am most nights.", psychiatric_history: "None reported",
    cancer_treatment_last_3_years: "false", off_label_understanding_attested: "true",
  };

  it("sends the suicide screen and the consent", () => {
    const parsed = parseOxytocinIntake(read(answers, ["recent_wish_to_be_dead"]));
    expect(parsed.ok && parsed.value).toMatchObject({
      recent_wish_to_be_dead: true, suicidal_ideation_or_recent_attempt: false, sleep_disorders: [],
      off_label_understanding_attested: true,
    });
    expect(parsed.ok && parsed.value).not.toHaveProperty("can_self_administer");
  });

  it("needs the histories and the consent", () => {
    expect(pointers(parseOxytocinIntake(read({ ...answers, sleep_history: "", psychiatric_history: "", off_label_understanding_attested: "false" }))))
      .toEqual(["/intake_form/data/sleep_history", "/intake_form/data/psychiatric_history", "/intake_form/data/off_label_understanding_attested"]);
  });
});
