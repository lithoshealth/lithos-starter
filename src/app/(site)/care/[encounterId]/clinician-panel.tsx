"use client";

import { useActionState } from "react";
import { INITIAL_CLINICIAN_STATE } from "@/lib/sandbox-review-state";
import { playClinicianAction } from "./actions";

/**
 * Shown only against the sandbox. Without it, a visitor's care review sits at
 * "Received" forever — nobody reviews sandbox encounters — and the app's own
 * journey dead-ends where the walkthrough's didn't.
 */
export function ClinicianPanel({ encounterId }: { encounterId: string }) {
  const [state, run, pending] = useActionState(playClinicianAction, INITIAL_CLINICIAN_STATE);
  return (
    <form action={run} className="sandbox-panel stack">
      <input type="hidden" name="encounter_id" value={encounterId} />
      <p className="eyebrow">Sandbox · play the clinician</p>
      <p>
        In production a licensed clinician reviews this in Lithos&rsquo;s portal, usually within days. In the sandbox
        nobody will — sign it off yourself to see what the patient sees next.
      </p>
      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Reviewing…" : "Sign it off as the clinician"}</button>
      </div>
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
    </form>
  );
}
