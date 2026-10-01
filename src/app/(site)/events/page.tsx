import { sandboxOpsOnly } from "@/lib/ops-guard";
import Link from "next/link";
import { getEventStore } from "@/lib/events/factory";
import { describeFailure, webhookHealth } from "@/lib/webhooks/health";
import { listOutbox } from "@/lib/notifications/notifier";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  sandboxOpsOnly();
  let events;
  try {
    events = await getEventStore().list(100);
  } catch {
    return <section className="panel error-box stack"><h1>Event store unavailable</h1><p>The deployed app requires both Upstash Redis environment variables.</p></section>;
  }

  // Shown on deployed copies too: this page lists what arrived, so it should also say when nothing can.
  const health = await webhookHealth();

  return (
    <section className="panel stack">
      {health.state === "failing" && (
        <div className="error-box">
          <h2>Lithos can&rsquo;t deliver to your endpoint</h2>
          <p>{describeFailure(health)} Deliveries that fail are retried, then dropped — and Lithos doesn&rsquo;t tell anyone. <Link href="/setup">Check your endpoint in setup →</Link></p>
        </div>
      )}
      <PatientNotifications />

      <p className="eyebrow">Verified deliveries only</p>
      <h1>Webhook event log</h1>
      <p>Newest first. The log stores event IDs, receive times, and payloads—not delivery headers or secrets.</p>
      {events.length === 0 ? <p>No verified webhook events received yet.</p> : events.map((event) => (
        <article className="event" key={event.id}>
          <h2>{typeof event.payload.type === "string" ? event.payload.type : "Webhook event"}</h2>
          <p><strong>ID:</strong> <code>{event.id}</code><br /><strong>Received:</strong> {event.receivedAt}</p>
          <pre>{JSON.stringify(event.payload, null, 2)}</pre>
        </article>
      ))}
    </section>
  );
}

/**
 * What patients were told about those events — sent, or kept in the outbox
 * when no email provider is set (lib/notifications/notifier.ts).
 */
function PatientNotifications() {
  const sent = listOutbox();
  return (
    <section className="stack" aria-label="Patient notifications">
      <p className="eyebrow">Patient notifications</p>
      <h2>What patients were told</h2>
      {sent.length === 0 ? (
        <p className="muted">Nothing yet. When an event is the patient&rsquo;s to know — a message from the care team, a shipped order — it shows here.</p>
      ) : (
        <ul className="outbox">
          {sent.map((n) => (
            <li key={`${n.eventId}-${n.at}`}>
              <strong>{n.message.subject}</strong>
              <span className="muted">
                {n.via === "email" ? (n.error ? `Email to ${n.to.email ?? n.to.name} failed: ${n.error}` : `Emailed ${n.to.email}`) : `Outbox — would email ${n.to.name}${n.to.email ? ` (${n.to.email})` : ""}`}
                {" · "}{n.eventType} · {new Date(n.at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
              </span>
              <span>{n.message.body} <a href={n.message.url}>{n.message.url}</a></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
