import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { STEP_SOURCES } from "@/lib/setup/requests";
import { readJourneyIds } from "@/lib/setup/journey-cookie";
import { evaluateSetup, type StepState } from "@/lib/setup/steps";
import { sendTestEventAction } from "../actions";
import { BADGE, Diagnosis, Exchanges } from "../parts";
import { NewSecretForm, RepointForm, StepAction, WebhookForm } from "../step-actions";
import { DeliveryGuide, EndpointGuide } from "../webhook-guide";

export const metadata: Metadata = { title: "Webhooks" };
export const dynamic = "force-dynamic";

/**
 * Webhooks: the one part of the integration you set up rather than try. A
 * public address for this app, registered with Lithos, the signing secret in
 * .env.local, and a test event to prove the app receives and verifies it.
 */
export default async function WebhooksPage() {
  const ids = await readJourneyIds();
  const host = (await headers()).get("host");
  const isLocal = !host || /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
  const steps = await evaluateSetup(ids);
  const updates = steps.find((s) => s.key === "updates") as StepState;
  // The endpoint, when it reaches this app — re-registering it gets a new secret.
  const endpointHere = updates.endpoint?.pointsHere ? updates.endpoint : undefined;

  return (
    <section className="stack setup">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Lithos sandbox</p>
          <h1>Webhooks</h1>
          <p className="lede">
            How your app hears that something changed: a decision, a prescription, a delivery. Every one received is in
            the <Link href="/events">webhook log</Link>.
          </p>
        </div>
      </div>

      <article id="webhooks" className={`card setup-step setup-step-${updates.status}`}>
        <div className="setup-step-head">
          <div className="setup-step-title">
            <h2>Your endpoint</h2>
            <p className="muted">{updates.summary}</p>
          </div>
          <span className={`badge ${BADGE[updates.status].className}`}>{BADGE[updates.status].label}</span>
        </div>
        {updates.status !== "locked" && (
          <>
            <p>
              Lithos tells your app when something changes, with a signed webhook your app verifies before re-reading the
              resource. Webhooks need a public HTTPS address: a deploy or a tunnel.
            </p>
            {updates.setupDone && process.env.LITHOS_WEBHOOK_SECRET && (
              <StepAction step="updates" action={sendTestEventAction} label="Send a test event" pendingLabel="Asking Lithos to send one…" variant={updates.status === "done" ? "ghost" : "primary"} />
            )}
            {(updates.feed?.length ?? 0) > 0 && (
              <details className="setup-detail">
                <summary>What your app heard about your latest patient ({updates.feed!.length})</summary>
                <ol className="updates-feed">
                  {updates.feed!.map((item, i) => (
                    <li key={`${item.at}-${i}`}>
                      <time dateTime={item.at}>{new Date(item.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}</time>
                      <span>{item.label}</span>
                      <code>{item.type}</code>
                    </li>
                  ))}
                </ol>
              </details>
            )}
            <details id="webhook-setup" className="setup-detail" open={!updates.setupDone || updates.status === "blocked"}>
              <summary>{updates.setupDone ? "Your endpoint" : "Set up your endpoint"}</summary>
              <p className="muted">{updates.endpointSummary}</p>
              <Diagnosis step={updates} />
              {!updates.endpoint && (
                <>
                  <EndpointGuide />
                  <WebhookForm defaultUrl={isLocal ? "" : `https://${host}`} />
                </>
              )}
              {updates.endpoint && !updates.endpoint.pointsHere && (
                <RepointForm currentId={updates.endpoint.id} currentUrl={updates.endpoint.url} defaultUrl={isLocal ? "" : `https://${host}`}>
                  <EndpointGuide />
                </RepointForm>
              )}
              {updates.setupDone && !process.env.LITHOS_WEBHOOK_SECRET && (
                <>
                  <DeliveryGuide />
                  {endpointHere && <NewSecretForm currentId={endpointHere.id} url={endpointHere.url} />}
                </>
              )}
            </details>
            <Exchanges step={updates} />
            <p className="fine-print">Code: <code>{STEP_SOURCES.updates}</code></p>
          </>
        )}
      </article>

    </section>
  );
}
