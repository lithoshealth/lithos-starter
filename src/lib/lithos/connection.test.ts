import { describe, expect, it } from "vitest";
import { lithosConnection } from "./connection";

const FULL = {
  LITHOS_API_BASE_URL: "https://api.sandbox.lithoshealth.com",
  LITHOS_TOKEN_URL: "https://api.sandbox.lithoshealth.com/v1/oauth2/token",
  LITHOS_CLIENT_ID: "client_test",
  LITHOS_CLIENT_SECRET: "secret_test",
};

describe("lithosConnection", () => {
  it("is connected when all four values are present", () => {
    expect(lithosConnection(FULL)).toEqual({ connected: true });
  });

  it("names exactly what's missing — the fresh-clone case is the id and secret", () => {
    const freshClone = { ...FULL, LITHOS_CLIENT_ID: "", LITHOS_CLIENT_SECRET: "" };
    expect(lithosConnection(freshClone)).toEqual({ connected: false, missing: ["LITHOS_CLIENT_ID", "LITHOS_CLIENT_SECRET"] });
  });

  it("treats an empty environment as not connected rather than throwing", () => {
    expect(lithosConnection({}).connected).toBe(false);
  });
});
