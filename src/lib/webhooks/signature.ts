import { createHmac, timingSafeEqual } from "node:crypto";

export const WEBHOOK_TOLERANCE_SECONDS = 300;

type VerificationResult = { ok: true; timestamp: number } | { ok: false; reason: string };

export function verifyLithosSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1_000),
): VerificationResult {
  if (!signatureHeader) return { ok: false, reason: "missing_signature" };

  let timestamp: number | undefined;
  const signatures: string[] = [];
  for (const part of signatureHeader.split(",")) {
    const [key, value, ...rest] = part.trim().split("=");
    if (rest.length > 0 || !value) return { ok: false, reason: "malformed_signature" };
    if (key === "t") {
      if (timestamp !== undefined || !/^\d+$/.test(value)) return { ok: false, reason: "malformed_signature" };
      timestamp = Number(value);
    } else if (key === "v1") {
      if (!/^[a-fA-F0-9]{64}$/.test(value)) return { ok: false, reason: "malformed_signature" };
      signatures.push(value.toLowerCase());
    }
  }

  if (timestamp === undefined || !Number.isSafeInteger(timestamp) || signatures.length === 0) {
    return { ok: false, reason: "malformed_signature" };
  }
  if (Math.abs(nowSeconds - timestamp) > WEBHOOK_TOLERANCE_SECONDS) {
    return { ok: false, reason: "timestamp_outside_tolerance" };
  }

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest();
  const matches = signatures.some((signature) => timingSafeEqual(expected, Buffer.from(signature, "hex")));
  return matches ? { ok: true, timestamp } : { ok: false, reason: "signature_mismatch" };
}

export function signSyntheticWebhook(rawBody: string, secret: string, timestamp: number): string {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
  return `t=${timestamp},v1=${signature}`;
}
