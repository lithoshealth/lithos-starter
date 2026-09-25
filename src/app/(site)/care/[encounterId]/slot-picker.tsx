"use client";

import { useRouter } from "next/navigation";
import { useActionState, type ReactNode } from "react";
import type { SlotReservation } from "@/lib/lithos/types";
import type { SlotDay } from "@/lib/sync-visits";
import { formatVisitTime } from "@/lib/time-zones";
import { IDLE_ACTION, IDLE_HOLD } from "@/lib/visit-state";
import { ApiErrors } from "../../_visit/api-errors";
import { SlotDays } from "../../_visit/slot-days";
import { confirmVisitAction, slotHoldAction } from "./actions";

/** Refusals that mean this hold can never be spent: only picking again helps. */
const DEAD_HOLD = new Set(["slot_reservation.not_active", "reservation_token.invalid"]);

/**
 * Pick a time → hold it → confirm. The hold is where a start becomes a visit
 * with one named clinician; it keeps the time for the organization's hold
 * window while the patient finishes — in a real app, this is where payment goes.
 */
export function SlotPicker({
  mode,
  encounterId,
  appointmentId,
  days,
  timeZone,
}: {
  mode: "book" | "reschedule";
  encounterId: string;
  appointmentId?: string;
  days: SlotDay[];
  timeZone: string;
}) {
  const router = useRouter();
  const [hold, holdAction, holding] = useActionState(slotHoldAction, IDLE_HOLD);

  if (hold.status === "held") {
    const release = (
      <form action={holdAction}>
        <input type="hidden" name="intent" value="release" />
        <input type="hidden" name="encounter_id" value={encounterId} />
        <input type="hidden" name="reservation_token" value={hold.reservation.reservation_token} />
        <button type="submit" className="btn btn-ghost" disabled={holding}>Pick another time</button>
      </form>
    );
    // Keyed by the hold, so a new hold starts with no error from the last one.
    return (
      <ConfirmHold
        key={hold.reservation.id}
        mode={mode}
        encounterId={encounterId}
        appointmentId={appointmentId}
        reservation={hold.reservation}
        idempotencyKey={hold.idempotencyKey}
        timeZone={timeZone}
        release={release}
      />
    );
  }

  return (
    <form action={holdAction} className="stack">
      <input type="hidden" name="encounter_id" value={encounterId} />
      {hold.status === "error" && (
        <>
          <ApiErrors title="We couldn't hold that time" httpStatus={hold.httpStatus} errors={hold.errors} />
          <p>
            <button type="button" className="btn btn-ghost" onClick={() => router.refresh()}>Load fresh times</button>
          </p>
        </>
      )}
      <SlotDays days={days} disabled={holding} />
      {holding && <p className="muted" aria-live="polite">Holding that time…</p>}
    </form>
  );
}

function ConfirmHold({
  mode,
  encounterId,
  appointmentId,
  reservation,
  idempotencyKey,
  timeZone,
  release,
}: {
  mode: "book" | "reschedule";
  encounterId: string;
  appointmentId?: string;
  reservation: SlotReservation;
  idempotencyKey: string;
  timeZone: string;
  release: ReactNode;
}) {
  const [confirm, confirmAction, confirming] = useActionState(confirmVisitAction, IDLE_ACTION);
  const dead = confirm.status === "error" && confirm.errors.some((e) => DEAD_HOLD.has(e.code));
  const clinician = `${reservation.clinician.first_name} ${reservation.clinician.last_name}`;
  return (
    <div className="stack">
      <div className="notes">
        <strong>{formatVisitTime(reservation.starts_at, timeZone)} · {reservation.duration_minutes} min with {clinician}</strong>
        <p className="muted">
          {dead
            ? "This hold has lapsed — pick a time again."
            : `Held for you until ${formatVisitTime(reservation.expires_at, timeZone, "time")}. Confirm to ${mode === "reschedule" ? "move your visit" : "book it"}.`}
        </p>
      </div>
      {confirm.status === "error" && (
        <ApiErrors title={mode === "reschedule" ? "We couldn't move your visit" : "We couldn't book that time"} httpStatus={confirm.httpStatus} errors={confirm.errors} />
      )}
      <div className="visit-actions">
        {!dead && (
          <form action={confirmAction}>
            <input type="hidden" name="intent" value={mode} />
            <input type="hidden" name="encounter_id" value={encounterId} />
            {appointmentId && <input type="hidden" name="appointment_id" value={appointmentId} />}
            <input type="hidden" name="reservation_token" value={reservation.reservation_token} />
            <input type="hidden" name="idempotency_key" value={idempotencyKey} />
            <button type="submit" className="btn btn-primary" disabled={confirming}>
              {confirming ? "Confirming…" : mode === "reschedule" ? "Move my visit here" : "Confirm this time"}
            </button>
          </form>
        )}
        {release}
      </div>
    </div>
  );
}
