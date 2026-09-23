"use client";

import { useEffect, useRef } from "react";

/**
 * A page of the real app, rendered at desktop width (1280px) and scaled to fit
 * its box. The setup page puts one next to each choice that changes the app —
 * the brand, the program, the intake — so the effect is visible where the
 * choice is made. Remount it (change its `key`) to show a fresh render.
 */
export function LivePreview({ path, caption }: { path: string; caption?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const fit = () => box.style.setProperty("--preview-scale", String(box.clientWidth / 1280));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  return (
    <figure className="live-preview">
      <div ref={boxRef} className="brand-preview" aria-label={caption ?? "Live preview of your app"}>
        <iframe src={path} title={caption ?? "Your app"} tabIndex={-1} />
        <a className="brand-preview-open" href={path} target="_blank" rel="noopener">Open ↗</a>
      </div>
      {caption && <figcaption className="muted">{caption}</figcaption>}
    </figure>
  );
}
