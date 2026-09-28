import { describe, expect, it } from "vitest";
import { fontCandidates, normalizeSiteUrl, rankColors } from "./site-import";

describe("site import", () => {
  it("ranks a declared theme colour first and drops greys and pale backgrounds", () => {
    const css = "body{color:#222;background:#f7f3ee} .btn{background:#e7a628} .tag{color:#e7a628} :root{--brand-accent:#6d28d9}";
    expect(rankColors(["#0d5c63"], css)).toEqual(["#0d5c63", "#6d28d9", "#e7a628"]);
    // Two teals this close are one brand colour, not two suggestions.
    expect(rankColors(["#0d5c63"], ":root{--primary:#1e6f6f}")).toEqual(["#0d5c63"]);
  });

  it("finds a font from a Google Fonts link, and from next/font's renamed family", () => {
    const html = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&display=swap">';
    expect(fontCandidates(html, "")).toEqual(["DM Sans"]);
    expect(fontCandidates("", "body{font-family:'__Source_Serif_4_0ab1c2', '__Source_Serif_4_Fallback_0ab1c2'}")).toEqual(["Source Serif 4"]);
    expect(fontCandidates("", "body{font-family: Helvetica, Arial, sans-serif}")).toEqual([]);
  });

  it("only reads public web addresses", () => {
    expect(normalizeSiteUrl("genmeds.com")?.href).toBe("https://genmeds.com/");
    expect(normalizeSiteUrl("http://localhost:3001")).toBeNull();
    expect(normalizeSiteUrl("http://192.168.1.10")).toBeNull();
    expect(normalizeSiteUrl("file:///etc/passwd")).toBeNull();
  });
});
