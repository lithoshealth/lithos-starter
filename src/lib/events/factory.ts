import { Redis } from "@upstash/redis";
import { MemoryEventStore } from "./memory-store";
import { PostgresEventStore } from "./postgres-store";
import type { EventStore } from "./store";
import { UpstashEventStore } from "./upstash-store";

const globalEventStore = globalThis as typeof globalThis & {
  __eucardiaEventStore?: EventStore;
};

export function createEventStore(env: NodeJS.ProcessEnv = process.env): EventStore {
  // Eucardia's own database is the system of record for events once it exists;
  // the Redis and in-memory stores remain as the sample app's fallbacks.
  if (env.DATABASE_URL) return new PostgresEventStore();

  if (env.VERCEL === "1") {
    const url = env.UPSTASH_REDIS_REST_URL;
    const token = env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error("Deployed event storage requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN");
    }
    return new UpstashEventStore(new Redis({ url, token }));
  }
  return new MemoryEventStore();
}

export function getEventStore(): EventStore {
  globalEventStore.__eucardiaEventStore ??= createEventStore();
  return globalEventStore.__eucardiaEventStore;
}
