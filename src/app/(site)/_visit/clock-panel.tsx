"use client";

import { useActionState, useEffect } from "react";
import type { ClockMove } from "@/lib/sandbox-clock";
import { ApiErrors } from "./api-errors";
import { testClockAction } from "./clock-actions";
import { IDLE_ACTION } from "@/lib/visit-state";

/**
 * Sandbox only. Nobody can sit in a sandbox video room, so the test clock
 * stands in for people joining and leaving. Where an advance lands decides
 * the outcome.
 */
export function ClockPanel({
  encounterId,
  clockLabel,
  moves,
  onChanged,
}: {
  encounterId?: string;
  clockLabel: string | null;
  moves: ClockMove[];
  /** Called after the clock changes — anything built on the old clock (a slot grid) is now stale. */
  onChanged?: () => void;
}) {
  const [state, action, pending] = useActionState(testClockAction, IDLE_ACTION);
  useEffect(() => {
    if (state.status === "ok") onChanged?.();
  }, [state, onChanged]);
  const button = (intent: string, label: string, toTime?: string, disabled = false) => (
    <form action={action}>
      {encounterId && <input type="hidden" name="encounter_id" value={encounterId} />}
      <input type="hidden" name="intent" value={intent} />
      {toTime && <input type="hidden" name="to_time" value={toTime} />}
      <button type="submit" className="btn btn-ghost" disabled={pending || disabled}>{label}</button>
    </form>
  );

  return (
    <div className="sandbox-panel stack">
      <p className="eyebrow">Sandbox · play out the visit</p>
      {clockLabel ? (
        <p>Test clock: <strong>{clockLabel}</strong>. Slots, holds and the join window all run on it.</p>
      ) : (
        <p>
          No test clock — your organization runs on real time. Create one <em>before</em> you pick a time: the slot grid
          is built on the clock, so a grid fetched first is a grid for the wrong day.
        </p>
      )}

      {clockLabel && moves.length > 0 && (
        <ul className="clock-moves">
          {moves.map((move) => (
            <li key={move.label}>
              {button("advance", `${move.label} → ${move.toTime}`, move.toTime, !move.available)}
              {move.why && <span className="muted">{move.why}</span>}
            </li>
          ))}
        </ul>
      )}
      {clockLabel && moves.length > 0 && (
        <p className="fine-print">
          To see a completed visit, advance into the arrival window first, then past the end. Jumping straight past the
          window is a no-show — a milestone only fires when an advance lands inside it.
        </p>
      )}

      <div className="visit-actions">
        {clockLabel ? button("delete", "Delete the test clock") : button("create", "Create a test clock at now")}
      </div>

      {state.status === "ok" && state.message && <p className="muted" aria-live="polite">{state.message}</p>}
      {state.status === "error" && <ApiErrors title="The test clock call failed" httpStatus={state.httpStatus} errors={state.errors} />}
      <p className="fine-print">The clock is shared by your whole sandbox organization. Only shown against the Lithos sandbox.</p>
    </div>
  );
}
