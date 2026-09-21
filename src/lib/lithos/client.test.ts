import { describe, expect, it, vi } from "vitest";
import { TokenManager } from "./auth";
import { ServerLithosClient } from "./client";
import { LithosApiError } from "./errors";

const config = { tokenUrl: "https://sandbox.test/v1/oauth2/token", clientId: "client", clientSecret: "secret" };

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

describe("ServerLithosClient", () => {
  it("refreshes once after a 401 and keeps authorization server-side", async () => {
    const tokenFetch = vi.fn().mockResolvedValueOnce(json({ access_token: "old", expires_in: 3600 })).mockResolvedValueOnce(json({ access_token: "new", expires_in: 3600 }));
    const apiFetch = vi.fn().mockResolvedValueOnce(json({ errors: [] }, 401)).mockResolvedValueOnce(json({ id: "enc_1" }));
    const client = new ServerLithosClient("https://sandbox.test", new TokenManager(config, tokenFetch), apiFetch);

    await expect(client.get<{ id: string }>("/v1/encounters/enc_1")).resolves.toEqual({ id: "enc_1" });
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(apiFetch.mock.calls[0][1]?.headers).toMatchObject({ authorization: "Bearer old" });
    expect(apiFetch.mock.calls[1][1]?.headers).toMatchObject({ authorization: "Bearer new" });
  });

  it("preserves every API error including pointers", async () => {
    const tokenFetch = vi.fn().mockResolvedValue(json({ access_token: "token", expires_in: 3600 }));
    const apiFetch = vi.fn().mockResolvedValue(json({ errors: [
      { code: "field.required", message: "Required", source: { pointer: "/telehealth_consented_at" } },
      { code: "category.unavailable", message: "Unavailable", source: { pointer: "/category" } },
    ] }, 422));
    const client = new ServerLithosClient("https://sandbox.test", new TokenManager(config, tokenFetch), apiFetch);

    const error = await client.post("/v1/patients", {}).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(LithosApiError);
    expect((error as LithosApiError).status).toBe(422);
    expect((error as LithosApiError).errors).toHaveLength(2);
    expect((error as LithosApiError).errors[1].source?.pointer).toBe("/category");
  });
});
