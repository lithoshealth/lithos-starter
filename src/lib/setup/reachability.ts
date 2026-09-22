/**
 * Does this address actually reach *this* app?
 *
 * Checked before a webhook endpoint is registered, because once Lithos has an
 * address it keeps delivering to it — and if the address is wrong, nobody is
 * told. In the sandbox we've seen a partner register `example.com` and fail 82
 * deliveries in silence. A placeholder, a typo, a stopped tunnel or Vercel's
 * Deployment Protection all fail this check instead, with the reason.
 *
 * How: the app serves `/api/setup/ping`, answering with a short proof derived
 * from its client secret. We fetch the typed address's ping from the server and
 * compare. Derived from configuration rather than a per-process random value,
 * so it holds on serverless hosts where every request may hit a new instance.
 * The proof is an HMAC — it can't be reversed into the secret.
 */

import { createHmac } from "node:crypto";

export const PING_PATH = "/api/setup/ping";

export function pingProof(secret: string | undefined = process.env.LITHOS_CLIENT_SECRET): string | null {
  if (!secret) return null;
  return createHmac("sha256", secret).update("lithos-starter:ping").digest("hex").slice(0, 16);
}

export type Reachability = { ok: true } | { ok: false; message: string };

const PLACEHOLDER_HOSTS = /(^|\.)example\.(com|org|net)$/i;

export async function reachesThisApp(base: string): Promise<Reachability> {
  let host: string;
  try {
    host = new URL(base).host;
  } catch {
    return { ok: false, message: `"${base}" isn't a valid address.` };
  }

  if (PLACEHOLDER_HOSTS.test(host)) {
    return { ok: false, message: `${host} is a placeholder address, not your app. Paste the address your tunnel printed, or your deployment's URL.` };
  }

  let response: Response;
  try {
    response = await fetch(`${base}${PING_PATH}`, { cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(6000) });
  } catch (error) {
    const reason = error instanceof Error && error.name === "TimeoutError" ? "no answer within 6 seconds" : "no answer";
    return { ok: false, message: `Couldn't reach ${host} (${reason}). If it's a tunnel, check it's still running — a free tunnel's address changes every time it restarts.` };
  }

  if (response.status === 401 || response.status === 403) {
    return { ok: false, message: `${host} answered HTTP ${response.status} before the request reached the app. On Vercel that's almost always Deployment Protection — turn it off for production, then try again.` };
  }

  // A tunnel that exists but whose local app is down answers with the tunnel
  // provider's own error page — a 5xx, not a clean "no answer".
  if (response.status >= 500) {
    return { ok: false, message: `${host} answered with an error (HTTP ${response.status}). If it's a tunnel, it's probably running but can't reach your app — check \`npm run dev\` is up on the port the tunnel points at.` };
  }

  const body = (await response.json().catch(() => null)) as { app?: string; proof?: string | null } | null;
  if (!response.ok || body?.app !== "lithos-starter") {
    return { ok: false, message: `${host} answered (HTTP ${response.status}), but it isn't this app. Check you pasted this app's own address — not a placeholder, another site, or a different project.` };
  }

  if (body.proof !== pingProof()) {
    return { ok: false, message: `${host} is a copy of this starter, but running with different credentials. Register the address of the copy that's connected to this organization.` };
  }

  return { ok: true };
}
