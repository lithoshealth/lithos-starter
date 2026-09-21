import { getDb } from "../db";
import type { EventStore, RecordEventResult, StoredEvent } from "./store";

/**
 * Durable, idempotent event log in Eucardia's own database. `id` is Lithos's
 * evt_… so a re-delivery is a no-op insert, which is what makes retries safe.
 * Projection happens after this returns, in the route, so a failed projection
 * still leaves the verified event on record with `process_error` set.
 */
export class PostgresEventStore implements EventStore {
  async record(event: StoredEvent): Promise<RecordEventResult> {
    const sql = getDb();
    const payload = event.payload as { type?: unknown; resource_id?: unknown; created_at?: unknown };
    const result = await sql`
      INSERT INTO webhook_events ${sql({
        id: event.id,
        type: typeof payload.type === "string" ? payload.type : "unknown",
        resource_id: typeof payload.resource_id === "string" ? payload.resource_id : null,
        lithos_created_at: typeof payload.created_at === "string" ? payload.created_at : null,
        received_at: event.receivedAt,
        payload: sql.json(event.payload as unknown as Parameters<typeof sql.json>[0]),
      })}
      ON CONFLICT (id) DO NOTHING`;
    return { inserted: result.count === 1 };
  }

  async list(limit: number): Promise<StoredEvent[]> {
    if (limit <= 0) return [];
    const sql = getDb();
    const rows = await sql<{ id: string; received_at: Date; payload: StoredEvent["payload"] }[]>`
      SELECT id, received_at, payload
        FROM webhook_events
       ORDER BY received_at DESC, id DESC
       LIMIT ${limit}`;
    return rows.map((row) => ({ id: row.id, receivedAt: row.received_at.toISOString(), payload: row.payload }));
  }
}
