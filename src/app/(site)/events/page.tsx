import Link from "next/link";
import { getEventStore } from "@/lib/events/factory";
import { describeFailure, webhookHealth } from "@/lib/webhooks/health";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
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
