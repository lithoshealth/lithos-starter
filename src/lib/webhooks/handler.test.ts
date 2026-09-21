import { describe, expect, it, vi } from "vitest";
import type { EventStore } from "../events/store";
import { handleLithosWebhook } from "./handler";
import { signSyntheticWebhook } from "./signature";

const now = new Date("2026-08-18T12:00:00.000Z");
const timestamp = Math.floor(now.getTime() / 1_000);
const secret = "synthetic-test-secret";
const rawBody = JSON.stringify({ id: "evt_1", type: "encounter.created", created_at: now.toISOString(), resource_id: "enc_1" });

function store(inserted = true): EventStore & { record: ReturnType<typeof vi.fn> } {
  return { record: vi.fn().mockResolvedValue({ inserted }), list: vi.fn() };
}

describe("handleLithosWebhook", () => {
  it("stores a verified payload without headers", async () => {
    const eventStore = store();
    const result = await handleLithosWebhook({ rawBody, signatureHeader: signSyntheticWebhook(rawBody, secret, timestamp), signingSecret: secret, store: eventStore, now });
    expect(result).toEqual({ status: 200, body: { received: true } });
    expect(eventStore.record).toHaveBeenCalledWith({ id: "evt_1", receivedAt: now.toISOString(), payload: JSON.parse(rawBody) });
    expect(JSON.stringify(eventStore.record.mock.calls)).not.toContain("x-lithos-signature");
  });

  it.each([
    ["missing secret", undefined, signSyntheticWebhook(rawBody, secret, timestamp), 503],
    ["missing signature", secret, null, 401],
    ["wrong signature", secret, `t=${timestamp},v1=${"a".repeat(64)}`, 401],
  ])("rejects %s without touching storage", async (_label, signingSecret, signatureHeader, status) => {
    const eventStore = store();
    const result = await handleLithosWebhook({ rawBody, signatureHeader, signingSecret, store: eventStore, now });
    expect(result.status).toBe(status);
    expect(eventStore.record).not.toHaveBeenCalled();
  });

  it("acknowledges a valid duplicate without storing it twice", async () => {
    const eventStore = store(false);
    const result = await handleLithosWebhook({ rawBody, signatureHeader: signSyntheticWebhook(rawBody, secret, timestamp), signingSecret: secret, store: eventStore, now });
    expect(result).toEqual({ status: 200, body: { received: true, duplicate: true } });
  });
});
