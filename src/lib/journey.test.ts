import { describe, expect, it, vi } from "vitest";
import { LithosApiError } from "./lithos/errors";
import type { LithosClient } from "./lithos/client";
import { buildEncounterPayload, buildPatientPayload, parseJourneyForm, runJourney } from "./journey";

function validForm(): FormData {
  const form = new FormData();
  const values: Record<string, string> = {
    first_name: "Sample", last_name: "Patient", date_of_birth: "1990-01-15", sex: "female",
    email: "sample.patient@example.com", phone: "+12025550123", address_line1: "123 Sample Street",
    city: "Washington", state: "DC", postal_code: "20001", enrolled_in_government_insurance: "false",
    indication: "hypercholesterolemia", ldl_c: "160", ldl_c_date: "2025-01-15",
    familial_hypercholesterolemia: "none", attestations_confirmed: "on",
  };
  Object.entries(values).forEach(([key, value]) => form.set(key, value));
  return form;
}

function input() {
  const parsed = parseJourneyForm(validForm());
  if (!parsed.ok) throw new Error("fixture invalid");
  return parsed.value;
}

describe("journey payloads", () => {
  it("constructs exact patient, care-plan, and initial encounter requests", async () => {
    const value = input();
    const now = new Date("2026-08-18T12:00:00.000Z");
    expect(buildPatientPayload(value, now, "sample-fixed")).toMatchObject({
      external_id: "sample-fixed", first_name: "Sample", enrolled_in_government_insurance: false,
      telehealth_consented_at: now.toISOString(), identity_verified_at: now.toISOString(),
    });
    expect(buildEncounterPayload(value, "pat_1", "cp_1")).toEqual({
      patient_id: "pat_1", care_plan_id: "cp_1", intake_form: { data: {
        indication: "hypercholesterolemia", ldl_c: 160, ldl_c_date: "2025-01-15",
        familial_hypercholesterolemia: "none", established_atherosclerotic_cardiovascular_disease: false,
        recent_cardiac_condition: false, drug_hypersensitivity: false, cirrhosis: false,
        severe_hepatic_impairment: false, severe_renal_impairment: false, pregnancy: false,
        currently_taking_cyclosporine: false,
      } }, requested_treatments: [{ action: "add" }],
    });

    const post = vi.fn().mockResolvedValueOnce({ id: "pat_1" }).mockResolvedValueOnce({ id: "cp_1" }).mockResolvedValueOnce({ id: "enc_1" });
    const client = { post, get: vi.fn() } as unknown as LithosClient;
    await expect(runJourney(value, client, { now, externalId: "sample-fixed" })).resolves.toEqual({ status: "complete", patientId: "pat_1", carePlanId: "cp_1", encounterId: "enc_1" });
    expect(post.mock.calls[1]).toEqual(["/v1/care_plans", { patient_id: "pat_1", category: "lipid_management" }]);
  });

  it("rejects non-synthetic data before any API request", () => {
    const form = validForm();
    form.set("first_name", "Jane"); form.set("last_name", "Doe"); form.set("email", "jane@real.test");
    const parsed = parseJourneyForm(form);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.map((error) => error.source?.pointer)).toEqual(expect.arrayContaining(["/first_name", "/email"]));
  });

  it("reports partial IDs and resumes without duplicating completed stages", async () => {
    const failedClient = { post: vi.fn().mockResolvedValueOnce({ id: "pat_1" }).mockResolvedValueOnce({ id: "cp_1" }).mockRejectedValueOnce(new LithosApiError(422, [{ code: "intake.invalid", message: "Invalid", source: { pointer: "/intake_form/data/ldl_c" } }])), get: vi.fn() } as unknown as LithosClient;
    const result = await runJourney(input(), failedClient, { externalId: "sample-fixed" });
    expect(result).toMatchObject({ status: "failed", stage: "encounter", httpStatus: 422, patientId: "pat_1", carePlanId: "cp_1" });

    const resumed = input();
    resumed.resume = { patientId: "pat_1", carePlanId: "cp_1" };
    const resumedPost = vi.fn().mockResolvedValue({ id: "enc_2" });
    await expect(runJourney(resumed, { post: resumedPost, get: vi.fn() } as unknown as LithosClient)).resolves.toMatchObject({ status: "complete", encounterId: "enc_2" });
    expect(resumedPost).toHaveBeenCalledTimes(1);
    expect(resumedPost).toHaveBeenCalledWith("/v1/encounters", expect.objectContaining({ patient_id: "pat_1", care_plan_id: "cp_1" }));
  });
});
