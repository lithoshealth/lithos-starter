"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * A page of the real app, inside the setup page — so the effect of each choice
 * is visible where the choice is made, without navigating away.
 *
 * Two kinds:
 * - a picture (default): the page at desktop width (1280px), scaled to fit its
 *   box, not clickable — for the brand and the program.
 * - `interactive`: the page at phone width, full size and usable — for the
 *   intake, which the prospect fills in themselves as their first patient.
 *
 * `refreshOn`: when the framed page moves to a path starting with this (the
 * intake landing on /care/…), re-render the setup page so its steps pick up
 * what was just created.
 *
 * Remount it (change its `key`) to show a fresh render.
 */
export function LivePreview({ path, caption, interactive = false, refreshOn }: { path: string; caption?: string; interactive?: boolean; refreshOn?: string }) {
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || interactive) return;
    const fit = () => box.style.setProperty("--preview-scale", String(box.clientWidth / 1280));
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
      <div ref={boxRef} className={interactive ? "phone-preview" : "brand-preview"} aria-label={caption ?? "Live preview of your app"}>
        <iframe ref={frameRef} src={path} title={caption ?? "Your app"} tabIndex={interactive ? 0 : -1} />
      </div>
      {caption && <figcaption className="muted">{caption}</figcaption>}
    </figure>
  );
}
