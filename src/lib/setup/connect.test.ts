import { describe, expect, it } from "vitest";
import { verifyCredentials, type Credentials } from "./connect";

const creds: Credentials = {
  baseUrl: "https://api.sandbox.lithoshealth.com",
  tokenUrl: "https://api.sandbox.lithoshealth.com/v1/oauth2/token",
  clientId: "client_abc",
  clientSecret: "secret",
};

type Answer = { ok?: boolean; status?: number; body?: unknown };

/** A fetch that answers the token call and the formulary call in turn. */
function fakeFetch(token: Answer, catalog?: Answer) {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    const spec = url.includes("oauth2/token") ? token : catalog!;
    return {
      ok: spec.ok ?? true,
      status: spec.status ?? 200,
      json: async () => spec.body,
    } as Response;
  }) as typeof fetch;
}

describe("verifyCredentials", () => {
  it("accepts a pair that mints a token and reads a formulary", async () => {
    const result = await verifyCredentials(creds, fakeFetch({ body: { access_token: "tok" } }, { body: { data: [{ id: "ctr_1" }, { id: "ctr_2" }] } }));
    expect(result).toEqual({ ok: true, treatments: 2 });
  });

  it("says the ID box may hold the secret when the ID doesn't look like one", async () => {
    const result = await verifyCredentials({ ...creds, clientId: "sk_live_oops" }, fakeFetch({ ok: false, status: 401, body: {} }));
    expect(result).toEqual({ ok: false, message: expect.stringContaining('usually start with "client_"') });
  });

  it("names the truncation risk when the ID does look like one", async () => {
    const result = await verifyCredentials(creds, fakeFetch({ ok: false, status: 401, body: {} }));
    expect(result).toEqual({ ok: false, message: expect.stringContaining("truncated") });
  });

  it("separates credentials that work from an organization that isn't provisioned", async () => {
    const result = await verifyCredentials(
      creds,
      fakeFetch({ body: { access_token: "tok" } }, { ok: false, status: 403, body: { errors: [{ code: "auth.org_not_provisioned", message: "no org" }] } }),
    );
    expect(result).toEqual({ ok: false, message: expect.stringContaining("aren't attached to a Lithos organization") });
  });

  it("reports an unreachable token URL rather than throwing", async () => {
    const boom = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    await expect(verifyCredentials(creds, boom)).resolves.toEqual({ ok: false, message: expect.stringContaining("Couldn't reach") });
  });
});
