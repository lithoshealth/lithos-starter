"use client";

import { useActionState } from "react";
import { ApiErrors } from "../../_visit/api-errors";
import { cancelVisitAction } from "./actions";
import { IDLE_ACTION } from "@/lib/visit-state";

export function CancelVisit({ encounterId, appointmentId }: { encounterId: string; appointmentId: string }) {
  const [state, action, pending] = useActionState(cancelVisitAction, IDLE_ACTION);
  return (
    <details className="cancel-visit">
      <summary>Cancel this visit</summary>
      <form action={action} className="stack">
        <input type="hidden" name="encounter_id" value={encounterId} />
        <input type="hidden" name="appointment_id" value={appointmentId} />
        <label className="field">
          Reason
          <input name="reason" defaultValue="Patient asked to cancel" maxLength={500} required />
        </label>
        <p className="fine-print">Your intake stays with us — you can book a new time afterwards.</p>
        {state.status === "error" && <ApiErrors title="We couldn't cancel your visit" httpStatus={state.httpStatus} errors={state.errors} />}
        <div>
          <button type="submit" className="btn btn-ghost" disabled={pending}>{pending ? "Canceling…" : "Cancel visit"}</button>
        </div>
      </form>
    </details>
  );
}
