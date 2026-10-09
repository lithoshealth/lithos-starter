import { describe, expect, it } from "vitest";
import { categoryLabel, isProgramKey, programFor } from "./programs";

describe("programs", () => {
  it("keeps the written-out programs as they are", () => {
    expect(programFor("weight_management")?.label).toBe("Weight loss");
    expect(programFor("weight_management")?.illustrative).toBeUndefined();
  });

  it("offers any other category with an illustrative intake, labelled the way Lithos labels it", () => {
    expect(programFor("sexual_health")).toMatchObject({ key: "sexual_health", label: "Sexual health", supported: true, illustrative: true });
    expect(categoryLabel("wellness")).toBe("Wellness");
  });

  it("refuses anything that isn't a category slug", () => {
    expect(programFor("../etc")).toBeUndefined();
    expect(programFor(undefined)).toBeUndefined();
    expect(isProgramKey("Wellness")).toBe(false);
  });
});
