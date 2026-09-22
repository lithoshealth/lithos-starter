import { TokenManager, tokenConfigFromEnv } from "./auth";
import { LithosApiError, parseApiErrors } from "./errors";

export type LithosClient = {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class ServerLithosClient implements LithosClient {
  constructor(
    private readonly apiBaseUrl: string,
    private readonly tokens: TokenManager,
    private readonly fetcher: FetchLike = fetch,
  ) {}

  get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  private async request<T>(path: string, init: RequestInit, mayRetry = true): Promise<T> {
    const accessToken = await this.tokens.getToken();
    const response = await this.fetcher(`${this.apiBaseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (response.status === 401 && mayRetry) {
      this.tokens.invalidate(accessToken);
      return this.request<T>(path, init, false);
    }

    const value: unknown = await response.json().catch(() => undefined);
    if (!response.ok) throw new LithosApiError(response.status, parseApiErrors(value));
    return value as T;
  }
}

/**
 * One client per set of credentials, not per process. In development
 * `.env.local` can change under a running server — switching to another
 * sandbox organization, say — and a client built from the old values would
 * keep minting tokens for the old organization until a restart. The key covers
 * every value the client is built from, so any change builds a fresh one.
 */
let singleton: { key: string; client: ServerLithosClient } | undefined;

export function getLithosClient(): ServerLithosClient {
  const baseUrl = process.env.LITHOS_API_BASE_URL;
  if (!baseUrl) throw new Error("Missing required server environment variable: LITHOS_API_BASE_URL");
  const config = tokenConfigFromEnv();
  const key = [baseUrl, config.tokenUrl, config.clientId, config.clientSecret].join("\n");
  if (!singleton || singleton.key !== key) {
    singleton = { key, client: new ServerLithosClient(baseUrl, new TokenManager(config)) };
  }
  return singleton.client;
}
