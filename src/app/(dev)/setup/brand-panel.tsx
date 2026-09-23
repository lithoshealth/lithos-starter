"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import type { Brand } from "@/lib/starter-config";
import { removeLogoAction, saveBrandAction, uploadLogoAction, type BrandActionState } from "./brand-actions";
import { LivePreview } from "./live-preview";

const IDLE: BrandActionState = { status: "idle" };

/**
 * "Your company" — the first thing on a demo: name, colour and logo, each
 * saved the moment it changes (no Save button to forget), with the real home
 * page beside them. The other choices that shape the app are made later, in
 * the step where they matter: the program in step 2, the intake in step 3.
 */
export function BrandPanel({ brand, program, writable }: { brand: Brand; program?: string; writable: boolean }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const colorTimer = useRef<number | undefined>(undefined);
  const lastSubmitted = useRef(JSON.stringify([brand.name, brand.tagline, brand.color]));
  const [color, setColor] = useState(brand.color);
  const [renders, setRenders] = useState(0);
  const [saved, save, saving] = useActionState(saveBrandAction, IDLE);
  const [uploaded, upload, uploading] = useActionState(uploadLogoAction, IDLE);
  const [removed, remove] = useActionState(removeLogoAction, IDLE);

  // After any save lands: re-render this page (its header shows the name) and the preview.
  const latest = [saved, uploaded, removed];
  useEffect(() => {
    if (!latest.some((s) => s.status === "saved")) return;
    router.refresh();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one fresh preview per save result
    setRenders((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to each new result object, not to router
  }, [saved, uploaded, removed]);

  function submitBrand() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    // Leaving a field you didn't change shouldn't reload the preview.
    const key = JSON.stringify([data.get("name"), data.get("tagline"), data.get("color")]);
    if (key === lastSubmitted.current) return;
    lastSubmitted.current = key;
    startTransition(() => save(data));
  }

  const error = latest.find((s) => s.status === "error") as { message: string } | undefined;

  return (
    <section className="card brand-panel" aria-labelledby="brand-heading">
      <div className="brand-panel-controls stack">
        <div>
          <p className="eyebrow">Start here</p>
          <h2 id="brand-heading">Your company</h2>
          <p className="muted">
            This is your app. Give it your company&rsquo;s name, colour and logo and watch it change. The steps below
            tailor the rest as you go — what you offer, how patients sign up.
          </p>
        </div>

        <form ref={formRef} className="stack" onSubmit={(e) => { e.preventDefault(); submitBrand(); }}>
          <label className="field">
            Company name
            <input name="name" defaultValue={brand.name} maxLength={60} required disabled={!writable} onBlur={submitBrand} />
          </label>
          <label className="field">
            Tagline
            <input name="tagline" defaultValue={brand.tagline} maxLength={120} disabled={!writable} onBlur={submitBrand} />
          </label>
          <label className="field brand-color-field">
            Brand colour
            <span className="brand-color-row">
              <input
                type="color" name="color" value={color} disabled={!writable}
                onChange={(e) => {
                  setColor(e.target.value);
                  // Dragging across the picker fires constantly; save once it settles.
                  window.clearTimeout(colorTimer.current);
                  colorTimer.current = window.setTimeout(submitBrand, 350);
                }}
              />
              <code>{color}</code>
            </span>
          </label>
        </form>

        <form action={upload} className="stack">
          <label className="field">
            Logo <small>PNG, JPEG or WebP, under 800 KB</small>
            <input
              type="file" name="logo" accept="image/png,image/jpeg,image/webp" disabled={!writable || uploading}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
            />
          </label>
        </form>
        {brand.logo && writable && (
          <form action={remove}>
            <button type="submit" className="link-button">Remove the logo</button>
          </form>
        )}

        <p className="muted brand-status" aria-live="polite">
          {!writable
            ? "This copy is deployed, so its brand is fixed — change it in a local copy."
            : saving || uploading ? "Saving…"
            : error ? <span className="error-text">{error.message}</span>
            : "Changes save as you make them, to starter.config.json."}
        </p>
      </div>

      {/* Re-rendered after each save here, and when step 2 changes the program the home page describes. */}
      <LivePreview key={`${renders}-${program}`} path="/" />
    </section>
  );
}
