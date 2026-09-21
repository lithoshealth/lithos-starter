import { describe, expect, it } from "vitest";
import { signSyntheticWebhook, verifyLithosSignature } from "./signature";

const secret = "synthetic-test-signing-secret";
const now = 1_800_000_000;
const rawBody = '{"id":"evt_1", "type":"encounter.created"}';

describe("verifyLithosSignature", () => {
  it("verifies the exact raw body", () => {
    const header = signSyntheticWebhook(rawBody, secret, now);
    expect(verifyLithosSignature(rawBody, header, secret, now)).toEqual({ ok: true, timestamp: now });
    expect(verifyLithosSignature(rawBody.replace(", ", ","), header, secret, now)).toMatchObject({ ok: false });
  });

  it.each([
    ["missing", null],
    ["malformed timestamp", "t=nope,v1=" + "a".repeat(64)],
    ["wrong length", `t=${now},v1=abcd`],
    ["wrong digest", `t=${now},v1=${"a".repeat(64)}`],
  ])("rejects %s signatures", (_label, header) => {
    expect(verifyLithosSignature(rawBody, header, secret, now)).toMatchObject({ ok: false });
  });

  it("rejects stale and too-far-future timestamps but accepts tolerance boundaries", () => {
    for (const timestamp of [now - 301, now + 301]) {
      expect(verifyLithosSignature(rawBody, signSyntheticWebhook(rawBody, secret, timestamp), secret, now)).toEqual({ ok: false, reason: "timestamp_outside_tolerance" });
    }
    for (const timestamp of [now - 300, now + 300]) {
      expect(verifyLithosSignature(rawBody, signSyntheticWebhook(rawBody, secret, timestamp), secret, now).ok).toBe(true);
    }
  });
});
