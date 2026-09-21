import type { LithosClient } from "./lithos/client";
import { LithosApiError } from "./lithos/errors";
import type { ApiError, EncounterListItem, ListResponse, PatientListItem } from "./lithos/types";

const PAGE_LIMIT = 100;

export type EndpointResult<T> =
  | { ok: true; data: T[] }
  | { ok: false; status: number; errors: ApiError[] };

export type JourneyDirectory = {
  patients: EndpointResult<PatientListItem>;
  encounters: EndpointResult<EncounterListItem>;
};

export type JourneyRow =
  | { kind: "encounter"; encounter: EncounterListItem; patient?: PatientListItem }
  | { kind: "patient"; patient: PatientListItem };

function pagePath(endpoint: string, cursor?: string): string {
  const query = new URLSearchParams({ limit: String(PAGE_LIMIT) });
  if (cursor) query.set("cursor", cursor);
  return `${endpoint}?${query.toString()}`;
}

export async function listAll<T>(client: LithosClient, endpoint: string): Promise<T[]> {
  const data: T[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;

  while (true) {
    const page = await client.get<ListResponse<T>>(pagePath(endpoint, cursor));
    data.push(...page.data);

    if (!page.pagination.has_more) return data;

    const nextCursor = page.pagination.next_cursor;
    if (!nextCursor || seenCursors.has(nextCursor)) {
      throw new Error(`Invalid pagination response from ${endpoint}`);
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }
}

async function capture<T>(request: Promise<T[]>): Promise<EndpointResult<T>> {
  try {
    return { ok: true, data: await request };
  } catch (error) {
    if (!(error instanceof LithosApiError)) throw error;
    return { ok: false, status: error.status, errors: error.errors };
  }
}

export async function loadJourneyDirectory(client: LithosClient): Promise<JourneyDirectory> {
  const [patients, encounters] = await Promise.all([
    capture(listAll<PatientListItem>(client, "/v1/patients")),
    capture(listAll<EncounterListItem>(client, "/v1/encounters")),
  ]);
  return { patients, encounters };
}

export function buildJourneyRows(
  patients: PatientListItem[],
  encounters: EncounterListItem[],
): JourneyRow[] {
  const patientsById = new Map(patients.map((patient) => [patient.id, patient]));
  const patientsWithEncounters = new Set(encounters.map((encounter) => encounter.patient_id));

  return [
    ...encounters.map((encounter): JourneyRow => ({
      kind: "encounter",
      encounter,
      patient: patientsById.get(encounter.patient_id),
    })),
    ...patients
      .filter((patient) => !patientsWithEncounters.has(patient.id))
      .map((patient): JourneyRow => ({ kind: "patient", patient })),
  ];
}