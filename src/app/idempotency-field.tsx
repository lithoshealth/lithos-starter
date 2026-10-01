"use client";

import { useEffect, useRef } from "react";

/** `<milliseconds>-<uuid>`: when the attempt was made, and which one. */
export const newAttemptKey = () => `${Date.now()}-${crypto.randomUUID()}`;

/**
 * A form's idempotency key (lib/lithos/idempotency.ts), stamped when the form
 * is submitted. A double click submits again with the same key, so Lithos
 * makes one record. `renewOn` is the form's action state — each answer clears
 * the key, and the next submit is a new attempt.
 */
export function IdempotencyField({ renewOn }: { renewOn?: unknown }) {
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const input = field.current;
    const form = input?.form;
    if (!input || !form) return;
    input.value = "";
    // Capture runs before React reads the form, so the key is in what it sends.
    const stamp = () => { if (!input.value) input.value = newAttemptKey(); };
    form.addEventListener("submit", stamp, true);
    return () => form.removeEventListener("submit", stamp, true);
  }, [renewOn]);
  return <input ref={field} type="hidden" name="idempotency_key" defaultValue="" />;
}
