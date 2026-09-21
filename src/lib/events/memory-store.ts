import type { EventStore, RecordEventResult, StoredEvent } from "./store";

export class MemoryEventStore implements EventStore {
  private readonly events = new Map<string, StoredEvent>();

  async record(event: StoredEvent): Promise<RecordEventResult> {
    if (this.events.has(event.id)) return { inserted: false };
    this.events.set(event.id, structuredClone(event));
    if (this.events.size > 1_000) {
      const oldest = this.sorted().slice(1_000);
      oldest.forEach((item) => this.events.delete(item.id));
    }
    return { inserted: true };
  }

  async list(limit: number): Promise<StoredEvent[]> {
    return this.sorted().slice(0, Math.max(0, limit)).map((event) => structuredClone(event));
  }

  private sorted(): StoredEvent[] {
    return [...this.events.values()].sort((left, right) => {
      const byTime = right.receivedAt.localeCompare(left.receivedAt);
      return byTime || right.id.localeCompare(left.id);
    });
  }
}
