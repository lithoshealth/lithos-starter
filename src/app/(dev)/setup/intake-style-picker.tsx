"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect } from "react";
import { INTAKE_STYLES, type IntakeStyle } from "@/lib/intake/styles";
import { setIntakeStyleAction, type BrandActionState } from "./brand-actions";

const IDLE: BrandActionState = { status: "idle" };

/**
 * Step 3's choice: how your patients answer the intake. Saved to
 * starter.config.json the moment it's picked; the preview under it re-renders
 * with the page.
 */
export function IntakeStylePicker({ current, writable }: { current: IntakeStyle; writable: boolean }) {
  const router = useRouter();
  const [state, save, saving] = useActionState(setIntakeStyleAction, IDLE);

  useEffect(() => {
    if (state.status === "saved") router.refresh();
  }, [state, router]);

  function choose(style: IntakeStyle) {
    if (style === current) return;
    const data = new FormData();
    data.set("intakeStyle", style);
    startTransition(() => save(data));
  }

  return (
    <fieldset className="choice-set" disabled={!writable || saving}>
      <legend>How do your patients answer the intake?</legend>
      <div className="segmented">
        {INTAKE_STYLES.map((s) => (
          <button key={s.key} type="button" aria-pressed={current === s.key} onClick={() => choose(s.key)}>{s.label}</button>
        ))}
      </div>
      <small className="muted">
        {saving ? "Saving…" : state.status === "error" ? <span className="error-text">{state.message}</span> : INTAKE_STYLES.find((s) => s.key === current)?.description}
      </small>
    </fieldset>
  );
}
