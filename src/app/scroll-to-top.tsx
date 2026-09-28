"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Opens every new page at the top. On a client navigation Next scrolls the new
 * page's content into view, which on the site tucks it under the sticky header
 * and, on a short page like the intake, lands near the end of the form. In the
 * root layout, so it spans both route groups (/setup → / included) and its
 * first render is the document's own load, which it leaves alone.
 *
 * Leaves back/forward alone (the browser restores those) and links to an
 * anchor (`/#plans`), which scroll to their target.
 */
export function ScrollToTop() {
  const pathname = usePathname();
  const popped = useRef(false);
  const first = useRef(true);

  useEffect(() => {
    const onPop = () => { popped.current = true; };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (popped.current) { popped.current = false; return; }
    // A tick later: Next writes the new URL (and its #anchor) after this commit.
    // A timer, not a frame callback — those don't run in a hidden tab.
    const timer = window.setTimeout(() => {
      if (window.location.hash) return;
      // "instant": the stylesheet makes page scrolling smooth, and this should be a cut, not a glide.
      window.scrollTo({ top: 0, behavior: "instant" });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
