import type { Redis } from "@upstash/redis";
import type { EventStore, RecordEventResult, StoredEvent } from "./store";

export const EVENT_PAYLOAD_TTL_SECONDS = 30 * 24 * 60 * 60;
export const EVENT_LOG_CAP = 1_000;
const INDEX_KEY = "eucardia:webhook-events";
const PAYLOAD_PREFIX = "eucardia:webhook-event:";
const RECORD_EVENT_SCRIPT = `
local inserted = redis.call("SET", KEYS[1], ARGV[1], "NX", "EX", ARGV[2])
if not inserted then
  return 0
end
redis.call("ZADD", KEYS[2], "NX", ARGV[3], ARGV[4])
redis.call("ZREMRANGEBYRANK", KEYS[2], 0, ARGV[5])
return 1
`;

export class UpstashEventStore implements EventStore {
  constructor(private readonly redis: Redis) {}

  async record(event: StoredEvent): Promise<RecordEventResult> {
    const score = Date.parse(event.receivedAt);
    if (!Number.isFinite(score)) throw new Error("Event receivedAt must be an ISO timestamp");

    const inserted = await this.redis.eval<[string, string, string, string, string], number>(
      RECORD_EVENT_SCRIPT,
      [`${PAYLOAD_PREFIX}${event.id}`, INDEX_KEY],
      [
        JSON.stringify(event),
        String(EVENT_PAYLOAD_TTL_SECONDS),
        String(score),
        event.id,
        String(-(EVENT_LOG_CAP + 1)),
      ],
    );

    return { inserted: inserted === 1 };
  }

  async list(limit: number): Promise<StoredEvent[]> {
    if (limit <= 0) return [];
    const eventIds = await this.redis.zrange<string[]>(INDEX_KEY, 0, limit - 1, { rev: true });
    if (eventIds.length === 0) return [];

    const values = await this.redis.mget<StoredEvent[]>(...eventIds.map((id) => `${PAYLOAD_PREFIX}${id}`));
    const staleIds: string[] = [];
    const records: StoredEvent[] = [];
    values.forEach((value, index) => {
      if (value) records.push(value);
      else staleIds.push(eventIds[index]);
    });
    if (staleIds.length > 0) await this.redis.zrem(INDEX_KEY, ...staleIds);
    return records;
  }
}
