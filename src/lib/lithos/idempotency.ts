/**
 * Idempotency keys: send the same key again and Lithos replays the first answer
 * instead of creating a second patient, care plan, encounter, conversation or
 * message. A request that failed stores nothing, so it can be sent again with
 * the same key. Lithos keeps keys for 30 days.
 *
 * A key belongs to one attempt — a form as it was submitted, a script run —
 * and Lithos refuses it for a different body. So the attempt fixes its body
 * too: the time a patient consents is the time in the key, and a sample
 * patient's external id comes from it. Send it twice, and both copies match.
 *
 * Forms stamp theirs when they're submitted (app/idempotency-field.tsx):
 * `<milliseconds>-<uuid>`.
 */

const FIELD = "idempotency_key";
const STAMPED = /^(\d{13})-[0-9a-f-]{36}$/;
const HOUR = 60 * 60 * 1000;

export type Attempt = {
  key: string;
  /** When the attempt was made — its consent and attestation time. */
  at: Date;
};

/** The submitted form's attempt, or a fresh one when it didn't carry a key. */
export function attemptFrom(formData?: FormData, now: Date = new Date()): Attempt {
  const key = String(formData?.get(FIELD) ?? "").trim();
  const stamped = STAMPED.exec(key);
  // A key from a browser clock far off, or from long ago, isn't trusted for the time.
  if (stamped && Math.abs(now.getTime() - Number(stamped[1])) < 24 * HOUR) return { key, at: new Date(Number(stamped[1])) };
  return newAttempt(now);
}

export function newAttempt(now: Date = new Date()): Attempt {
  return { key: `${now.getTime()}-${crypto.randomUUID()}`, at: now };
}

/**
 * One key per step of a multi-step attempt — patient, then care plan, then
 * encounter. If the encounter fails after the patient was made, sending the
 * attempt again replays the patient rather than making a second one.
 */
export function stepKeys(attempt: Attempt): (step: string) => { idempotencyKey: string } {
  return (step) => ({ idempotencyKey: `${attempt.key}:${step}` });
}
