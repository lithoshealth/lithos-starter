import Link from "next/link";
import { getLithosClient } from "@/lib/lithos/client";
import { LithosApiError } from "@/lib/lithos/errors";
import type { Appointment, Encounter } from "@/lib/lithos/types";
import { readClock, visitClockMoves } from "@/lib/sandbox-clock";
import { isSandboxBaseUrl } from "@/lib/sandbox-review";
import { listAppointments, listRescheduleSlots, listSlots, slotDays, slotWindow, SLOT_WINDOW_DAYS, visitStage } from "@/lib/sync-visits";
import { formatVisitTime } from "@/lib/time-zones";
import { ApiErrors } from "../../_visit/api-errors";
import { CancelVisit } from "./cancel-visit";
import { ClockPanel } from "../../_visit/clock-panel";
import { SlotPicker } from "./slot-picker";

type Loaded<T> = { ok: true; value: T } | { ok: false; error: LithosApiError };

async function attempt<T>(promise: Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, value: await promise };
  } catch (error) {
    if (!(error instanceof LithosApiError)) throw error;
    return { ok: false, error };
  }
}

const STATUS_COPY: Record<Appointment["status"], { label: string; badge: string }> = {
  scheduled: { label: "Booked", badge: "badge-info" },
  in_progress: { label: "Under way", badge: "badge-warning" },
  completed: { label: "Completed", badge: "badge-success" },
  patient_no_show: { label: "Missed", badge: "badge-error" },
  clinician_no_show: { label: "Clinician didn't join", badge: "badge-error" },
  canceled: { label: "Canceled", badge: "badge-outline" },
};

const PROGRESS_COPY: Partial<Record<Appointment["progress"], string>> = {
  due: "It's time — nobody has joined yet.",
  waiting_for_clinician: "You're in the waiting room. Your clinician has been told.",
  waiting_for_patient: "Your clinician is in the room and waiting for you.",
  under_way: "Your visit is under way.",
  ended: "The call has ended.",
  presumed_ended: "The call looks to be over.",
};

const REBOOK_COPY: Partial<Record<Appointment["status"], string>> = {
  patient_no_show: "You missed your visit. Pick a new time — your intake is kept.",
  clinician_no_show: "Your clinician couldn't join, and we're sorry. Pick a new time — your intake is kept.",
  canceled: "Your visit was canceled. Pick a new time when you're ready — your intake is kept.",
};

function clinicianName(appointment: Appointment): string {
  return `${appointment.clinician.first_name} ${appointment.clinician.last_name}`;
}

function minutes(appointment: Appointment): number {
  return Math.round((Date.parse(appointment.ends_at) - Date.parse(appointment.starts_at)) / 60_000);
}

function isIsoTime(value: string | undefined): value is string {
  return Boolean(value && !Number.isNaN(Date.parse(value)));
}

function JoinButton({ appointment, encounterId, timeZone }: { appointment: Appointment; encounterId: string; timeZone: string }) {
  const join = appointment.patient_join;
  switch (join.status) {
    case "provisioning":
      return <p className="muted">Getting your visit room ready. <Link href={`/care/${encodeURIComponent(encounterId)}#visit`}>Refresh</Link> in a moment.</p>;
    case "too_early":
      return (
        <p>
          <button type="button" className="btn btn-primary" disabled>Join visit</button>{" "}
          <span className="muted">Opens at {formatVisitTime(join.opens_at!, timeZone, "time")}, ten minutes before your visit.</span>
        </p>
      );
    case "joinable":
      return (
        <p>
          <a
            className="btn btn-primary btn-lg"
            href={`/care/${encodeURIComponent(encounterId)}/join?appointment=${encodeURIComponent(appointment.id)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Join visit ↗
          </a>{" "}
          <span className="muted">Opens your secure video visit in a new tab.</span>
        </p>
      );
    case "closed":
      return null;
  }
}

/**
 * The sync-visit part of the care page: book, join, reschedule, cancel. Drawn
 * from the encounter's `modality`, `needs_appointment` and `latest_appointment`,
 * which is what the sync-visits guide says to drive the UI from.
 */
export async function VisitSection({
  encounter,
  timeZone,
  reschedule,
  from,
}: {
  encounter: Encounter;
  /** The patient's zone, from Lithos. */
  timeZone: string;
  reschedule: boolean;
  from: string | undefined;
}) {
  const stage = visitStage(encounter);
  if (stage === "none") return null;

  const client = getLithosClient();
  const latest = encounter.latest_appointment ?? null;
  const sandbox = isSandboxBaseUrl(process.env.LITHOS_API_BASE_URL);
  const carePath = `/care/${encodeURIComponent(encounter.id)}`;

  const [clock, history] = await Promise.all([
    sandbox ? attempt(readClock(client)) : Promise.resolve(null),
    attempt(listAppointments(client, encounter.id)),
  ]);
  const clockNow = clock?.ok && clock.value ? new Date(clock.value.frozen_time) : new Date();

  // The grid is built on the organization's clock, so page from the clock's "now".
  const start = isIsoTime(from) && Date.parse(from) > clockNow.getTime() ? new Date(from) : clockNow;
  const range = slotWindow(start);
  const wantsGrid = stage === "book" || (stage === "booked" && reschedule && latest?.status === "scheduled" && latest.cancelable);
  const grid = !wantsGrid
    ? null
    : await attempt(
        stage === "book"
          ? listSlots(client, { patientId: encounter.patient_id, carePlanId: encounter.care_plan_id, ...range })
          : listRescheduleSlots(client, latest!.id, range),
      );

  // Lithos says whether cancel and reschedule would still be accepted, on the
  // organization's clock — so the buttons only show when they can succeed.
  const changeable = latest?.status === "scheduled" && latest.cancelable;

  const pageLink = (params: Record<string, string>) => `${carePath}?${new URLSearchParams({ ...(reschedule ? { reschedule: "1" } : {}), ...params })}#visit`;

  const gridView = grid && (
    grid.ok ? (
      grid.value.slots.length > 0 ? (
        <>
          <SlotPicker
            mode={stage === "book" ? "book" : "reschedule"}
            encounterId={encounter.id}
            appointmentId={stage === "booked" ? latest!.id : undefined}
            days={slotDays(grid.value.slots, timeZone)}
            timeZone={timeZone}
          />
          <p className="muted">
            Times are in {timeZone.replace("_", " ")} and only for clinicians licensed in your state.{" "}
            <Link href={pageLink({ from: range.to })}>Later times →</Link>
          </p>
        </>
      ) : grid.value.reason === "no_licensed_availability" ? (
        <p className="notes">No clinician licensed in your state is keeping hours right now. Another range won&rsquo;t help — please check back later.</p>
      ) : (
        <p className="notes">
          Nothing is free in the next {SLOT_WINDOW_DAYS} days.{" "}
          {grid.value.next_available ? (
            <Link href={pageLink({ from: grid.value.next_available })}>
              See times from {formatVisitTime(grid.value.next_available, timeZone)} →
            </Link>
          ) : (
            "Nothing opens before the booking horizon ends."
          )}
        </p>
      )
    ) : (
      <ApiErrors title="We couldn't load visit times" httpStatus={grid.error.status} errors={grid.error.errors} />
    )
  );

  return (
    <section id="visit" className="visit stack">
      <p className="eyebrow">Live video visit</p>

      {stage === "book" && (
        <>
          <h2>{latest ? "Book a new time" : "Pick a time for your video visit"}</h2>
          <p>
            {(latest && REBOOK_COPY[latest.status]) ??
              "Your state requires a live video visit before a clinician can prescribe. Your clinician reviews your intake with you on the call."}
          </p>
          {gridView}
        </>
      )}

      {stage === "booked" && latest && (
        <>
          <h2>{formatVisitTime(latest.starts_at, timeZone)}</h2>
          <dl className="status-meta">
            <div><dt>Status</dt><dd><span className={`badge ${STATUS_COPY[latest.status].badge}`}>{STATUS_COPY[latest.status].label}</span></dd></div>
            <div><dt>Clinician</dt><dd>{clinicianName(latest)}</dd></div>
            <div><dt>Length</dt><dd>{minutes(latest)} min · video</dd></div>
            {PROGRESS_COPY[latest.progress] && <div><dt>Right now</dt><dd>{PROGRESS_COPY[latest.progress]}</dd></div>}
          </dl>
          <JoinButton appointment={latest} encounterId={encounter.id} timeZone={timeZone} />

          {latest.status === "scheduled" && !changeable && (
            <div className="notes">
              <strong>It&rsquo;s too close to your visit to move or cancel it here.</strong>
              <p className="muted">Please contact your care team.</p>
            </div>
          )}
          {changeable &&
            (reschedule ? (
              <div className="stack">
                <h3>Move your visit</h3>
                <p className="muted">Your current time stays booked until the move goes through.</p>
                {gridView}
                <p><Link href={`${carePath}#visit`}>Keep my current time</Link></p>
              </div>
            ) : (
              <>
                <div className="visit-actions">
                  <Link href={`${carePath}?reschedule=1#visit`} className="btn btn-ghost">Reschedule</Link>
                  <CancelVisit encounterId={encounter.id} appointmentId={latest.id} />
                </div>
                {latest.cancellation_closes_at && (
                  <p className="muted">You can move or cancel it until {formatVisitTime(latest.cancellation_closes_at, timeZone)}.</p>
                )}
              </>
            ))}
        </>
      )}

      {stage === "done" && latest && (
        <p>
          {latest.status === "completed"
            ? `Your visit with ${clinicianName(latest)} took place on ${formatVisitTime(latest.starts_at, timeZone)}.`
            : `Your last visit: ${STATUS_COPY[latest.status].label.toLowerCase()}.`}
        </p>
      )}

      {history.ok ? (
        history.value.length > 0 && (
          <details className="visit-history">
            <summary>Visit history ({history.value.length})</summary>
            <ul>
              {history.value.map((appointment) => (
                <li key={appointment.id}>
                  {formatVisitTime(appointment.starts_at, timeZone)} ·{" "}
                  <span className={`badge ${STATUS_COPY[appointment.status].badge}`}>
                    {appointment.rescheduled_to_id ? "Rescheduled" : STATUS_COPY[appointment.status].label}
                  </span>
                  {appointment.canceled_by && <span className="muted"> by {appointment.canceled_by}</span>}
                  {appointment.reason && !appointment.rescheduled_to_id && <span className="muted"> — {appointment.reason}</span>}
                  {" "}<code className="muted">{appointment.id}</code>
                </li>
              ))}
            </ul>
          </details>
        )
      ) : (
        <ApiErrors title="We couldn't load your visit history" httpStatus={history.error.status} errors={history.error.errors} />
      )}

      {clock && (clock.ok ? (
        <ClockPanel
          encounterId={encounter.id}
          clockLabel={clock.value ? `${formatVisitTime(clock.value.frozen_time, timeZone)} (${clock.value.frozen_time})` : null}
          moves={latest && stage === "booked" ? Object.values(visitClockMoves(latest, clockNow)) : []}
        />
      ) : (
        <ApiErrors title="We couldn't read the sandbox test clock" httpStatus={clock.error.status} errors={clock.error.errors} />
      ))}
    </section>
  );
}
