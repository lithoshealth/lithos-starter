/**
 * What this process has seen arrive at the webhook route — including the
 * deliveries it rejected.
 *
 * Exists for one diagnosis the setup walkthrough needs. When Lithos reports a
 * delivery failed with a 401, there are two very different causes that look
 * identical from Lithos's side:
 *
 *   - the request reached this app and the signature didn't verify
 *     (wrong or stale LITHOS_WEBHOOK_SECRET), or
 *   - it never reached this app at all — Vercel Deployment Protection answered
 *     first with its own 401.
 *
 * Only the app can tell them apart, by whether it saw the attempt. In-memory
 * and per-process on purpose: it's a diagnostic for one person's setup session,
 * not a record. On a serverless deployment each instance keeps its own count.
 */

export type WebhookAttemptOutcome =
  | "received"
  | "duplicate"
  | "invalid_signature"
  | "webhook_not_configured"
  | "invalid_json"
  | "invalid_event"
  | "event_store_unavailable";

export type WebhookAttempts = {
  total: number;
  byOutcome: Partial<Record<WebhookAttemptOutcome, number>>;
  last: { outcome: WebhookAttemptOutcome; at: string } | null;
};

const globalAttempts = globalThis as typeof globalThis & { __eucardiaWebhookAttempts?: WebhookAttempts };

function state(): WebhookAttempts {
  globalAttempts.__eucardiaWebhookAttempts ??= { total: 0, byOutcome: {}, last: null };
  return globalAttempts.__eucardiaWebhookAttempts;
}

export function recordWebhookAttempt(outcome: WebhookAttemptOutcome): void {
  const s = state();
  s.total += 1;
  s.byOutcome[outcome] = (s.byOutcome[outcome] ?? 0) + 1;
  s.last = { outcome, at: new Date().toISOString() };
}

export function readWebhookAttempts(): WebhookAttempts {
  const s = state();
  return { total: s.total, byOutcome: { ...s.byOutcome }, last: s.last };
}

/** Map the handler's result onto an outcome, so the route records every attempt. */
export function outcomeFor(result: { status: number; body: { received?: boolean; duplicate?: boolean; error?: string } }): WebhookAttemptOutcome {
  if (result.status === 200) return result.body.duplicate ? "duplicate" : "received";
  const known: WebhookAttemptOutcome[] = ["invalid_signature", "webhook_not_configured", "invalid_json", "invalid_event", "event_store_unavailable"];
  return known.find((o) => o === result.body.error) ?? "invalid_event";
}
