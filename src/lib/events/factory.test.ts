import { describe, expect, it } from "vitest";
import { createEventStore } from "./factory";
import { MemoryEventStore } from "./memory-store";

function env(values: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", ...values } as NodeJS.ProcessEnv;
}

describe("createEventStore", () => {
  it("uses memory only outside Vercel", () => {
    expect(createEventStore(env())).toBeInstanceOf(MemoryEventStore);
  });

  it.each([
    { VERCEL: "1" },
    { VERCEL: "1", UPSTASH_REDIS_REST_URL: "https://example.upstash.io" },
    { VERCEL: "1", UPSTASH_REDIS_REST_TOKEN: "synthetic-token" },
  ])("fails loudly for incomplete deployed Redis configuration", (values) => {
    expect(() => createEventStore(env(values))).toThrow("UPSTASH_REDIS_REST_URL");
  });
});
