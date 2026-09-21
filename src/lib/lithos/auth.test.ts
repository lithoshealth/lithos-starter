import { describe, expect, it, vi } from "vitest";
import { TokenManager, tokenConfigFromEnv } from "./auth";

const config = { tokenUrl: "https://api.sandbox.lithoshealth.com/v1/oauth2/token", clientId: "test-client", clientSecret: "test-secret" };

function tokenResponse(token: string, expiresIn = 3600): Response {
  return new Response(JSON.stringify({ access_token: token, expires_in: expiresIn }), { status: 200 });
}

describe("TokenManager", () => {
  it("mints form-encoded credentials and caches through the safety-margin window", async () => {
    let now = 1_000;
    const fetcher = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => tokenResponse("token-one"));
    const manager = new TokenManager(config, fetcher, () => now);

    expect(await manager.getToken()).toBe("token-one");
    now += 3_539_000;
    expect(await manager.getToken()).toBe("token-one");
    expect(fetcher).toHaveBeenCalledTimes(1);

    now += 2_000;
    await manager.getToken();
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [, init] = fetcher.mock.calls[0];
    expect(init?.method).toBe("POST");
    expect(String(init?.body)).toBe("grant_type=client_credentials&client_id=test-client&client_secret=test-secret");
  });

  it("coalesces concurrent mints and retries after a failed mint", async () => {
    let resolve!: (response: Response) => void;
    const pending = new Promise<Response>((done) => { resolve = done; });
    const fetcher = vi.fn().mockReturnValueOnce(pending).mockResolvedValueOnce(tokenResponse("recovered"));
    const manager = new TokenManager(config, fetcher);
    const first = manager.getToken();
    const second = manager.getToken();
    expect(fetcher).toHaveBeenCalledTimes(1);
    resolve(new Response("nope", { status: 503 }));
    await expect(first).rejects.toThrow("status 503");
    await expect(second).rejects.toThrow("status 503");
    await expect(manager.getToken()).resolves.toBe("recovered");
  });

  it("fails closed when server credentials are absent", () => {
    expect(() => tokenConfigFromEnv({ NODE_ENV: "test" } as NodeJS.ProcessEnv)).toThrow("LITHOS_TOKEN_URL");
  });
});
