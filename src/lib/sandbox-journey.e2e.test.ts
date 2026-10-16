/**
 * The patient journey against the real Lithos sandbox, once per program the
 * organization's formulary offers: request care (patient, care plan, labs and
 * photos when asked, intake), the clinician's sign-off, and the pharmacy order.
 * It's what a prospect does in this app, so when the API changes a protocol's
 * rules this fails here, nightly, before a prospect finds it.
 *
 * Skipped unless LITHOS_SANDBOX_E2E=1, with sandbox credentials in the usual
 * environment variables. `.github/workflows/sandbox-journey.yml` runs it.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const enabled = process.env.LITHOS_SANDBOX_E2E === "1";

describe.skipIf(!enabled)("patient journey against the Lithos sandbox", () => {
  it("runs every program the formulary offers, from care request to delivered order", { timeout: 600_000 }, async () => {
    const { getLithosClient } = await import("./lithos/client");
    const { runJourney } = await import("./journey");
    const { attachSamplePhotos } = await import("./journey-photos");
    const { fileSampleLabs } = await import("./journey-labs");
    const { signOffAsClinician } = await import("./sandbox-review");
    const { encounterRequest, patientRequest } = await import("./setup/requests");

    const client = getLithosClient();
    const catalog = await client.get<{ data: { categories?: string[]; dosages?: unknown[] }[] }>("/v1/catalog_treatments?status=active&limit=100");
    const programs = [...new Set(catalog.data.filter((t) => t.dosages?.length).flatMap((t) => t.categories ?? []))].sort();
    expect(programs.length).toBeGreaterThan(0);

    const failures: string[] = [];
    for (const program of programs) {
      try {
        const stamp = `${Date.now()}`;
        const { external_id: externalId, telehealth_consented_at: _c, identity_verified_at: _i, ...patient } = patientRequest(stamp, "Nightly");
        const result = await runJourney(
          {
            patient,
            program,
            intake: encounterRequest(program, "", "", "").intake_form.data,
            attestationsConfirmed: true,
            resume: {},
          } as Parameters<typeof runJourney>[0],
          client,
          { externalId: `sample-${externalId}`, attachUploads: attachSamplePhotos, fileLabs: fileSampleLabs },
        );
        if (result.status === "needs_visit") continue; // a live visit for this patient: booking is its own flow
        if (result.status !== "complete") {
          failures.push(`${program}: care request stopped at ${"stage" in result ? result.stage : result.status}: ${JSON.stringify("errors" in result ? result.errors : result)}`);
          continue;
        }

        await signOffAsClinician(client, result.encounterId);
        const encounter = await client.get<{ status: string }>(`/v1/encounters/${result.encounterId}`);
        if (encounter.status !== "completed") {
          failures.push(`${program}: the encounter is ${encounter.status} after the clinician's sign-off`);
          continue;
        }

        let order: { id: string } | undefined;
        for (let i = 0; i < 20 && !order; i++) {
          order = (await client.get<{ data: { id: string }[] }>(`/v1/orders?encounter_id=${result.encounterId}&limit=5`)).data[0];
          if (!order) await new Promise((r) => setTimeout(r, 1500));
        }
        if (!order) {
          failures.push(`${program}: no pharmacy order after approval`);
          continue;
        }
        for (const step of ["start_processing", "place", "complete"]) {
          await client.post(`/v1/sandbox/orders/${order.id}/${step}`, {});
        }
      } catch (error) {
        failures.push(`${program}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
