import { describe, expect, it } from "vitest";
import { brandCss } from "./app-meta";
import { DEFAULT_CONFIG, normalizeConfig } from "./starter-config";

describe("starter config", () => {
  it("defaults to the demo brand", () => {
    expect(normalizeConfig({}).brand).toEqual(DEFAULT_CONFIG.brand);
  });

  it("keeps valid fields and replaces malformed ones one by one", () => {
    const brand = normalizeConfig({ brand: { name: "  Acme Health ", color: "not-a-colour", logo: "https://evil.example/x.png" } }).brand;
    expect(brand.name).toBe("Acme Health");
    expect(brand.color).toBe(DEFAULT_CONFIG.brand.color);
    expect(brand.logo).toBeUndefined();
  });

  it("accepts only its own logo upload path", () => {
    expect(normalizeConfig({ brand: { logo: "/brand/logo.png?v=123" } }).brand.logo).toBe("/brand/logo.png?v=123");
    expect(normalizeConfig({ brand: { logo: "/brand/logo.svg" } }).brand.logo).toBeUndefined();
  });

  it("derives the colour tokens from one colour", () => {
    expect(brandCss({ ...DEFAULT_CONFIG.brand, color: "#aa3366" })).toContain("--primary:#aa3366");
  });
});
