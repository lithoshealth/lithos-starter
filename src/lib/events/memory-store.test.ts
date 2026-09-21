import { describe, expect, it } from "vitest";
import { MemoryEventStore } from "./memory-store";
import type { StoredEvent } from "./store";

function event(id: string, receivedAt: string): StoredEvent {
  return { id, receivedAt, payload: { id, type: "test.event" } };
}

describe("MemoryEventStore", () => {
  it("preserves the first duplicate and lists newest first with an ID tie-breaker", async () => {
    const store = new MemoryEventStore();
    await expect(store.record(event("evt_a", "2026-08-18T12:00:00.000Z"))).resolves.toEqual({ inserted: true });
    await store.record(event("evt_b", "2026-08-18T12:01:00.000Z"));
    await store.record(event("evt_c", "2026-08-18T12:01:00.000Z"));
    await expect(store.record(event("evt_a", "2026-08-18T13:00:00.000Z"))).resolves.toEqual({ inserted: false });

    expect((await store.list(10)).map(({ id }) => id)).toEqual(["evt_c", "evt_b", "evt_a"]);
    expect((await store.list(10))[2].receivedAt).toBe("2026-08-18T12:00:00.000Z");
  });
});
