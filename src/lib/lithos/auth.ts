type TokenResponse = {
  access_token: string;
  expires_in: number;
};

type CachedToken = {
  accessToken: string;
  refreshAt: number;
};

type TokenManagerConfig = {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const SAFETY_MARGIN_SECONDS = 60;

export class TokenManager {
  private cached: CachedToken | undefined;
  private minting: Promise<string> | undefined;

  constructor(
    private readonly config: TokenManagerConfig,
    private readonly fetcher: FetchLike = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async getToken(): Promise<string> {
    if (this.cached && this.now() < this.cached.refreshAt) return this.cached.accessToken;
    if (this.minting) return this.minting;

    this.minting = this.mintToken().finally(() => {
      this.minting = undefined;
    });
    return this.minting;
  }

  invalidate(accessToken?: string): void {
    if (!accessToken || this.cached?.accessToken === accessToken) this.cached = undefined;
  }

  private async mintToken(): Promise<string> {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });
    const response = await this.fetcher(this.config.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Lithos token mint failed with status ${response.status}`);
    }

    const value: unknown = await response.json();
    if (!isTokenResponse(value)) throw new Error("Lithos token mint returned an invalid response");

    const usableSeconds = Math.max(0, value.expires_in - SAFETY_MARGIN_SECONDS);
    this.cached = {
      accessToken: value.access_token,
      refreshAt: this.now() + usableSeconds * 1_000,
    };
    return value.access_token;
  }
}

function isTokenResponse(value: unknown): value is TokenResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.access_token === "string" &&
    candidate.access_token.length > 0 &&
    typeof candidate.expires_in === "number" &&
    Number.isFinite(candidate.expires_in) &&
    candidate.expires_in > 0
  );
}

export function tokenConfigFromEnv(env: NodeJS.ProcessEnv = process.env): TokenManagerConfig {
  return {
    tokenUrl: requiredEnv(env, "LITHOS_TOKEN_URL"),
    clientId: requiredEnv(env, "LITHOS_CLIENT_ID"),
    clientSecret: requiredEnv(env, "LITHOS_CLIENT_SECRET"),
  };
}

function requiredEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`Missing required server environment variable: ${name}`);
  return value;
}
