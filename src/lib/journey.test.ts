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

const SYNC = { passed: true, reasons: [], requirements: { modality: { value: "sync" } } };
const ASYNC = { passed: true, reasons: [], requirements: { modality: { value: "async" } } };

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
    const get = vi.fn().mockResolvedValue(ASYNC);
    const client = { post, get } as unknown as LithosClient;
    await expect(runJourney(value, client, { now, externalId: "sample-fixed" })).resolves.toEqual({ status: "complete", patientId: "pat_1", carePlanId: "cp_1", encounterId: "enc_1", modality: "async" });
    expect(post.mock.calls[1]).toEqual(["/v1/care_plans", { patient_id: "pat_1", category: "lipid_management" }, { idempotencyKey: expect.stringMatching(/:care-plan$/) }]);
    expect(get).toHaveBeenCalledWith("/v1/encounter_precheck?patient_id=pat_1&care_plan_id=cp_1");
  });

  it("stops with the precheck's reasons when Lithos can't take the encounter", async () => {
    const value = input();
    const now = new Date("2026-08-18T12:00:00.000Z");
    const post = vi.fn()
      .mockResolvedValueOnce({ id: "pat_1" })
      .mockResolvedValueOnce({ id: "cp_1" });
    const get = vi.fn().mockResolvedValue({
      passed: false,
      reasons: [{ code: "encounter.no_licensed_availability", message: "No Lithos clinician licensed in TX is taking encounters right now." }],
      requirements: { modality: { value: "async" } },
    });
    const client = { post, get } as unknown as LithosClient;
    const result = await runJourney(value, client, { now, externalId: "sample-fixed" });
    expect(result.status).toBe("failed");
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("rejects non-synthetic data before any API request", () => {
    const form = validForm();
    form.set("first_name", "Jane"); form.set("last_name", "Doe"); form.set("email", "jane@real.test");
    const parsed = parseJourneyForm(form);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.map((error) => error.source?.pointer)).toEqual(expect.arrayContaining(["/first_name", "/email"]));
  });

  it("reports partial IDs and resumes without duplicating completed stages", async () => {
    const failedClient = { post: vi.fn().mockResolvedValueOnce({ id: "pat_1" }).mockResolvedValueOnce({ id: "cp_1" }).mockRejectedValueOnce(new LithosApiError(422, [{ code: "intake.invalid", message: "Invalid", source: { pointer: "/intake_form/data/ldl_c" } }])), get: vi.fn().mockResolvedValue(ASYNC) } as unknown as LithosClient;
    const result = await runJourney(input(), failedClient, { externalId: "sample-fixed" });
    expect(result).toMatchObject({ status: "failed", stage: "encounter", httpStatus: 422, patientId: "pat_1", carePlanId: "cp_1" });

    const resumed = input();
    resumed.resume = { patientId: "pat_1", carePlanId: "cp_1" };
    const resumedPost = vi.fn().mockResolvedValue({ id: "enc_2" });
    await expect(runJourney(resumed, { post: resumedPost, get: vi.fn().mockResolvedValue(ASYNC) } as unknown as LithosClient)).resolves.toMatchObject({ status: "complete", encounterId: "enc_2", modality: "async" });
    expect(resumedPost).toHaveBeenCalledTimes(1);
    expect(resumedPost).toHaveBeenCalledWith("/v1/encounters", expect.objectContaining({ patient_id: "pat_1", care_plan_id: "cp_1" }), { idempotencyKey: expect.stringMatching(/:encounter$/) });
  });

  it("carries on with the patient Lithos already has when the external id is taken", async () => {
    const taken = new LithosApiError(422, [{ code: "patient.external_id_in_use", message: "in use", meta: { existing_patient_id: "pat_existing" } }]);
    const post = vi.fn().mockRejectedValueOnce(taken).mockResolvedValueOnce({ id: "cp_1" }).mockResolvedValueOnce({ id: "enc_1" });
    const result = await runJourney(input(), { post, get: vi.fn().mockResolvedValue(ASYNC) } as unknown as LithosClient, { externalId: "eu_mem_1" });
    expect(result).toMatchObject({ status: "complete", patientId: "pat_existing", encounterId: "enc_1" });
    expect(post.mock.calls[1][1]).toEqual({ patient_id: "pat_existing", category: "lipid_management" });
  });

  it("stops before creating an encounter when the requirements check fails", async () => {
    const post = vi.fn().mockResolvedValueOnce({ id: "pat_1" }).mockResolvedValueOnce({ id: "cp_1" });
    const get = vi.fn().mockRejectedValue(new LithosApiError(422, [{ code: "care_plan.not_encounterable", message: "Not encounterable" }]));
    const result = await runJourney(input(), { post, get } as unknown as LithosClient, { externalId: "sample-fixed" });
    expect(result).toMatchObject({ status: "failed", stage: "requirements", httpStatus: 422, patientId: "pat_1", carePlanId: "cp_1" });
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("stops for a time before creating a sync encounter", async () => {
    const post = vi.fn().mockResolvedValueOnce({ id: "pat_1" }).mockResolvedValueOnce({ id: "cp_1" });
    const result = await runJourney(input(), { post, get: vi.fn().mockResolvedValue(SYNC) } as unknown as LithosClient, { externalId: "sample-fixed" });
    expect(result).toEqual({ status: "needs_visit", patientId: "pat_1", carePlanId: "cp_1" });
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("creates a sync encounter with its hold and idempotency key, in one call", async () => {
    const resumed = input();
    resumed.resume = { patientId: "pat_1", carePlanId: "cp_1" };
    resumed.visit = { reservationToken: "rsv_tok", idempotencyKey: "key-1" };
    const post = vi.fn().mockResolvedValueOnce({ id: "enc_1" });
    const result = await runJourney(resumed, { post, get: vi.fn().mockResolvedValue(SYNC) } as unknown as LithosClient);
    expect(result).toMatchObject({ status: "complete", encounterId: "enc_1", modality: "sync" });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0]).toEqual([
      "/v1/encounters",
      expect.objectContaining({ patient_id: "pat_1", care_plan_id: "cp_1", reservation_token: "rsv_tok" }),
      { idempotencyKey: "key-1" },
    ]);
  });

  it("reports a refused hold at the encounter stage, keeping the patient and plan to pick again", async () => {
    const resumed = input();
    resumed.resume = { patientId: "pat_1", carePlanId: "cp_1" };
    resumed.visit = { reservationToken: "rsv_tok", idempotencyKey: "key-1" };
    const expired = new LithosApiError(409, [{ code: "slot_reservation.not_active", message: "Hold expired", source: { pointer: "/reservation_token" } }]);
    const post = vi.fn().mockRejectedValueOnce(expired);
    const result = await runJourney(resumed, { post, get: vi.fn().mockResolvedValue(SYNC) } as unknown as LithosClient);
    expect(result).toMatchObject({ status: "failed", stage: "encounter", httpStatus: 409, patientId: "pat_1", carePlanId: "cp_1" });
    expect(result).not.toHaveProperty("encounterId");
  });

  it("sends no hold for an async encounter, and keys it from the attempt", async () => {
    const resumed = input();
    resumed.resume = { patientId: "pat_1", carePlanId: "cp_1" };
    const post = vi.fn().mockResolvedValueOnce({ id: "enc_1" });
    await runJourney(resumed, { post, get: vi.fn().mockResolvedValue(ASYNC) } as unknown as LithosClient, { attempt: { key: "a1", at: new Date() } });
    expect(post.mock.calls[0][1]).not.toHaveProperty("reservation_token");
    expect(post.mock.calls[0][2]).toEqual({ idempotencyKey: "a1:encounter" });
  });

  it("sends the same keys and bodies when one attempt is sent twice — so Lithos replays rather than duplicates", async () => {
    const attempt = { key: "1790000000000-0f0e0d0c-0b0a-4908-8706-050403020100", at: new Date("2026-10-01T15:00:00Z") };
    const send = async () => {
      const post = vi.fn().mockResolvedValueOnce({ id: "pat_1" }).mockResolvedValueOnce({ id: "cp_1" }).mockResolvedValueOnce({ id: "enc_1" });
      await runJourney(input(), { post, get: vi.fn().mockResolvedValue(ASYNC) } as unknown as LithosClient, { attempt });
      return post.mock.calls;
    };
    const first = await send();
    expect(await send()).toEqual(first);
    expect(first.map((call) => call[2].idempotencyKey)).toEqual([`${attempt.key}:patient`, `${attempt.key}:care-plan`, `${attempt.key}:encounter`]);
    expect(first[0][1]).toMatchObject({ external_id: `sample-${attempt.key}`, telehealth_consented_at: "2026-10-01T15:00:00.000Z" });
  });
});

describe("weight-management journey", () => {
  function weightForm(overrides: Record<string, string> = {}): FormData {
    const form = validForm();
    ["indication", "ldl_c", "ldl_c_date", "familial_hypercholesterolemia"].forEach((key) => form.delete(key));
    const values: Record<string, string> = {
      weight_goal: "20_to_50", height_ft: "5", height_in: "7", weight_lb: "215", already_on_glp1: "false",
      gallbladder: "on", comorbidity_htn: "on", ...overrides,
    };
    Object.entries(values).forEach(([key, value]) => form.set(key, value));
    return form;
  }

  it("converts feet, inches and pounds into the contract's centimetres and kilograms", () => {
    const parsed = parseJourneyForm(weightForm(), "weight_management");
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
    expect(parsed.value.program).toBe("weight_management");
    expect(parsed.value.intake).toMatchObject({
      height_cm: 170, weight_kg: 97.5, gallbladder: true, pregnancy: false, comorbidities: ["htn"], already_on_glp1: false,
    });
    // The lipid fields don't leak into a weight intake, and the UI-only goal isn't sent.
    expect(parsed.value.intake).not.toHaveProperty("ldl_c");
    expect(parsed.value.intake).not.toHaveProperty("weight_goal");
  });

  it("sends all seventeen screening answers, unticked ones as false", () => {
    const parsed = parseJourneyForm(weightForm(), "weight_management");
    if (!parsed.ok) throw new Error("fixture invalid");
    const booleans = Object.values(parsed.value.intake).filter((v) => typeof v === "boolean");
    expect(booleans).toHaveLength(17 + 1); // the screens, plus already_on_glp1
  });

  it("points a missing weight at the contract field", () => {
    const parsed = parseJourneyForm(weightForm({ weight_lb: "" }), "weight_management");
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.map((e) => e.source?.pointer)).toContain("/intake_form/data/weight_kg");
  });

  it("opens a weight-management care plan", async () => {
    const parsed = parseJourneyForm(weightForm(), "weight_management");
    if (!parsed.ok) throw new Error("fixture invalid");
    const post = vi.fn().mockResolvedValueOnce({ id: "pat_1" }).mockResolvedValueOnce({ id: "cp_1" }).mockResolvedValueOnce({ id: "enc_1" });
    await runJourney(parsed.value, { post, get: vi.fn() } as unknown as LithosClient, { externalId: "sample-fixed" });
    expect(post.mock.calls[1]).toEqual(["/v1/care_plans", { patient_id: "pat_1", category: "weight_management" }, { idempotencyKey: expect.stringMatching(/:care-plan$/) }]);
  });
});

describe("a program without a written-out intake", () => {
  function genericForm(overrides: Record<string, string> = {}): FormData {
    const form = validForm();
    ["indication", "ldl_c", "ldl_c_date", "familial_hypercholesterolemia"].forEach((name) => form.delete(name));
    const values: Record<string, string> = { reason_for_visit: "Help with sleep", current_medications: "", allergies: "Penicillin", kidney_or_liver_disease: "on", ...overrides };
    Object.entries(values).forEach(([key, value]) => form.set(key, value));
    return form;
  }

  it("sends the illustrative intake, with defaults for blank answers and every screening answer", () => {
    const parsed = parseJourneyForm(genericForm(), "wellness");
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
    expect(parsed.value.program).toBe("wellness");
    expect(parsed.value.intake).toEqual({
      reason_for_visit: "Help with sleep", current_medications: "None", allergies: "Penicillin",
      pregnant_or_breastfeeding: false, serious_drug_reaction: false, kidney_or_liver_disease: true, recent_hospital_stay: false,
    });
  });

  it("points a missing reason at its field", () => {
    const parsed = parseJourneyForm(genericForm({ reason_for_visit: " " }), "wellness");
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors[0].source?.pointer).toBe("/intake_form/data/reason_for_visit");
  });
});

describe("dermatology journeys", () => {
  function dermForm(values: Record<string, string | string[]>): FormData {
    const form = validForm();
    ["indication", "ldl_c", "ldl_c_date", "familial_hypercholesterolemia"].forEach((name) => form.delete(name));
    for (const [key, value] of Object.entries(values)) {
      for (const v of Array.isArray(value) ? value : [value]) form.append(key, v);
    }
    return form;
  }

  it("sends the acne contract's fields, lists as lists, unticked screening as false", () => {
    const parsed = parseJourneyForm(dermForm({
      affected_areas: ["face", "back"], lesion_types: ["red_bumps"], condition_duration: "1_to_5_years", scarring: "none",
      daily_life_impact: "mild", isotretinoin_use: "never", oral_antibiotic_last_3_months: "false", oral_antibiotic_courses: "1",
      benzoyl_peroxide_attested: "true", pregnancy: "on", medications_allergies: "Penicillin allergy\n",
    }), "acne");
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
    expect(parsed.value.intake).toMatchObject({
      affected_areas: ["face", "back"], oral_antibiotic_courses: 1, benzoyl_peroxide_attested: true,
      pregnancy: true, tetracycline_allergy: false, medications_allergies: ["Penicillin allergy"],
    });
  });

  it("derives atypical_spot from the signs ticked", () => {
    const parsed = parseJourneyForm(dermForm({
      main_concerns: ["melasma"], affected_areas: ["face"], condition_duration: "over_5_years", fitzpatrick_skin_type: "3",
      isotretinoin_use: "never", skin_cancer_history: "none", daily_sunscreen_use: "true", sunscreen_attested: "true",
      atypical_spot_signs: ["raised"],
    }), "hyperpigmentation_photoaging");
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
    expect(parsed.value.intake).toMatchObject({ fitzpatrick_skin_type: 3, atypical_spot: true, atypical_spot_signs: ["raised"], triggers: [] });
  });

  it("adds the uploaded photos just before the encounter", async () => {
    const parsed = parseJourneyForm(dermForm({
      affected_areas: ["face"], lesion_types: ["red_bumps"], condition_duration: "1_to_5_years", scarring: "none",
      daily_life_impact: "mild", isotretinoin_use: "never", oral_antibiotic_last_3_months: "false", oral_antibiotic_courses: "0",
      benzoyl_peroxide_attested: "true",
    }), "acne");
    if (!parsed.ok) throw new Error("fixture invalid");
    parsed.value.resume = { patientId: "pat_1", carePlanId: "cp_1" };
    const post = vi.fn().mockResolvedValueOnce({ id: "enc_1" });
    const client = { post, get: vi.fn().mockResolvedValue(ASYNC) } as unknown as LithosClient;
    const attachUploads = vi.fn(async (_program: string, intake: object) => ({ ...intake, face_front_photo_upload_id: "upl_test_1" }));
    const result = await runJourney(parsed.value, client, { attachUploads });
    expect(result.status).toBe("complete");
    const encounterBody = post.mock.calls.find(([path]) => path === "/v1/encounters")?.[1];
    expect(encounterBody.intake_form.data.face_front_photo_upload_id).toBe("upl_test_1");
  });
});
