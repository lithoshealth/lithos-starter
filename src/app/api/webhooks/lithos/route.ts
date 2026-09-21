import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { getEventStore } from "@/lib/events/factory";
import { markProcessed, projectEvent, type WebhookPayload } from "@/lib/projections";
import { outcomeFor, recordWebhookAttempt } from "@/lib/webhooks/attempts";
import { handleLithosWebhook } from "@/lib/webhooks/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  let store;
  try {
    store = getEventStore();
  } catch {
    recordWebhookAttempt("event_store_unavailable");
    return NextResponse.json({ error: "event_store_not_configured" }, { status: 503 });
  }

  const result = await handleLithosWebhook({
    rawBody,
    signatureHeader: request.headers.get("x-lithos-signature"),
    signingSecret: process.env.LITHOS_WEBHOOK_SECRET,
    store,
  });
  // Every attempt, accepted or not — /setup uses this to tell a bad secret
  // apart from a request that never reached the app.
  recordWebhookAttempt(outcomeFor(result));

  // Only a freshly recorded, signature-verified event gets projected. A failed
  // projection is recorded against the event, never hidden — and the delivery
  // is still acknowledged, because Lithos retrying won't fix a local problem.
  if (result.status === 200 && result.body.received && !result.body.duplicate && isDbConfigured()) {
    const payload = JSON.parse(rawBody) as WebhookPayload;
    try {
      await projectEvent(payload);
      await markProcessed(payload.id);
    } catch (error) {
      await markProcessed(payload.id, error instanceof Error ? error.message : String(error)).catch(() => undefined);
    }
  }

  return NextResponse.json(result.body, { status: result.status });
}
