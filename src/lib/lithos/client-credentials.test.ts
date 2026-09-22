import { afterEach, describe, expect, it } from "vitest";
import { getLithosClient } from "./client";

const saved = { ...process.env };
const setEnv = (clientId: string) => {
  process.env.LITHOS_API_BASE_URL = "https://api.sandbox.lithoshealth.com";
  process.env.LITHOS_TOKEN_URL = "https://api.sandbox.lithoshealth.com/v1/oauth2/token";
  process.env.LITHOS_CLIENT_ID = clientId;
  process.env.LITHOS_CLIENT_SECRET = `secret_for_${clientId}`;
};

afterEach(() => { process.env = { ...saved }; });

describe("getLithosClient", () => {
  it("reuses one client while the credentials stay the same", () => {
    setEnv("client_a");
    expect(getLithosClient()).toBe(getLithosClient());
  });

  it("builds a new client when the credentials change — switching organizations without a restart", () => {
    setEnv("client_a");
    const first = getLithosClient();
    setEnv("client_b");
    expect(getLithosClient()).not.toBe(first);
  });
});
