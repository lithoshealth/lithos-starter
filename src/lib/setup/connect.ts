/**
 * Check a client ID and secret before saving them.
 *
 * Connecting is the first thing a prospect does, so it's the first place the
 * app can waste their afternoon: a secret pasted into the ID box, credentials
 * for an organization that was never provisioned, a copy that lost a character.
 * Each of those fails differently, and the message says which — the same three
 * checks `/setup` step 1 runs afterwards (`npm run setup` runs them too, so the
 * terminal and the page tell one story).
 *
 * Verifying with the pasted values rather than the environment is deliberate:
 * nothing is written to `.env.local` until Lithos has accepted them, so a typo
 * can't leave the app half-configured.
 */

export type CredentialCheck = { ok: true; treatments: number } | { ok: false; message: string };

export type Credentials = { baseUrl: string; tokenUrl: string; clientId: string; clientSecret: string };

export async function verifyCredentials({ baseUrl, tokenUrl, clientId, clientSecret }: Credentials, fetcher: typeof fetch = fetch): Promise<CredentialCheck> {
  let tokenResponse: Response;
  try {
    tokenResponse = await fetcher(tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, message: `Couldn't reach ${tokenUrl}. Are you online?` };
  }

  if (!tokenResponse.ok) {
    const hint = clientId.startsWith("client_")
      ? "Check both values came from the same organization, and that the secret wasn't truncated when it was copied."
      : "Lithos client IDs usually start with \"client_\" — check you pasted the ID in the ID box, not the secret.";
    return { ok: false, message: `Lithos didn't accept these credentials (HTTP ${tokenResponse.status}). ${hint}` };
  }

  const { access_token: token } = (await tokenResponse.json().catch(() => ({}))) as { access_token?: string };
  if (!token) return { ok: false, message: "Lithos accepted the credentials but returned no access token." };

  // The token proves the credentials; this proves they're attached to an
  // organization with a formulary — the thing that actually blocks step 2.
  const catalog = await fetcher(`${baseUrl.replace(/\/$/, "")}/v1/catalog_treatments`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = (await catalog.json().catch(() => null)) as { data?: unknown[]; errors?: Array<{ code?: string; message?: string }> } | null;

  if (!catalog.ok) {
    const error = body?.errors?.[0];
    if (error?.code === "auth.org_not_provisioned") {
      return { ok: false, message: "These credentials work, but they aren't attached to a Lithos organization yet. Ask your Lithos contact to provision the sandbox organization." };
    }
    return { ok: false, message: `Reading your formulary failed (HTTP ${catalog.status}${error?.code ? `, ${error.code}` : ""}). ${error?.message ?? ""}`.trim() };
  }

  return { ok: true, treatments: Array.isArray(body?.data) ? body.data.length : 0 };
}
