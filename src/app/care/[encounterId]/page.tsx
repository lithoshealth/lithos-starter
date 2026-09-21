import type { Metadata } from "next";
import Link from "next/link";
import { getLithosClient } from "@/lib/lithos/client";
import { LithosApiError } from "@/lib/lithos/errors";
import type { CarePlan, EncounterStatus } from "@/lib/lithos/types";
import { readJourneyStatus } from "@/lib/journey";

export const metadata: Metadata = { title: "Your care plan" };
export const dynamic = "force-dynamic";

const TRACKER = ["Intake received", "Clinician review", "Plan ready"];

const ENCOUNTER_COPY: Record<EncounterStatus, { label: string; badge: string; detail: string; step: number }> = {
  pending_review: { label: "Received", badge: "badge-info", detail: "Your intake is in the queue. A licensed clinician will review it shortly — usually within a few days.", step: 1 },
  in_review: { label: "Clinician reviewing", badge: "badge-warning", detail: "A clinician is reviewing your intake and results right now.", step: 2 },
  escalated: { label: "Needs a closer look", badge: "badge-warning", detail: "Your clinician flagged something that needs additional review. We'll follow up with you directly.", step: 2 },
  completed: { label: "Your plan is ready", badge: "badge-success", detail: "Your clinician has finished reviewing. Your treatment plan is below.", step: 3 },
  canceled: { label: "Canceled", badge: "badge-outline", detail: "This visit was canceled. Start a new intake if you'd like to continue.", step: 0 },
};

const PLAN_COPY: Record<CarePlan["status"], string> = {
  pending_review: "Awaiting clinician review",
  in_review: "Under clinician review",
  active: "Active — a treatment plan is in place",
  ineligible: "Not eligible for this program",
};

function JsonDetails({ title, value }: { title: string; value: unknown }) {
  return <details><summary>{title}</summary><pre>{JSON.stringify(value, null, 2)}</pre></details>;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export default async function CarePage({ params }: { params: Promise<{ encounterId: string }> }) {
  const { encounterId } = await params;
  let result:
    | { ok: true; value: Awaited<ReturnType<typeof readJourneyStatus>> }
    | { ok: false; error: LithosApiError };

  try {
    result = { ok: true, value: await readJourneyStatus(getLithosClient(), encounterId) };
  } catch (error) {
    if (!(error instanceof LithosApiError)) throw error;
    result = { ok: false, error };
  }

  if (!result.ok) {
    return (
      <section className="status-card panel stack">
        <div className="error-box">
          <h2>We couldn’t load your care plan</h2>
          <p className="muted">The clinical service responded with HTTP {result.error.status}.</p>
          <ul>{result.error.errors.map((item, index) => <li key={`${item.code}-${index}`}>{item.message}{item.source?.pointer && <code className="muted"> {item.source.pointer}</code>}</li>)}</ul>
        </div>
        <p><Link href={`/care/${encodeURIComponent(encounterId)}`}>Try again</Link> · <Link href="/">Back to home</Link></p>
      </section>
    );
  }

  const { encounter, carePlan } = result.value;
  const copy = ENCOUNTER_COPY[encounter.status] ?? { label: encounter.status, badge: "badge-outline", detail: "", step: 0 };

  return (
    <section className="status-card panel stack">
      <div className="status-head">
        <p className="eyebrow">Your care plan</p>
        <h1>{copy.label}</h1>
        <p className="lede">{copy.detail}</p>
        <ol className="tracker">
          {TRACKER.map((label, index) => {
            const position = index + 1;
            const className = position < copy.step ? "done" : position === copy.step ? "current" : "";
            return <li key={label} className={className}>{label}</li>;
          })}
        </ol>
      </div>

      <dl className="status-meta">
        <div><dt>Program</dt><dd>Lipid management</dd></div>
        <div><dt>Plan status</dt><dd><span className={`badge ${carePlan.status === "active" ? "badge-success" : carePlan.status === "ineligible" ? "badge-error" : "badge-info"}`}>{PLAN_COPY[carePlan.status] ?? carePlan.status}</span></dd></div>
        <div><dt>Submitted</dt><dd>{formatDate(encounter.created_at)}</dd></div>
        <div><dt>Last updated</dt><dd>{formatDate(encounter.updated_at)}</dd></div>
        {encounter.completed_at && <div><dt>Completed</dt><dd>{formatDate(encounter.completed_at)}</dd></div>}
        {encounter.escalation_reason && <div><dt>Escalation</dt><dd>{encounter.escalation_reason}</dd></div>}
        {carePlan.ineligibility_reason_code && <div><dt>Reason</dt><dd><code>{carePlan.ineligibility_reason_code}</code></dd></div>}
      </dl>

      {carePlan.clinician_notes && (
        <div className="notes">
          <strong>A note from your clinician</strong>
          <p>{carePlan.clinician_notes}</p>
        </div>
      )}

      <p><Link href={`/care/${encodeURIComponent(encounter.id)}`} className="btn btn-ghost">Refresh status</Link> <Link href="/" className="btn btn-ghost">Back to home</Link></p>

      <div className="tech-details">
        <p className="muted">Reference: encounter <code>{encounter.id}</code> · care plan <code>{carePlan.id}</code></p>
        <JsonDetails title="Requested treatments" value={encounter.requested_treatments} />
        <JsonDetails title="Care-plan outcome" value={encounter.care_plan} />
        <JsonDetails title="Care-plan treatments" value={carePlan.treatments} />
        <JsonDetails title="Clinician" value={carePlan.clinician} />
        {encounter.patient_message && <JsonDetails title="Message from your clinician" value={encounter.patient_message} />}
      </div>
    </section>
  );
}
