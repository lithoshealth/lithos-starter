"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import type { Brand } from "@/lib/starter-config";
import { PROGRAMS, type ProgramKey } from "@/lib/setup/programs";
import { INTAKE_STYLES, type IntakeStyle } from "@/lib/intake/styles";
import {
  removeLogoAction, saveBrandAction, setIntakeStyleAction, setProgramAction, uploadLogoAction, type BrandActionState,
} from "./brand-actions";

const IDLE: BrandActionState = { status: "idle" };

const PREVIEW_PAGES = { home: { path: "/", label: "Home page" }, start: { path: "/start", label: "Care review" } } as const;
type PreviewPage = keyof typeof PREVIEW_PAGES;

/**
 * "Make it yours" — the first thing on a demo. Brand, program and intake
 * style, each saved the moment it changes (no Save button to forget), with the
 * real app in a preview beside them — so it visibly becomes the prospect's
 * company while they watch.
 */
export function BrandPanel({ brand, program, intakeStyle, writable }: { brand: Brand; program?: ProgramKey; intakeStyle: IntakeStyle; writable: boolean }) {
  const router = useRouter();
  const previewRef = useRef<HTMLIFrameElement>(null);
  const previewBoxRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const colorTimer = useRef<number | undefined>(undefined);
  const lastSubmitted = useRef(JSON.stringify([brand.name, brand.tagline, brand.color]));
  const [color, setColor] = useState(brand.color);
  const [saved, save, saving] = useActionState(saveBrandAction, IDLE);
  const [uploaded, upload, uploading] = useActionState(uploadLogoAction, IDLE);
  const [removed, remove] = useActionState(removeLogoAction, IDLE);
  const [programSaved, saveProgram, savingProgram] = useActionState(setProgramAction, IDLE);
  const [styleSaved, saveStyle, savingStyle] = useActionState(setIntakeStyleAction, IDLE);
  const [page, setPage] = useState<PreviewPage>("home");

  // After any save lands: re-render this page (its header and step 2 follow the
  // config) and reload the preview.
  const latest = [saved, uploaded, removed, programSaved, styleSaved];
  useEffect(() => {
    if (!latest.some((s) => s.status === "saved")) return;
    router.refresh();
    previewRef.current?.contentWindow?.location.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to each new result object, not to router
  }, [saved, uploaded, removed, programSaved, styleSaved]);

  /** A choice made by clicking: save it, and show the page it changes most. */
  function choose(save: (data: FormData) => void, name: string, value: string, show: PreviewPage) {
    const data = new FormData();
    data.set(name, value);
    setPage(show);
    startTransition(() => save(data));
  }

  // The preview is the real home page at desktop width (1280px), scaled to fit its box.
  useEffect(() => {
    const box = previewBoxRef.current;
    if (!box) return;
    const fit = () => box.style.setProperty("--preview-scale", String(box.clientWidth / 1280));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

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
          <h2 id="brand-heading">Make it yours</h2>
          <p className="muted">
            This is your app. Give it your company&rsquo;s name, colour and logo — the preview updates as you go, and
            the copy of the code you take away carries every change.
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

        <fieldset className="choice-set" disabled={!writable || savingProgram}>
          <legend>What you offer</legend>
          <div className="segmented">
            {PROGRAMS.map((p) => (
              <button
                key={p.key} type="button" aria-pressed={program === p.key}
                onClick={() => choose(saveProgram, "program", p.key, "home")}
              >
                {p.label}
              </button>
            ))}
          </div>
          <small className="muted">
            {program ? "Changes the whole site — its copy, the intake, and the protocol a clinician reviews against." : "Not chosen yet — the site shows lipid management until you pick."}
          </small>
        </fieldset>

        <fieldset className="choice-set" disabled={!writable || savingStyle}>
          <legend>How patients answer the intake</legend>
          <div className="segmented">
            {INTAKE_STYLES.map((s) => (
              <button
                key={s.key} type="button" aria-pressed={intakeStyle === s.key} title={s.description}
                onClick={() => choose(saveStyle, "intakeStyle", s.key, "start")}
              >
                {s.label}
              </button>
            ))}
          </div>
          <small className="muted">{INTAKE_STYLES.find((s) => s.key === intakeStyle)?.description}</small>
        </fieldset>

        <p className="muted brand-status" aria-live="polite">
          {!writable
            ? "This copy is deployed, so its brand is fixed — change it in a local copy."
            : saving || uploading || savingProgram || savingStyle ? "Saving…"
            : error ? <span className="error-text">{error.message}</span>
            : "Changes save as you make them, to starter.config.json."}
        </p>
      </div>

      <div className="brand-preview-column">
        <div className="segmented segmented-small" role="group" aria-label="Preview page">
          {(Object.keys(PREVIEW_PAGES) as PreviewPage[]).map((key) => (
            <button key={key} type="button" aria-pressed={page === key} onClick={() => setPage(key)}>{PREVIEW_PAGES[key].label}</button>
          ))}
        </div>
        <div ref={previewBoxRef} className="brand-preview" aria-label="Live preview of your app">
          <iframe ref={previewRef} src={PREVIEW_PAGES[page].path} title="Your app" tabIndex={-1} />
          <a className="brand-preview-open" href={PREVIEW_PAGES[page].path} target="_blank" rel="noopener">Open your app ↗</a>
        </div>
      </div>
    </section>
  );
}
