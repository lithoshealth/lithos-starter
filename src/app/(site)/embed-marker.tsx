"use client";

import { useEffect } from "react";

/**
 * Marks the page when it's shown inside /setup's previews (an iframe), so the
 * developer bar — which a patient never sees — can step aside there.
 */
export function EmbedMarker() {
  useEffect(() => {
    if (window.self !== window.top) document.documentElement.dataset.embedded = "true";
  }, []);
  return null;
}
