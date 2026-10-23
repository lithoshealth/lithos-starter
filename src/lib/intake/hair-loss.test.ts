import { describe, expect, it } from "vitest";
import { parseHairLossIntake } from "./hair-loss";

function read(fields: Record<string, string | string[]>, checked: string[] = []) {
  return {
    text: (name: string) => (typeof fields[name] === "string" ? (fields[name] as string) : ""),
    all: (name: string) => (Array.isArray(fields[name]) ? (fields[name] as string[]) : fields[name] ? [fields[name] as string] : []),
    checked: (name: string) => checked.includes(name),
  };
}

const answers = {
  treatment_goals: ["slow_the_loss"],
  thinning_areas: ["crown"],
  condition_duration: "1_to_5_years",
  thinning_pace: "slow",
  shedding_or_thinning: "thinning",
  family_history: "true",
  can_become_pregnant: "false",
  reliable_contraception: "true",
  contraception_method: "IUD",
  medications_allergies: "Biotin 10,000 mcg",
  prior_hair_treatments: "",
  finasteride_risks_attested: "true",
};

describe("parseHairLossIntake", () => {
  it("builds Lithos's hair_loss intake, with every screening answer", () => {
    const parsed = parseHairLossIntake(read(answers, ["heart_disease"]));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toMatchObject({
      treatment_goals: ["slow_the_loss"], family_history: true, can_become_pregnant: false, reliable_contraception: false,
      heart_disease: true, pregnancy: false, current_suicidal_thoughts: false, medications_allergies: ["Biotin 10,000 mcg"],
      prior_hair_treatments: [], finasteride_risks_attested: true,
    });
    // Contraception only counts for someone who could become pregnant.
    expect(parsed.value).not.toHaveProperty("contraception_method");
  });

  it("sends contraception for someone who could become pregnant, and a side-effects no", () => {
    const parsed = parseHairLossIntake(read({ ...answers, can_become_pregnant: "true", finasteride_risks_attested: "false" }));
    expect(parsed.ok && parsed.value).toMatchObject({
      can_become_pregnant: true, reliable_contraception: true, contraception_method: "IUD", finasteride_risks_attested: false,
    });
  });

  it("needs a goal, an area and the pregnancy question", () => {
    const parsed = parseHairLossIntake(read({ ...answers, treatment_goals: [], thinning_areas: [], can_become_pregnant: "" }));
    expect(parsed.ok ? [] : parsed.errors.map((e) => e.pointer)).toEqual([
      "/intake_form/data/treatment_goals", "/intake_form/data/thinning_areas", "/intake_form/data/can_become_pregnant",
    ]);
  });
});
