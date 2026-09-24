"use client";

import { useActionState, useState } from "react";
import type { SiteImport } from "@/lib/setup/site-import";
import { importWebsiteAction, type ImportState } from "./brand-actions";

export type BrandChoice = {
  name?: string;
  tagline?: string;
  color?: string;
  font?: { family: string; css: string } | null;
  /** A light page background from their site. */
  background?: string;
  /** A logo as a PNG/JPEG/WebP file, ready to upload. */
  logo?: File;
};

/**
 * "Import from your website": the prospect's URL in, their brand out — as
 * suggestions. Each one can be switched off, the colours and logos are picked
 * from what was found, and nothing changes until Apply.
 */
export function WebsiteImport({ onApply, disabled }: { onApply: (choice: BrandChoice) => Promise<void>; disabled: boolean }) {
  const [state, run, reading] = useActionState(importWebsiteAction, { status: "idle" } as ImportState);
  return (
    <div className="website-import stack">
      <form action={run} className="website-import-form">
        <label className="field">
          Import from your website
          <span className="website-import-row">
            <input name="website" placeholder="yourcompany.com" autoComplete="off" spellCheck={false} disabled={disabled || reading} required />
            <button type="submit" className="btn btn-ghost" disabled={disabled || reading}>{reading ? "Reading…" : "Import"}</button>
          </span>
          <small>We read your name, tagline, colours, font and logo from your site. You choose what to keep.</small>
        </label>
      </form>
      {state.status === "error" && <p className="error-text">{state.message}</p>}
      {state.status === "found" && <Suggestions key={state.result.url} found={state.result} onApply={onApply} />}
    </div>
  );
}

function Suggestions({ found, onApply }: { found: SiteImport; onApply: (choice: BrandChoice) => Promise<void> }) {
  const [useName, setUseName] = useState(Boolean(found.name));
  const [useTagline, setUseTagline] = useState(Boolean(found.tagline));
  const [color, setColor] = useState<string | undefined>(found.colors[0]);
  const [useFont, setUseFont] = useState(Boolean(found.font));
  const [useBackground, setUseBackground] = useState(Boolean(found.background?.usable));
  const [logo, setLogo] = useState<number | null>(found.logos.length > 0 ? 0 : null);
  const [applying, setApplying] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function apply() {
    setApplying(true);
    setDone(null);
    try {
      const picked = logo === null ? undefined : found.logos[logo];
      await onApply({
        name: useName ? found.name : undefined,
        tagline: useTagline ? found.tagline : undefined,
        color,
        font: useFont ? found.font : undefined,
        background: useBackground && found.background?.usable ? found.background.color : undefined,
        logo: picked ? await logoFile(picked.dataUrl, picked.svg) : undefined,
      });
      setDone("Applied — your app now wears it.");
    } catch (error) {
      setDone(error instanceof Error ? error.message : "Couldn't apply the logo.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <section className="website-found" aria-label={`What we found on ${new URL(found.url).hostname}`}>
      <p className="eyebrow">Found on {new URL(found.url).hostname}</p>

      {found.name && (
        <label className="check"><input type="checkbox" checked={useName} onChange={(e) => setUseName(e.target.checked)} /> <span>Name: <strong>{found.name}</strong></span></label>
      )}
      {found.tagline && (
        <label className="check"><input type="checkbox" checked={useTagline} onChange={(e) => setUseTagline(e.target.checked)} /> <span>Tagline: {found.tagline}</span></label>
      )}

      {found.colors.length > 0 && (
        <div className="found-row">
          <span>Colour</span>
          <div className="swatches" role="radiogroup" aria-label="Brand colour">
            {found.colors.map((c) => (
              <button
                key={c} type="button" role="radio" aria-checked={color === c} aria-label={c}
                className="swatch" style={{ background: c }} onClick={() => setColor(c)}
              />
            ))}
            <button type="button" role="radio" aria-checked={color === undefined} className="link-button" onClick={() => setColor(undefined)}>keep mine</button>
          </div>
        </div>
      )}

      {found.font && (
        <>
          {/* Loads the font so the sample below shows it. */}
          <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?family=${found.font.css}&display=swap`} />
          <label className="check">
            <input type="checkbox" checked={useFont} onChange={(e) => setUseFont(e.target.checked)} />
            <span>Font: <span style={{ fontFamily: `"${found.font.family}"`, fontSize: "1.1rem" }}>{found.font.family} — The quick brown fox</span></span>
          </label>
        </>
      )}

      {found.background && (found.background.usable ? (
        <label className="check">
          <input type="checkbox" checked={useBackground} onChange={(e) => setUseBackground(e.target.checked)} />
          <span>Page background: <span className="swatch swatch-inline" style={{ background: found.background.color }} /> <code>{found.background.color}</code></span>
        </label>
      ) : (
        <p className="muted">
          Their pages are dark (<code>{found.background.color}</code>). The starter is built for light pages, so it keeps its own background.
        </p>
      ))}

      {found.logos.length > 0 && (
        <div className="found-row">
          <span>Logo</span>
          <div className="logo-choices" role="radiogroup" aria-label="Logo">
            {found.logos.map((l, i) => (
              <button key={i} type="button" role="radio" aria-checked={logo === i} className="logo-choice" onClick={() => setLogo(i)} title={l.label}>
                {/* eslint-disable-next-line @next/next/no-img-element -- a data URL preview of a found logo */}
                <img src={l.dataUrl} alt={l.label} />
              </button>
            ))}
            <button type="button" role="radio" aria-checked={logo === null} className="link-button" onClick={() => setLogo(null)}>no logo</button>
          </div>
        </div>
      )}

      {found.missing.length > 0 && <p className="muted">Couldn&rsquo;t find {found.missing.join(", ")}.</p>}

      <div>
        <button type="button" className="btn btn-primary" onClick={apply} disabled={applying}>{applying ? "Applying…" : "Apply to my app"}</button>
      </div>
      {done && <p className="muted" aria-live="polite">{done}</p>}
    </section>
  );
}

/**
 * A found logo as a file the upload accepts. Raster images go as they are; an
 * SVG is drawn onto a canvas and saved as PNG — the app stores only raster
 * logos, since an SVG served from the app's own origin could carry script.
 */
async function logoFile(dataUrl: string, svg: boolean): Promise<File> {
  if (!svg) {
    const blob = await (await fetch(dataUrl)).blob();
    const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
    return new File([blob], `logo.${ext}`, { type: blob.type });
  }
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  // SVGs without a width/height report 0; fall back to a wide logo shape.
  const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 4;
  const height = 160;
  const width = Math.min(1200, Math.round(height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Couldn't convert that logo — try another one.");
  return new File([blob], "logo.png", { type: "image/png" });
}
