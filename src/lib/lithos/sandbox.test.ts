import { afterEach, describe, expect, it, vi } from "vitest";
import { getLithosClient } from "./client";
import { connectedOutsideSandbox, isSandboxBaseUrl, nonSandboxAllowed } from "./sandbox";

const SANDBOX = "https://api.sandbox.lithoshealth.com";
const PRODUCTION = "https://api.lithoshealth.com";

afterEach(() => vi.unstubAllEnvs());

function connectTo(baseUrl: string) {
  vi.stubEnv("LITHOS_API_BASE_URL", baseUrl);
  vi.stubEnv("LITHOS_TOKEN_URL", `${baseUrl}/v1/oauth2/token`);
  vi.stubEnv("LITHOS_CLIENT_ID", "client_x");
  vi.stubEnv("LITHOS_CLIENT_SECRET", "secret_x");
}

describe("the sandbox check", () => {
  it("knows the sandbox from anything else", () => {
    expect(isSandboxBaseUrl(SANDBOX)).toBe(true);
    expect(isSandboxBaseUrl(PRODUCTION)).toBe(false);
    expect(isSandboxBaseUrl("http://localhost:3000")).toBe(false);
    expect(isSandboxBaseUrl(undefined)).toBe(false);
  });

  it("only counts as outside the sandbox once it's connected somewhere — an unconnected copy keeps its pages", () => {
    expect(connectedOutsideSandbox({})).toBe(false);
    expect(connectedOutsideSandbox({ LITHOS_API_BASE_URL: SANDBOX })).toBe(false);
    expect(connectedOutsideSandbox({ LITHOS_API_BASE_URL: PRODUCTION })).toBe(true);
  });

  it("opts in only when told to, in so many words", () => {
    expect(nonSandboxAllowed({})).toBe(false);
    expect(nonSandboxAllowed({ LITHOS_ALLOW_NON_SANDBOX: "yes" })).toBe(false);
    expect(nonSandboxAllowed({ LITHOS_ALLOW_NON_SANDBOX: "1" })).toBe(true);
  });
});

describe("the API client", () => {
  it("runs against the sandbox", () => {
    connectTo(SANDBOX);
    expect(() => getLithosClient()).not.toThrow();
  });

  it("refuses anything else, before a request or a token, and says how to opt in", () => {
    connectTo(PRODUCTION);
    expect(() => getLithosClient()).toThrow(/sandbox-only.*LITHOS_ALLOW_NON_SANDBOX=1/);
  });

  it("runs elsewhere once someone opts in on purpose", () => {
    connectTo(PRODUCTION);
    vi.stubEnv("LITHOS_ALLOW_NON_SANDBOX", "1");
    expect(() => getLithosClient()).not.toThrow();
  });
});
