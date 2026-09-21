"use client";

import { useEffect, useRef } from "react";

/**
 * Bring a form's feedback into view when it changes.
 *
 * The long forms render their feedback — a validation error, or "not connected
 * to Lithos yet" — above the fields, while the visitor is at the bottom by the
 * submit button. Without this, a submit that fails looks like a submit that did
 * nothing. Attach the returned ref to the feedback area.
 *
 * Offsets by the sticky header's real height rather than a fixed margin: on a
 * narrow screen the header wraps to two lines and would cover the message.
 */
export function useScrollToFeedback<T>(state: T, hasFeedback: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = ref.current;
    if (!hasFeedback || !target) return;
    const header = document.querySelector<HTMLElement>(".site-header");
    const offset = (header?.offsetHeight ?? 0) + 16;
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - offset, behavior: "smooth" });
  }, [state, hasFeedback]);
  return ref;
}
