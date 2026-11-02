import { describe, expect, it } from "vitest";
import { parseRingwormIntake, ringwormPhotos } from "./ringworm";

function read(fields: Record<string, string | string[]>, checked: string[] = []) {
  return {
    text: (name: string) => (typeof fields[name] === "string" ? (fields[name] as string) : ""),
    all: (name: string) => (Array.isArray(fields[name]) ? (fields[name] as string[]) : fields[name] ? [fields[name] as string] : []),
    checked: (name: string) => checked.includes(name),
  };
}

const rash = {
  affected_areas: ["body", "between_toes"],
  patch_count: "2",
  largest_patch_cm: "3.5",
  condition_duration: "under_3_months",
  rash_symptoms: ["itch"],
  exposures: ["gym"],
  diabetes: "none",
  immune_compromise: "none",
  foot_wound: "false",
  allergies: "Penicillin (rash)",
};

describe("parseRingwormIntake", () => {
  it("builds Lithos's dermatophyte_infection intake", () => {
    const parsed = parseRingwormIntake(read(rash, ["fever", "planning_pregnancy"]));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toMatchObject({
      affected_areas: ["body", "between_toes"], excluded_areas: [], patch_count: 2, largest_patch_cm: 3.5, foot_wound: false,
      fever: true, planning_pregnancy: true, pregnant: false, ketoconazole_allergy: false, allergies: ["Penicillin (rash)"],
      current_medications: [], prior_products: [], associated_findings: [],
    });
  });

  it("accepts a rash only on an excluded area, and refuses a rash nowhere", () => {
    expect(parseRingwormIntake(read({ ...rash, affected_areas: [], excluded_areas: ["scalp"] })).ok).toBe(true);
    const parsed = parseRingwormIntake(read({ ...rash, affected_areas: [] }));
    expect(parsed.ok ? [] : parsed.errors.map((e) => e.pointer)).toEqual(["/intake_form/data/affected_areas"]);
  });

  it("needs the size, the duration and the health answers", () => {
    const parsed = parseRingwormIntake(read({ affected_areas: ["body"] }));
    expect(parsed.ok ? [] : parsed.errors.map((e) => e.pointer)).toEqual(expect.arrayContaining([
      "/intake_form/data/patch_count", "/intake_form/data/largest_patch_cm", "/intake_form/data/condition_duration",
      "/intake_form/data/diabetes", "/intake_form/data/immune_compromise", "/intake_form/data/foot_wound",
    ]));
  });
});

describe("ringwormPhotos", () => {
  it("asks an overview and a close-up of each site named, and none for an excluded area alone", () => {
    expect(ringwormPhotos({ affected_areas: ["body", "soles_and_sides"] }).map((p) => p.field)).toEqual([
      "body_overview_photo_upload_id", "body_close_up_photo_upload_id",
      "soles_and_sides_overview_photo_upload_id", "soles_and_sides_close_up_photo_upload_id",
    ]);
    expect(ringwormPhotos({ affected_areas: [] })).toEqual([]);
  });
});
