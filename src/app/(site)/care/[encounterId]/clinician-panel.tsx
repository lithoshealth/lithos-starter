"use client";

import { useActionState, useState } from "react";
import { INITIAL_CLINICIAN_STATE } from "@/lib/sandbox-review-state";
import { playClinicianAction } from "./actions";

/**
 * Shown only against the sandbox. Without it, a visitor's care review sits at
 * "Received" forever — nobody reviews sandbox encounters. Here you play the
 * clinician: approve, decline, or ask the patient a question first. Your app
 * never makes these calls in production; a Lithos clinician decides.
 */
export function ClinicianPanel({ encounterId, waitingOnPatient, defaultQuestion }: {
  encounterId: string;
  waitingOnPatient: boolean;
  defaultQuestion: string;
}) {
  const [state, run, pending] = useActionState(playClinicianAction, INITIAL_CLINICIAN_STATE);
  const [asking, setAsking] = useState(false);
  return (
    <div className="sandbox-panel stack">
      <p className="eyebrow">Sandbox only · play the clinician</p>
      <p>
        {waitingOnPatient
          ? "The clinician asked the patient a question. Answer it from the patient app's messages, or carry on as the clinician: that resolves the question."
          : "In production a licensed Lithos clinician reviews this, in Lithos's own tools. In the sandbox nobody will, so you decide for them and see what the patient sees next."}
      </p>
      <form action={run} className="form-actions">
        <input type="hidden" name="encounter_id" value={encounterId} />
        <button type="submit" name="decision" value="approve" className="btn btn-primary" disabled={pending}>
          {pending ? "Working…" : "Approve and prescribe"}
        </button>
        <button type="submit" name="decision" value="decline" className="btn btn-ghost" disabled={pending}>Decline</button>
        {!waitingOnPatient && (
          <button type="button" className="link-button" onClick={() => setAsking((v) => !v)} disabled={pending}>
            Ask the patient a question
          </button>
        )}
      </form>
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
