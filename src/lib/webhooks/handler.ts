import type { EventStore, WebhookPayload } from "../events/store";
import { verifyLithosSignature } from "./signature";

export type WebhookHandlerResult = { status: number; body: { received?: boolean; duplicate?: boolean; error?: string } };

function isWebhookPayload(value: unknown): value is WebhookPayload {
  return typeof value === "object" && value !== null && typeof (value as Record<string, unknown>).id === "string" && (value as { id: string }).id.length > 0;
}

export async function handleLithosWebhook(input: {
  rawBody: string;
  signatureHeader: string | null;
  signingSecret: string | undefined;
  store: EventStore;
  now?: Date;
}): Promise<WebhookHandlerResult> {
  if (!input.signingSecret) return { status: 503, body: { error: "webhook_not_configured" } };

  const now = input.now ?? new Date();
  const verification = verifyLithosSignature(input.rawBody, input.signatureHeader, input.signingSecret, Math.floor(now.getTime() / 1_000));
  if (!verification.ok) return { status: 401, body: { error: "invalid_signature" } };

  let value: unknown;
  try {
    value = JSON.parse(input.rawBody);
  } catch {
    return { status: 400, body: { error: "invalid_json" } };
  }
  if (!isWebhookPayload(value)) return { status: 400, body: { error: "invalid_event" } };

  try {
    const result = await input.store.record({ id: value.id, receivedAt: now.toISOString(), payload: value });
    return { status: 200, body: result.inserted ? { received: true } : { received: true, duplicate: true } };
  } catch {
    return { status: 503, body: { error: "event_store_unavailable" } };
  }
}
