import Link from "next/link";
import { buildJourneyRows, type EndpointResult, type JourneyDirectory } from "@/lib/journeys";
import type { ApiError, EncounterStatus, PatientListItem } from "@/lib/lithos/types";

const STATUS_PRESENTATION: Record<EncounterStatus, { label: string; tone: string }> = {
  pending_review: { label: "Pending review", tone: "warning" },
  in_review: { label: "In review", tone: "info" },
  escalated: { label: "Escalated", tone: "error" },
  completed: { label: "Completed", tone: "success" },
  canceled: { label: "Canceled", tone: "outline" },
};

function errorSource(error: ApiError): string | undefined {
  if (error.source?.pointer) return error.source.pointer;
  if (error.source?.parameter) return `query: ${error.source.parameter}`;
  if (error.source?.header) return `header: ${error.source.header}`;
}

function EndpointErrors({ label, result }: {
  label: string;
  result: Extract<EndpointResult<unknown>, { ok: false }>;
}) {
  return (
    <section className="error-box stack" aria-label={`${label} errors`}>
      <h2>{label} request failed</h2>
      <p>HTTP status: {result.status}</p>
      <ul>
        {result.errors.map((error, index) => {
          const source = errorSource(error);
          return (
            <li key={`${error.code}-${index}`}>
              <strong>{error.code}</strong>: {error.message}{source && <> <code>{source}</code></>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PatientCell({ patient, patientId }: { patient?: PatientListItem; patientId: string }) {
  return (
    <>
      <strong>{patient ? `${patient.first_name} ${patient.last_name}` : "Patient name unavailable"}</strong>
      <code className="secondary-id">{patientId}</code>
    </>
  );
}

function StatusBadge({ status }: { status: EncounterStatus }) {
  const presentation = STATUS_PRESENTATION[status];
  return (
    <span className={`status-badge status-${presentation.tone}`} data-status={status}>
      {presentation.label}
    </span>
  );
}

export function formatUtcDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${date.toISOString()} (UTC)`;
}

function PatientOnlyRow({ patient, encountersAvailable }: {
  patient: PatientListItem;
  encountersAvailable: boolean;
}) {
  return (
    <tr>
      <td><PatientCell patient={patient} patientId={patient.id} /></td>
      <td>{encountersAvailable ? "No encounters yet" : "Encounters unavailable"}</td>
      <td aria-label="No encounter status">—</td>
      <td aria-label="No encounter creation time">—</td>
    </tr>
  );
}

export function JourneysDirectory({ directory }: { directory: JourneyDirectory }) {
  const patients = directory.patients.ok ? directory.patients.data : [];
  const encounters = directory.encounters.ok ? directory.encounters.data : [];
  const rows = directory.encounters.ok ? buildJourneyRows(patients, encounters) : [];
  const showTable = rows.length > 0 || (!directory.encounters.ok && patients.length > 0);
  const empty = directory.patients.ok && directory.encounters.ok && patients.length === 0 && encounters.length === 0;

  return (
    <section className="panel stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Sandbox journey directory</p>
          <h1>Journeys</h1>
        </div>
        <Link href="/">New journey</Link>
      </div>
      <p>Patients and encounters are loaded from the Lithos public API on every request.</p>

      {!directory.patients.ok && <EndpointErrors label="Patients" result={directory.patients} />}
      {!directory.encounters.ok && <EndpointErrors label="Encounters" result={directory.encounters} />}

      {empty && <p className="empty-state">No patients or encounters yet.</p>}
      {!directory.patients.ok && directory.encounters.ok && encounters.length === 0 && (
        <p className="empty-state">No encounters returned. The patient directory is unavailable.</p>
      )}

      {showTable && (
        <div className="table-scroll">
          <table className="journeys-table">
            <thead>
              <tr>
                <th scope="col">Patient</th>
                <th scope="col">Encounter</th>
                <th scope="col">Status</th>
                <th scope="col">Created at (UTC)</th>
              </tr>
            </thead>
            <tbody>
              {directory.encounters.ok && rows.map((row) => row.kind === "encounter" ? (
                <tr key={`encounter-${row.encounter.id}`}>
                  <td><PatientCell patient={row.patient} patientId={row.encounter.patient_id} /></td>
                  <td><Link href={`/status/${encodeURIComponent(row.encounter.id)}`}><code>{row.encounter.id}</code></Link></td>
                  <td><StatusBadge status={row.encounter.status} /></td>
                  <td><time dateTime={row.encounter.created_at}>{formatUtcDate(row.encounter.created_at)}</time></td>
                </tr>
              ) : (
                <PatientOnlyRow key={`patient-${row.patient.id}`} patient={row.patient} encountersAvailable />
              ))}
              {!directory.encounters.ok && patients.map((patient) => (
                <PatientOnlyRow key={`patient-${patient.id}`} patient={patient} encountersAvailable={false} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}