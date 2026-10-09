"use client";

import { useActionState, useState, type ReactNode } from "react";
import { INITIAL_CLINICIAN_STATE } from "@/lib/sandbox-review-state";
import { playClinicianAction } from "./actions";

/**
 * Shown only against the sandbox. Without it, a visitor's care review sits at
 * "Received" forever — nobody reviews sandbox encounters. Here you play the
 * clinician: approve, decline, or ask the patient a question first. Your app
 * never makes these calls in production; a Lithos clinician decides.
 */
export function ClinicianPanel({ encounterId, waitingOnPatient, defaultQuestion, chart }: {
  encounterId: string;
  waitingOnPatient: boolean;
  defaultQuestion: string;
  /** The illustrative chart the clinician works through (clinician-chart.tsx). */
  chart: ReactNode;
}) {
  const [state, run, pending] = useActionState(playClinicianAction, INITIAL_CLINICIAN_STATE);
  const [asking, setAsking] = useState(false);
  return (
    <div className="sandbox-panel stack">
      <p className="eyebrow">Sandbox only · play the clinician</p>
      {chart}
      <div className="review-standin">
        <p>
          {waitingOnPatient
            ? "The clinician asked the patient a question. Answer it from the patient app's messages, or carry on as the clinician: that resolves the question."
            : "Stand in for the clinician. In production a licensed Lithos clinician decides; in the sandbox nobody will, so you do."}
        </p>
        <form action={run} className="review-decisions">
          <input type="hidden" name="encounter_id" value={encounterId} />
          <button type="submit" name="decision" value="approve" className="btn btn-primary" disabled={pending}>
            {pending ? "Working…" : "Simulate approval"}
          </button>
          <button type="submit" name="decision" value="decline" className="btn btn-ghost" disabled={pending}>Simulate denial</button>
          {!waitingOnPatient && (
            <button type="button" className="link-button" onClick={() => setAsking((v) => !v)} disabled={pending}>
              Ask the patient a question
            </button>
          )}
        </form>
      </div>
      {asking && !waitingOnPatient && (
        <form action={run} className="stack">
          <input type="hidden" name="encounter_id" value={encounterId} />
          <input type="hidden" name="decision" value="ask" />
          <label className="visually-hidden" htmlFor="clinician-question">The clinician&rsquo;s question</label>
          <textarea id="clinician-question" name="question" rows={3} defaultValue={defaultQuestion} required maxLength={10_000} className="chat-bubble chat-bubble-clinician" />
          <div><button type="submit" className="btn btn-ghost" disabled={pending}>Send the question</button></div>
        </form>
      )}
      {state.status === "ok" && state.chose && (
        <p className="muted">This request left the choice to the clinician, so the sandbox chose {state.chose} at its starting dose.</p>
      )}
      {state.status === "error" && (
        <div className="error-box">
          <h2>{state.httpStatus ? `Lithos answered HTTP ${state.httpStatus}` : "That didn't work"}</h2>
          <ul>{state.errors.map((e, i) => <li key={`${e.code}-${i}`}>{e.message} <code className="muted">{e.code}</code></li>)}</ul>
        </div>
      )}
      <p className="fine-print">Only shown when this app is connected to the Lithos sandbox. It never appears against production.</p>
    </div>
  );
}
