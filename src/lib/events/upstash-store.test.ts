import { describe, expect, it, vi } from "vitest";
import type { Redis } from "@upstash/redis";
import { EVENT_LOG_CAP, EVENT_PAYLOAD_TTL_SECONDS, UpstashEventStore } from "./upstash-store";

function redisMock() {
  const redis = {
    eval: vi.fn().mockResolvedValue(1),
    zrange: vi.fn().mockResolvedValue(["evt_b", "evt_a"]),
    mget: vi.fn().mockResolvedValue([{ id: "evt_b", receivedAt: "2026-08-18T12:01:00.000Z", payload: { id: "evt_b" } }, null]),
    zrem: vi.fn().mockResolvedValue(1),
  };
  return { redis: redis as unknown as Redis, raw: redis };
}

describe("UpstashEventStore", () => {
  it("atomically makes SET NX the condition for indexing and trimming", async () => {
    const { redis, raw } = redisMock();
    const store = new UpstashEventStore(redis);
    await expect(store.record({ id: "evt_1", receivedAt: "2026-08-18T12:00:00.000Z", payload: { id: "evt_1" } })).resolves.toEqual({ inserted: true });
    expect(raw.eval).toHaveBeenCalledTimes(1);
    const [script, keys, args] = raw.eval.mock.calls[0];
    expect(script).toContain('redis.call("SET", KEYS[1], ARGV[1], "NX", "EX", ARGV[2])');
    expect(script).toMatch(/if not inserted then\s+return 0/);
    expect(script.indexOf('redis.call("ZADD"')).toBeGreaterThan(script.indexOf("if not inserted"));
    expect(script).toContain('redis.call("ZREMRANGEBYRANK", KEYS[2], 0, ARGV[5])');
    expect(keys).toEqual(["eucardia:webhook-event:evt_1", "eucardia:webhook-events"]);
    expect(args).toEqual([
      JSON.stringify({ id: "evt_1", receivedAt: "2026-08-18T12:00:00.000Z", payload: { id: "evt_1" } }),
      String(EVENT_PAYLOAD_TTL_SECONDS),
      String(Date.parse("2026-08-18T12:00:00.000Z")),
      "evt_1",
      String(-(EVENT_LOG_CAP + 1)),
    ]);
  });

  it("reports a duplicate when SET NX fails, including after its index member was removed", async () => {
    const { redis, raw } = redisMock();
    raw.eval.mockResolvedValue(0);

    await expect(new UpstashEventStore(redis).record({
      id: "evt_trimmed",
      receivedAt: "2026-08-18T12:02:00.000Z",
      payload: { id: "evt_trimmed" },
    })).resolves.toEqual({ inserted: false });

    expect(raw.eval).toHaveBeenCalledTimes(1);
    expect(raw.eval.mock.calls[0][0]).toMatch(/if not inserted then\s+return 0/);
  });

  it("bulk reads newest-first records and lazily removes expired payload members", async () => {
    const { redis, raw } = redisMock();
    const records = await new UpstashEventStore(redis).list(100);
    expect(raw.zrange).toHaveBeenCalledWith("eucardia:webhook-events", 0, 99, { rev: true });
    expect(raw.mget).toHaveBeenCalledWith("eucardia:webhook-event:evt_b", "eucardia:webhook-event:evt_a");
    expect(raw.zrem).toHaveBeenCalledWith("eucardia:webhook-events", "evt_a");
    expect(records.map(({ id }) => id)).toEqual(["evt_b"]);
  });
});
