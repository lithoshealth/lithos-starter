import { describe, expect, it } from "vitest";
import { reviewIntake } from "./review";

describe("reviewIntake", () => {
  it("reads a weight intake back with BMI and the screening answers that were yes", () => {
    const review = reviewIntake("weight_management", {
      height_cm: 170, weight_kg: 97.5, already_on_glp1: false, comorbidities: ["htn"], gallbladder: true, pregnancy: false,
    });
    expect(review.facts).toContainEqual({ label: "BMI", value: "33.7" });
    expect(review.facts).toContainEqual({ label: "Height", value: "170 cm (5 ft 7 in)" });
    expect(review.facts).toContainEqual({ label: "Weight-related conditions", value: "High blood pressure" });
    expect(review.flags).toEqual(["Gallbladder disease or gallstones, or gallbladder removed in the last 3 months"]);
  });

  it("reads a lipid intake back in plain words", () => {
    const review = reviewIntake("lipid_management", {
      indication: "hypercholesterolemia", ldl_c: 160, ldl_c_date: "2025-01-15", familial_hypercholesterolemia: "none", cirrhosis: false,
    });
    expect(review.facts).toContainEqual({ label: "LDL-C", value: "160 mg/dL, measured 2025-01-15" });
    expect(review.facts).toContainEqual({ label: "Reason", value: "High cholesterol" });
    expect(review.flags).toEqual([]);
  });
});
