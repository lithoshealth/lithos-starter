/**
 * Are Lithos's deliveries to this organization's endpoint succeeding?
 *
 * The setup walkthrough checks this once. This keeps checking afterwards,
 * because that's when it breaks: a free tunnel's address changes on every
 * restart, the endpoint quietly goes stale, and Lithos keeps retrying without
 * telling anyone. Read from Lithos's own delivery log, so it sees failures this
 * app never receives — which is exactly what a stale endpoint produces.
 */

import { getLithosClient } from "../lithos/client";
import { lithosConnection } from "../lithos/connection";

export type Delivery = {
  status: string;
  last_response_code: number | null;
  last_error_class: string | null;
  attempt_count: number;
  created_at: string;
};

export type WebhookHealth =
  | { state: "ok" }
  | { state: "no_endpoint" }
  | { state: "failing"; code: number | null; errorClass: string | null; failing: number }
  | { state: "unknown" };

/** A delivery counts as failing if it gave up, or is still retrying after a non-2xx answer. */
function isFailing(d: Delivery): boolean {
  if (d.status === "failed" || d.status === "exhausted") return true;
  const code = d.last_response_code;
  return (d.status === "pending" || d.status === "delivering") && d.attempt_count > 0 && code !== null && (code < 200 || code >= 300);
}

/**
 * Judge by the newest delivery: one success after a bad patch means it's fixed.
 * `failing` counts the unbroken run of failures at the top of the log.
 */
export function classifyDeliveries(deliveries: Delivery[]): WebhookHealth {
  const newestFirst = [...deliveries].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const latest = newestFirst[0];
  if (!latest || !isFailing(latest)) return { state: "ok" };
  let failing = 0;
  for (const d of newestFirst) {
    if (!isFailing(d)) break;
    failing += 1;
  }
  return { state: "failing", code: latest.last_response_code, errorClass: latest.last_error_class, failing };
}

// One check a minute is plenty; this runs on page renders.
const CACHE_MS = 60_000;
const cache = globalThis as typeof globalThis & { __webhookHealth?: { at: number; value: WebhookHealth } };

export async function webhookHealth(): Promise<WebhookHealth> {
  if (!lithosConnection().connected) return { state: "unknown" };
  if (cache.__webhookHealth && Date.now() - cache.__webhookHealth.at < CACHE_MS) return cache.__webhookHealth.value;

  let value: WebhookHealth;
  try {
    const client = getLithosClient();
    const endpoints = await client.get<{ data: Array<{ status: string }> }>("/v1/webhook_endpoints");
    if (!endpoints.data.some((e) => e.status === "active")) {
      value = { state: "no_endpoint" };
    } else {
      const deliveries = await client.get<{ data: Delivery[] }>("/v1/webhook_deliveries?limit=10");
      value = classifyDeliveries(deliveries.data);
    }
  } catch {
    value = { state: "unknown" };
  }
  cache.__webhookHealth = { at: Date.now(), value };
  return value;
}

/** One line a person can act on. */
export function describeFailure(health: Extract<WebhookHealth, { state: "failing" }>): string {
  const answer = health.code ? `HTTP ${health.code}` : health.errorClass ? `no response (${health.errorClass})` : "no response";
  const run = health.failing > 1 ? `The last ${health.failing} deliveries failed` : "The last delivery failed";
  return `${run} — Lithos got ${answer} from your endpoint.`;
}
