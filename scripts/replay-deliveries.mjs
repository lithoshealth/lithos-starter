// Catch up from Lithos's delivery log — the reconciliation path the webhooks
// guide describes for recovering after an outage on the partner's side.
//
//   npm run replay                # pull new deliveries from Lithos and project them
//   npm run replay -- --reproject # re-run every stored event through the projector
//
// Registered webhooks are delivered to the DEPLOYED app, so this local database
// never receives them live. Instead, read `GET /v1/webhook_deliveries`, record
// each delivery in webhook_events (idempotent on the delivery id), and project
// the resource it names by re-reading it — exactly what the live route does.
//
// A delivery for a patient Eucardia doesn't know lands as process_error rather
// than vanishing; the Sample-App-era patients are expected to show up that way.
//
// --reproject rebuilds the read model from the log after a projector change,
// oldest first, and clears process_error where a re-run now succeeds (e.g. a
// member linked since). Idempotent: every write is an upsert.
try { const { loadEnvConfig } = await import("@next/env"); loadEnvConfig(process.cwd()); } catch {}
import { getLithosClient } from "../src/lib/lithos/client";
import { PostgresEventStore } from "../src/lib/events/postgres-store";
import { markProcessed, projectEvent } from "../src/lib/projections";
import { getDb } from "../src/lib/db";

for (const name of ["DATABASE_URL", "LITHOS_CLIENT_ID", "LITHOS_CLIENT_SECRET"]) {
  if (!process.env[name]) { console.error(`${name} is not set.`); process.exit(1); }
}

if (process.argv.includes("--reproject")) {
  const sql = getDb();
  const rows = await sql`SELECT id, payload FROM webhook_events ORDER BY lithos_created_at NULLS LAST, received_at`;
  console.log(`\nre-projecting ${rows.length} stored events\n`);
  const tally = { projected: 0, skipped: 0, failed: 0 };
  for (const row of rows) {
    try {
      const outcome = await projectEvent(row.payload);
      await markProcessed(row.id);
      if ("projected" in outcome) { tally.projected++; console.log(`  ✓ ${row.payload.type.padEnd(24)} ${outcome.projected}`); }
      else { tally.skipped++; }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await markProcessed(row.id, message);
      tally.failed++;
    }
  }
  console.log(`\nprojected ${tally.projected} · skipped ${tally.skipped} · failed ${tally.failed}`);
  const [errs] = await sql`SELECT count(*)::int AS n FROM webhook_events WHERE process_error IS NOT NULL`;
  console.log(`webhook_events with process_error (unreconciled): ${errs.n}\n`);
  await sql.end();
  process.exit(0);
}

const client = getLithosClient();
const store = new PostgresEventStore();
const deliveries = [];
let cursor;
do {
  const query = new URLSearchParams({ limit: "100" });
  if (cursor) query.set("cursor", cursor);
  const page = await client.get(`/v1/webhook_deliveries?${query}`);
  deliveries.push(...page.data);
  cursor = page.pagination?.has_more ? page.pagination.next_cursor : undefined;
} while (cursor);

// Oldest first, so projections see state in the order it happened.
deliveries.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
console.log(`\n${deliveries.length} deliveries in Lithos's log\n`);

const tally = { new: 0, seen: 0, projected: 0, skipped: 0, failed: 0 };
for (const d of deliveries) {
  const payload = { id: d.id, type: d.event_type, resource_id: d.resource_id, created_at: d.occurred_at, ...(d.data ?? {}) };
  const { inserted } = await store.record({ id: d.id, receivedAt: new Date().toISOString(), payload });
  if (!inserted) { tally.seen++; continue; }
  tally.new++;
  try {
    const outcome = await projectEvent(payload);
    await markProcessed(d.id);
    if ("projected" in outcome) { tally.projected++; console.log(`  ✓ ${d.event_type.padEnd(24)} ${outcome.projected}`); }
    else { tally.skipped++; console.log(`  · ${d.event_type.padEnd(24)} ${outcome.skipped}`); }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markProcessed(d.id, message);
    tally.failed++;
    console.log(`  ✗ ${d.event_type.padEnd(24)} ${d.resource_id}  →  ${message}`);
  }
}

console.log(`\nnew ${tally.new} · already seen ${tally.seen} · projected ${tally.projected} · skipped ${tally.skipped} · failed ${tally.failed}`);
const sql = getDb();
const [errs] = await sql`SELECT count(*)::int AS n FROM webhook_events WHERE process_error IS NOT NULL`;
console.log(`webhook_events with process_error (unreconciled): ${errs.n}\n`);
await sql.end();
