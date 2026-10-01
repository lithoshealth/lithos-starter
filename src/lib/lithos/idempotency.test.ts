import { describe, expect, it } from "vitest";
import { attemptFrom, stepKeys } from "./idempotency";

const now = new Date("2026-10-01T15:00:00.000Z");
const form = (key: string) => { const f = new FormData(); f.set("idempotency_key", key); return f; };
const KEY = `${now.getTime() - 5_000}-0f0e0d0c-0b0a-4908-8706-050403020100`;

describe("attemptFrom", () => {
  it("takes the form's key, and its time from the key — the moment it was sent", () => {
    expect(attemptFrom(form(KEY), now)).toEqual({ key: KEY, at: new Date(now.getTime() - 5_000) });
  });

  it("makes a fresh attempt when the form sent none, or something that isn't a key", () => {
    for (const sent of [undefined, form(""), form("drop table"), form("123-abc")]) {
      const attempt = attemptFrom(sent, now);
      expect(attempt.at).toEqual(now);
      expect(attempt.key).toMatch(new RegExp(`^${now.getTime()}-[0-9a-f-]{36}$`));
    }
  });

  it("doesn't trust a time from a clock a day off", () => {
    const stale = `${now.getTime() - 2 * 24 * 60 * 60 * 1000}-0f0e0d0c-0b0a-4908-8706-050403020100`;
    expect(attemptFrom(form(stale), now).key).not.toBe(stale);
  });
});

describe("stepKeys", () => {
  it("gives each step of one attempt its own key", () => {
    const key = stepKeys({ key: "a1", at: now });
    expect([key("patient"), key("care-plan")]).toEqual([{ idempotencyKey: "a1:patient" }, { idempotencyKey: "a1:care-plan" }]);
  });
});
