/**
 * This starter is sandbox-only — the Lithos sandbox holds only fake patients,
 * so the demo conveniences (a sign-in list of patients, ops pages with raw
 * records, buttons that play the clinician) are safe there and nowhere else.
 *
 * One check, used everywhere: is this app talking to the sandbox? Not "is it
 * running on a laptop" — a copy deployed against the sandbox (for webhooks,
 * say) keeps everything; a copy given production credentials loses the demo
 * conveniences, and the API client refuses to run at all until someone opts
 * in on purpose with LITHOS_ALLOW_NON_SANDBOX=1. See "Taking it to
 * production" in the README.
 */

export const ALLOW_NON_SANDBOX = "LITHOS_ALLOW_NON_SANDBOX";

export function isSandboxBaseUrl(baseUrl: string | undefined): boolean {
  return Boolean(baseUrl && /\/\/api\.sandbox\./.test(baseUrl));
}

/** The deliberate opt-in to call anything but the sandbox. */
export function nonSandboxAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return env[ALLOW_NON_SANDBOX] === "1" || env[ALLOW_NON_SANDBOX] === "true";
}

/**
 * Connected to an API that isn't the sandbox — where the data may be real. An
 * unconnected copy isn't: it has nothing to show, so it keeps its pages.
 */
export function connectedOutsideSandbox(env: Record<string, string | undefined> = process.env): boolean {
  const baseUrl = env.LITHOS_API_BASE_URL;
  return Boolean(baseUrl) && !isSandboxBaseUrl(baseUrl);
}

export function sandboxOnlyMessage(baseUrl: string): string {
  return `This app is sandbox-only, and LITHOS_API_BASE_URL is ${baseUrl}. Nothing was sent. ` +
    `If you're taking it live on purpose, read "Taking it to production" in the README, then set ${ALLOW_NON_SANDBOX}=1.`;
}
