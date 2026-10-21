import { describe, expect, it } from "vitest";
import { parseEyelashIntake } from "./eyelash";

function read(fields: Record<string, string | string[]>, checked: string[] = []) {
  return {
    text: (name: string) => (typeof fields[name] === "string" ? (fields[name] as string) : ""),
    all: (name: string) => (Array.isArray(fields[name]) ? (fields[name] as string[]) : fields[name] ? [fields[name] as string] : []),
    checked: (name: string) => checked.includes(name),
  };
}

const answers = {
  treatment_goals: ["longer", "darker"],
  condition_duration: "1_to_5_years",
  lash_loss_onset: "gradual",
  eyes_affected: "both",
  eye_color: "hazel",
  chemotherapy_history: "false",
  medications_allergies: "Artificial tears, as needed\nPenicillin: hives",
  prior_lash_products: "",
  side_effects_consent_attested: "true",
};

describe("parseEyelashIntake", () => {
  it("builds Lithos's eyelash_growth intake, with every screening answer and the required lists", () => {
    const parsed = parseEyelashIntake(read(answers, ["contact_lenses"]));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toMatchObject({
      treatment_goals: ["longer", "darker"],
      contact_lenses: true,
      glaucoma_or_high_eye_pressure: false,
      pregnancy: false,
      alopecia_areata: false,
      chemotherapy_history: false,
      medications_allergies: ["Artificial tears, as needed", "Penicillin: hives"],
      prior_lash_products: [],
      lash_cosmetic_services: [],
      side_effects_consent_attested: true,
    });
    expect(parsed.value).not.toHaveProperty("chemotherapy_current");
  });

  it("asks for the last dose after chemotherapy, and sends it", () => {
    const missing = parseEyelashIntake(read({ ...answers, chemotherapy_history: "true" }));
    expect(missing.ok ? [] : missing.errors.map((e) => e.pointer)).toEqual(["/intake_form/data/chemotherapy_last_dose_on"]);

    const given = parseEyelashIntake(read({ ...answers, chemotherapy_history: "true", chemotherapy_current: "false", chemotherapy_last_dose_on: "2024-03-01" }));
    expect(given.ok && given.value).toMatchObject({ chemotherapy_history: true, chemotherapy_current: false, chemotherapy_last_dose_on: "2024-03-01" });
  });

  it("can't go on without the consent, which Lithos requires", () => {
    const parsed = parseEyelashIntake(read({ ...answers, side_effects_consent_attested: "false" }));
    expect(parsed.ok ? [] : parsed.errors.map((e) => e.pointer)).toEqual(["/intake_form/data/side_effects_consent_attested"]);
  });
});
