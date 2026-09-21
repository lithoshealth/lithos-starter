import { describe, expect, it, vi } from "vitest";
import type { LithosClient } from "./lithos/client";
import { LithosApiError } from "./lithos/errors";
import type { EncounterListItem, ListResponse, PatientListItem } from "./lithos/types";
import { buildJourneyRows, listAll, loadJourneyDirectory } from "./journeys";

const patient = (id: string, createdAt: string): PatientListItem => ({
  id,
  first_name: "Sample",
  last_name: id,
  created_at: createdAt,
});

const encounter = (
  id: string,
  patientId: string,
  createdAt: string,
  status: EncounterListItem["status"] = "pending_review",
): EncounterListItem => ({ id, patient_id: patientId, status, created_at: createdAt });

const page = <T>(data: T[], nextCursor: string | null = null): ListResponse<T> => ({
  data,
  pagination: { next_cursor: nextCursor, has_more: nextCursor !== null },
});

describe("journey directory loading", () => {
  it("drains opaque cursors at limit 100 and preserves API order", async () => {
    const get = vi.fn()
      .mockResolvedValueOnce(page([patient("pat_new", "2026-08-18T12:00:00Z")], "patient cursor/+="))
      .mockResolvedValueOnce(page([patient("pat_old", "2026-08-17T12:00:00Z")]));

    await expect(listAll<PatientListItem>({ get } as unknown as LithosClient, "/v1/patients"))
      .resolves.toEqual([
        patient("pat_new", "2026-08-18T12:00:00Z"),
        patient("pat_old", "2026-08-17T12:00:00Z"),
      ]);
    expect(get.mock.calls.map(([path]) => path)).toEqual([
      "/v1/patients?limit=100",
      "/v1/patients?limit=100&cursor=patient+cursor%2F%2B%3D",
    ]);
  });

  it("loads patient and encounter lists concurrently, including an empty organization", async () => {
    const pending: Array<(value: ListResponse<never>) => void> = [];
    const get = vi.fn(() => new Promise<ListResponse<never>>((resolve) => pending.push(resolve)));
    const request = loadJourneyDirectory({ get } as unknown as LithosClient);

    expect(get).toHaveBeenCalledTimes(2);
    pending.forEach((resolve) => resolve(page([])));
    await expect(request).resolves.toEqual({
      patients: { ok: true, data: [] },
      encounters: { ok: true, data: [] },
    });
  });

  it("preserves every endpoint error and represents a partial response honestly", async () => {
    const patientErrors = [
      { code: "cursor.invalid", message: "Cursor is malformed", source: { parameter: "cursor" } },
      { code: "request.invalid", message: "Try the request again" },
    ];
    const get = vi.fn((path: string) => path.startsWith("/v1/patients")
      ? Promise.reject(new LithosApiError(422, patientErrors))
      : Promise.resolve(page([encounter("enc_1", "pat_1", "2026-08-18T12:00:00Z")])));

    await expect(loadJourneyDirectory({ get } as unknown as LithosClient)).resolves.toEqual({
      patients: { ok: false, status: 422, errors: patientErrors },
      encounters: { ok: true, data: [encounter("enc_1", "pat_1", "2026-08-18T12:00:00Z")] },
    });
  });

  it("joins encounter rows without dropping unknown patients and appends patients with no encounters", () => {
    const patients = [
      patient("pat_with", "2026-08-18T12:00:00Z"),
      patient("pat_without", "2026-08-17T12:00:00Z"),
    ];
    const encounters = [
      encounter("enc_new", "pat_unknown", "2026-08-18T14:00:00Z"),
      encounter("enc_old", "pat_with", "2026-08-18T13:00:00Z"),
    ];

    expect(buildJourneyRows(patients, encounters)).toEqual([
      { kind: "encounter", encounter: encounters[0], patient: undefined },
      { kind: "encounter", encounter: encounters[1], patient: patients[0] },
      { kind: "patient", patient: patients[1] },
    ]);
  });

  it("rejects a malformed or repeated next cursor instead of looping forever", async () => {
    const get = vi.fn().mockResolvedValue({ data: [], pagination: { has_more: true, next_cursor: null } });
    await expect(listAll({ get } as unknown as LithosClient, "/v1/patients"))
      .rejects.toThrow("Invalid pagination response from /v1/patients");
  });
});