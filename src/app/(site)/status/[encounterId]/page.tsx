import Link from "next/link";
import { lithosConnection } from "@/lib/lithos/connection";
import { NotConnected } from "../../not-connected";
import { getLithosClient } from "@/lib/lithos/client";
import { LithosApiError } from "@/lib/lithos/errors";
import { readJourneyStatus } from "@/lib/journey";

export const dynamic = "force-dynamic";

function JsonDetails({ title, value }: { title: string; value: unknown }) {
  return <details><summary>{title}</summary><pre>{JSON.stringify(value, null, 2)}</pre></details>;
}

export function StatusPageLinks({ encounterId }: { encounterId: string }) {
  return (
    <p>
      <Link href={`/status/${encodeURIComponent(encounterId)}`}>Refresh uncached status</Link>
      {" · "}<Link href="/journeys">All journeys</Link>
      {" · "}<Link href="/">New fake journey</Link>
    </p>
  );
}

export default async function StatusPage({ params }: { params: Promise<{ encounterId: string }> }) {
  const { encounterId } = await params;
  if (!lithosConnection().connected) {
    return (
      <section className="status-card panel stack">
        <NotConnected
          action="This page reads an encounter's status"
          outcome="it holds the clinical record — the review, the decision, the prescription"
        />
      </section>
    );
  }
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
      <section className="panel error-box stack">
        <h1>Status request failed</h1>
        <p>HTTP status: {result.error.status}</p>
        <ul>{result.error.errors.map((item, index) => <li key={`${item.code}-${index}`}><strong>{item.code}</strong>: {item.message}{item.source?.pointer && <code> {item.source.pointer}</code>}</li>)}</ul>
        <StatusPageLinks encounterId={encounterId} />
      </section>
    );
  }

  const { encounter, carePlan } = result.value;
  return (
    <section className="panel stack">
      <p className="eyebrow">Live sandbox status</p>
      <h1>Encounter {encounter.id}</h1>
      <p><strong>Encounter state:</strong> {encounter.status}</p>
      <p><strong>Care plan:</strong> {carePlan.id} · {carePlan.category} · {carePlan.status}</p>
      <p><strong>Created:</strong> {encounter.created_at}</p>
      {encounter.completed_at && <p><strong>Completed:</strong> {encounter.completed_at}</p>}
      {encounter.escalation_reason && <p><strong>Escalation:</strong> {encounter.escalation_reason}</p>}
      <JsonDetails title="Requested-treatment results" value={encounter.requested_treatments} />
      <JsonDetails title="Embedded care-plan outcome" value={encounter.care_plan} />
      <JsonDetails title="Full care-plan treatments" value={carePlan.treatments} />
      <JsonDetails title="Clinician" value={carePlan.clinician} />
      <StatusPageLinks encounterId={encounter.id} />
    </section>
  );
}
