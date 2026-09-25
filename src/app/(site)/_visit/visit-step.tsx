"use client";

import { startTransition, useActionState, useCallback } from "react";
import type { VisitOffer } from "@/lib/sync-visits";
import { formatVisitTime } from "@/lib/time-zones";
import { IDLE_HOLD } from "@/lib/visit-state";
import { ApiErrors } from "./api-errors";
import { ClockPanel } from "./clock-panel";
import { SlotDays } from "./slot-days";
import { intakeHoldAction, intakeSlotsAction } from "../actions";

/**
 * The step a sync request adds before it is sent: pick a time, hold it, then
 * submit. The hold keeps the time while the patient finishes — in a real app,
 * payment goes here. The final button submits the surrounding form itself
 * (`form={formId}`) with the hold's token, so Lithos creates the encounter and
 * books the visit in one call — or neither.
 */
export function VisitStep({
  formId,
  patientId,
  carePlanId,
  initialOffer,
  submitting,
  submitLabel = "Book this time and send my intake",
}: {
  formId: string;
  patientId: string;
  carePlanId: string;
  initialOffer: VisitOffer;
  submitting: boolean;
  submitLabel?: string;
}) {
  const [offer, loadTimes, loading] = useActionState(intakeSlotsAction, initialOffer);
  const [hold, holdAction, holding] = useActionState(intakeHoldAction, IDLE_HOLD);
  const ids = (
    <>
      <input type="hidden" name="patient_id" value={patientId} />
      <input type="hidden" name="care_plan_id" value={carePlanId} />
    </>
  );
  // A clock change moves "now": the times on screen were built on the old one.
  const reloadAfterClockChange = useCallback(() => {
    const data = new FormData();
    data.set("patient_id", patientId);
    data.set("care_plan_id", carePlanId);
    startTransition(() => loadTimes(data));
  }, [patientId, carePlanId, loadTimes]);
  const reload = (label: string, from?: string) => (
    <form action={loadTimes}>
      {ids}
      {from && <input type="hidden" name="from" value={from} />}
      <button type="submit" className="btn btn-ghost" disabled={loading || holding}>{loading ? "Loading times…" : label}</button>
    </form>
  );

  if (hold.status === "held") {
    const { reservation } = hold;
    return (
      <section className="visit stack" aria-live="polite">
        <p className="eyebrow">Live video visit</p>
        <h2>{formatVisitTime(reservation.starts_at, offer.timeZone)}</h2>
        <div className="notes">
          <strong>{reservation.duration_minutes} min with {reservation.clinician.first_name} {reservation.clinician.last_name}</strong>
          <p className="muted">Held for you until {formatVisitTime(reservation.expires_at, offer.timeZone, "time")}. Send it to book this time.</p>
        </div>
        <input type="hidden" form={formId} name="reservation_token" value={reservation.reservation_token} />
        <input type="hidden" form={formId} name="idempotency_key" value={hold.idempotencyKey} />
        <div className="visit-actions">
          <button type="submit" form={formId} className="btn btn-primary btn-lg" disabled={submitting}>
            {submitting ? "Booking your visit…" : submitLabel}
          </button>
          <form action={holdAction}>
            <input type="hidden" name="intent" value="release" />
            <input type="hidden" name="reservation_token" value={reservation.reservation_token} />
            <button type="submit" className="btn btn-ghost" disabled={holding || submitting}>Pick another time</button>
          </form>
        </div>
      </section>
    );
  }

  return (
    <section className="visit stack">
      <p className="eyebrow">One more step</p>
      <h2>Pick a time for your video visit</h2>
      <p>
        A clinician needs to see you on a short live video visit before prescribing. They review your intake with you
        on the call. Times are in {offer.timeZone.replace("_", " ")}, only for clinicians licensed in your state.
      </p>

      {offer.error && <ApiErrors title="We couldn't load visit times" httpStatus={offer.error.httpStatus} errors={offer.error.errors} />}
      {hold.status === "error" && <ApiErrors title="We couldn't hold that time" httpStatus={hold.httpStatus} errors={hold.errors} />}

      {offer.days.length > 0 && (
        <form action={holdAction} className="stack">
          {ids}
          <SlotDays key={offer.days[0]?.slots[0]?.token} days={offer.days} disabled={holding || loading} />
          {holding && <p className="muted" aria-live="polite">Holding that time…</p>}
        </form>
      )}

      {!offer.error && offer.days.length === 0 && (
        <p className="notes">
          {offer.reason === "no_licensed_availability"
            ? "No clinician licensed in your state is keeping hours right now. Another range won't help — please check back later."
            : offer.nextAvailable
              ? `Nothing is free in this range. The next opening is ${formatVisitTime(offer.nextAvailable, offer.timeZone)}.`
              : "Nothing opens before the booking horizon ends."}
        </p>
      )}

      <div className="visit-actions">
        {offer.laterFrom && reload("Later times →", offer.laterFrom)}
        {!offer.laterFrom && offer.nextAvailable && reload("Show those times →", offer.nextAvailable)}
        {reload("Refresh times")}
      </div>

      {offer.sandbox && <ClockPanel clockLabel={offer.clockLabel} moves={[]} onChanged={reloadAfterClockChange} />}
    </section>
  );
}
