import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HomePageLinks } from "../page";
import { StatusPageLinks } from "../status/[encounterId]/page";
import { JourneysDirectory } from "./directory";
import type { JourneyDirectory } from "@/lib/journeys";
import type { EncounterListItem, PatientListItem } from "@/lib/lithos/types";

const patient = (id: string): PatientListItem => ({
  id,
  first_name: "Sample",
  last_name: "Patient",
  created_at: "2026-08-18T12:00:00Z",
});

const encounter = (id: string, patientId: string, status: EncounterListItem["status"]): EncounterListItem => ({
  id,
  patient_id: patientId,
  status,
  created_at: "2026-08-18T14:00:00Z",
});

function render(directory: JourneyDirectory): string {
  return renderToStaticMarkup(createElement(JourneysDirectory, { directory }));
}

describe("journeys directory rendering", () => {
  it("renders newest-first encounters, all public badges, joins, fallbacks, and status links", () => {
    const statuses: EncounterListItem["status"][] = [
      "pending_review", "in_review", "escalated", "completed", "canceled",
    ];
    const html = render({
      patients: { ok: true, data: [patient("pat_joined"), patient("pat_without")] },
      encounters: { ok: true, data: statuses.map((status, index) => encounter(
        `enc_${index}`,
        index === 0 ? "pat_joined" : "pat_unavailable",
        status,
      )) },
    });

    expect(html.indexOf("enc_0")).toBeLessThan(html.indexOf("enc_4"));
    for (const status of statuses) expect(html).toContain(`data-status="${status}"`);
    expect(html).toContain("Sample Patient");
    expect(html).toContain("Patient name unavailable");
    expect(html).toContain("No encounters yet");
    expect(html).toContain("href=\"/status/enc_0\"");
    expect(html).toContain("2026-08-18T14:00:00.000Z (UTC)");
    expect(html).toContain("href=\"/\">New journey");
  });

  it("renders every API error while preserving successful encounter data", () => {
    const html = render({
      patients: { ok: false, status: 422, errors: [
        { code: "cursor.invalid", message: "Cursor is malformed", source: { parameter: "cursor" } },
        { code: "request.invalid", message: "Try again", source: { pointer: "/limit" } },
      ] },
      encounters: { ok: true, data: [encounter("enc_partial", "pat_partial", "in_review")] },
    });

    expect(html).toContain("Patients request failed");
    expect(html).toContain("HTTP status: 422");
    expect(html).toContain("cursor.invalid");
    expect(html).toContain("query: cursor");
    expect(html).toContain("request.invalid");
    expect(html).toContain("/limit");
    expect(html).toContain("enc_partial");
  });

  it("does not claim patients have no encounters when the encounter request failed", () => {
    const html = render({
      patients: { ok: true, data: [patient("pat_1")] },
      encounters: { ok: false, status: 503, errors: [{ code: "service.unavailable", message: "Unavailable" }] },
    });

    expect(html).toContain("Encounters request failed");
    expect(html).toContain("Encounters unavailable");
    expect(html).not.toContain("No encounters yet");
  });

  it("renders the empty organization state", () => {
    const html = render({ patients: { ok: true, data: [] }, encounters: { ok: true, data: [] } });
    expect(html).toContain("No patients or encounters yet.");
    expect(html).not.toContain("<table");
  });

  it("provides journeys navigation from the home and status pages", () => {
    const home = renderToStaticMarkup(createElement(HomePageLinks));
    const status = renderToStaticMarkup(createElement(StatusPageLinks, { encounterId: "enc_1" }));
    expect(home).toContain("href=\"/journeys\"");
    expect(status).toContain("href=\"/journeys\"");
    expect(status).toContain("href=\"/status/enc_1\"");
  });
});