"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * A page of the real app, inside the setup page — so the effect of each choice
 * is visible where the choice is made, without navigating away.
 *
 * Both render the page at desktop width, scaled to fit their box:
 * - a picture (default): 1280px wide, not clickable — for the brand and the
 *   program.
 * - `interactive`: 1024px wide (a small laptop — still the desktop layout, and
 *   large enough to read and fill in once scaled), in a browser window, and
 *   usable — for the intake, which the prospect fills in as their first patient.
 *
 * `refreshOn`: when the framed page moves to a path starting with this (the
 * intake landing on /care/…), re-render the setup page so its steps pick up
 * what was just created.
 *
 * Remount it (change its `key`) to show a fresh render.
 */
const FRAME_WIDTH = { picture: 1280, interactive: 1024 };

export function LivePreview({ path, caption, interactive = false, refreshOn }: { path: string; caption?: string; interactive?: boolean; refreshOn?: string }) {
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const width = interactive ? FRAME_WIDTH.interactive : FRAME_WIDTH.picture;
    const fit = () => box.style.setProperty("--preview-scale", String(box.clientWidth / width));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, [interactive]);

  // The app moves between pages without full reloads (a form's redirect is a
  // client-side navigation), so the frame's load event doesn't fire. Watch its
  // address instead — same origin, so it's readable — and refresh this page
  // when it arrives somewhere that means something was created.
  useEffect(() => {
    if (!refreshOn) return;
    let last = "";
    const timer = window.setInterval(() => {
      let current = "";
      try {
        current = frameRef.current?.contentWindow?.location.pathname ?? "";
      } catch {
        return;
      }
      if (current !== last) {
        if (current.startsWith(refreshOn) && last !== "") router.refresh();
        last = current;
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [refreshOn, router]);

  return (
    <figure className={interactive ? "live-preview live-preview-interactive" : "live-preview"}>
      {interactive && (
        // A browser window's top bar, so it reads as your website rather than a picture of it.
        <div className="browser-bar" aria-hidden="true"><span /><span /><span /><code>{path}</code></div>
      )}
      <div ref={boxRef} className={interactive ? "brand-preview browser-preview" : "brand-preview"} aria-label={caption ?? "Live preview of your app"}>
        <iframe ref={frameRef} src={path} title={caption ?? "Your app"} tabIndex={interactive ? 0 : -1} />
      </div>
      {caption && <figcaption className="muted">{caption}</figcaption>}
    </figure>
  );
}
