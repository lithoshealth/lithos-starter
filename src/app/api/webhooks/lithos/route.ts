import { NextResponse, after } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { getEventStore } from "@/lib/events/factory";
import { getLithosClient } from "@/lib/lithos/client";
import { notifyPatient } from "@/lib/notifications/notify";
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

  // Answer Lithos now; do the work after. Only a freshly recorded, verified
  // event is processed — a re-delivery was processed the first time. Lithos
  // retrying won't fix a local problem, so a failure is recorded against the
  // event (`npm run replay -- --reproject` runs it again), never hidden.
  if (result.status === 200 && result.body.received && !result.body.duplicate) {
    const payload = JSON.parse(rawBody) as WebhookPayload;
    const appUrl = process.env.APP_URL || new URL(request.url).origin;
    after(async () => {
      if (isDbConfigured()) {
        try {
          await projectEvent(payload);
          await markProcessed(payload.id);
        } catch (error) {
          await markProcessed(payload.id, error instanceof Error ? error.message : String(error)).catch(() => undefined);
        }
      }
      // The patient hears about it whether or not there's a database: their
      // contact details are on the Lithos patient.
      // Logged by event id and outcome only — no patient details in logs.
      await notifyPatient(payload, getLithosClient(), appUrl).then(
        (outcome) => console.info(`notify ${payload.id} (${payload.type}): ${"skipped" in outcome ? `skipped, ${outcome.skipped}` : `${outcome.via}${outcome.error ? ` failed, ${outcome.error}` : ""}`}`),
        (error) => console.error(`notify ${payload.id} (${payload.type}): failed, ${error instanceof Error ? error.message : error}`),
      );
    });
  }

  return NextResponse.json(result.body, { status: result.status });
}
